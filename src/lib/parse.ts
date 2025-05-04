import { VARIABLES, OP_CHARS, SKILLS, type Expr, type VariableKind, type OpChar, type Skill, OP_NAMES, type OpName } from "./ast"


function isSkill(s: string): boolean {
    return (SKILLS as readonly string[]).includes(s)
}

function isVariable(s: string): boolean {
    return (VARIABLES as readonly string[]).includes(s)
}

function isNamedOp(s: string): boolean {
    return (OP_NAMES as readonly string[]).includes(s)
}

class Parser {
    src: string
    i: number

    constructor(src: string) {
        this.src = src
        this.i = 0
    }

    next(): string | undefined {
        const s = this.src[this.i]
        this.i += 1
        return s
    }

    char(): string {
        const s = this.next()
        if (s === undefined) throw 'Unexpected end of spell'
        return s
    }

    peek(): string | undefined {
        return this.src[this.i]
    }

    trim() {
        while (this.peek()?.match(/\s/)) this.i += 1
    }

    atom(): Expr {
        this.trim()
        const first = this.char()
        if (first === '(') {
            const sub = this.expr()
            const close = this.next()
            if (close !== ')') throw "Unclosed parenthesis"
            return sub
        } else if (first.match(/[0-9]/)) {
            let lit = first
            while (this.peek()?.match(/[0-9]/)) lit += this.char()
            const num = parseInt(lit)
            return { ty: 'lit', lit: num }
        } else if (first.match(/[a-zA-Z]/)) {
            let name = first
            while (this.peek()?.match(/[a-zA-Z0-9]/)) name += this.char()
            name = name.toLowerCase()
            this.trim()
            let argsStore: Expr[] = []
            const args = (n: number, m?: number | null): Expr[] => {
                if (m === undefined) m = n
                if (m === 0 && argsStore.length > 0) throw `Term ${name} does not take arguments`
                const inb = argsStore.length === 0 ? ' in [brackets]' : ''
                if (argsStore.length < n || (m !== null && argsStore.length > m)) {
                    if (n === m) {
                        if (n === 1) throw `Expected argument${inb} after ${name}`
                        else throw `Expected ${n} arguments${inb} after ${name}`
                    } else {
                        if (m === null) throw `Expected at least ${n} arguments${inb} after ${name}`
                        else throw `Expected between ${n} and ${m} arguments${inb} after ${name}`
                    }
                }
                return argsStore
            }
            while (this.peek() === '[') {
                this.next()
                argsStore.push(this.expr())
                const close = this.next()
                if (close !== ']') throw "Unclosed square bracket"
            }
            const isDie = name.match(/^d([1-9][0-9]*)$/)
            const isLvl = name.match(/^lvl([1-9][0-9]*)$/)
            if (isVariable(name)) {
                args(0)
                return { ty: 'var', kind: name as VariableKind }
            } else if (isNamedOp(name)) {
                const a = args(2, null)
                let expr: Expr = a[0]
                for (let i = 1; i < a.length; i++) expr = { ty: 'op', op: name as OpName, lhs: expr, rhs: a[i] }
                return expr
            } else if (isDie) {
                args(0)
                const [, n] = isDie
                return { ty: 'die', n: parseInt(n) }
            } else if (isLvl) {
                const inner = args(0, 1)
                const [, level] = isLvl
                if (inner.length === 0) {
                    return { ty: 'lvl', level: parseInt(level) }
                } else {
                    // lvlN[x] == (x + lvlN)
                    return { ty: 'op', op: '+', lhs: inner[0], rhs: { ty: 'lvl', level: parseInt(level) } }
                }
            } else if (isSkill(name)) {
                args(0)
                return { ty: 'check', skill: name as Skill, half: false }
            } else if (name.endsWith('h') && isSkill(name.slice(0, -1))) {
                args(0)
                return { ty: 'check', skill: name.slice(0, -1) as Skill, half: true }
            } else {
                if (argsStore.length === 0) throw `Invalid term "${name}"`
                else throw `Invalid function ${name}[]`
            }
        } else {
            throw `Unexpected character ${first}`
        }
    }

    expr(precedence?: number): Expr {
        precedence = precedence ?? 0
        let expr: Expr = this.atom()
        while (true) {
            this.trim()
            let nextChar = this.peek()
            if (nextChar?.match(/[a-zA-Z0-9(]/)) {
                nextChar = ''
            }
            if (nextChar !== undefined && nextChar in OP_CHARS) {
                const op = nextChar as OpChar
                const [opPrec, opAssoc] = OP_CHARS[op as OpChar]
                if (opPrec < precedence) {
                    break
                } else {
                    if (nextChar) this.next()
                    const rhs = this.expr(precedence + (opAssoc === 'l' ? 1 : 0))
                    expr = { ty: 'op', op, lhs: expr, rhs }
                }
            } else {
                break
            }
        }
        return expr
    }
}

export function parse(raw: string): Expr {
    const parser = new Parser(raw)
    const expr = parser.expr()
    if (parser.peek() !== undefined) throw `Too many closing parenthesis`
    return expr
}
