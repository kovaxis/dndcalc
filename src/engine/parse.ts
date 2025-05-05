import { OP_CHARS, type Expr, type OpChar } from "./ast"

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

    peek(far?: number): string | undefined {
        return this.src[this.i + (far ?? 0)]
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
        } else if (first.match(/[0-9.]/)) {
            let lit = first
            while (this.peek()?.match(/[0-9]/)) lit += this.char()
            if (this.peek() === '.') lit += this.char()
            while (this.peek()?.match(/[0-9]/)) lit += this.char()
            const num = parseFloat(lit)
            if (isNaN(num)) throw `Invalid numeric literal "${lit}"`
            return { ty: 'lit', lit: num }
        } else if (first.match(/[a-zA-Z_]/)) {
            let name = first
            while (this.peek()?.match(/[a-zA-Z_0-9]/)) name += this.char()
            name = name.toLowerCase()
            const isDie = name.match(/^d([1-9][0-9]*)$/)
            if (isDie) {
                const [, n] = isDie
                return { ty: 'die', n: parseInt(n) }
            } else if (name === 'fn') {
                const params: string[] = []
                while (true) {
                    this.trim()
                    let name = this.next()
                    if (name === '{') break
                    if (!name?.match(/[a-zA-Z_]/)) throw "Expected function parameters"
                    while (this.peek()?.match(/[a-zA-Z_0-9]/)) name += this.char()
                    params.push(name)
                }
                const body = this.expr()
                const close = this.char()
                if (close !== '}') throw `Function body does not close`
                return { ty: 'func', params, body: body }
            } else {
                return { ty: 'name', name }
            }
        } else {
            throw `Unexpected character ${first}`
        }
    }

    operator(): OpChar | '[' | null {
        this.trim()
        let bigop = this.peek()
        if (bigop === undefined) return null
        if (bigop.match(/[a-zA-Z0-9(]/)) return ''
        if (bigop === '[') return '['
        bigop += this.peek(1) ?? ''
        if (bigop.length >= 2 && bigop.slice(0, 2) in OP_CHARS) return bigop.slice(0, 2) as OpChar
        else if (bigop.length >= 1 && bigop.slice(0, 1) in OP_CHARS) return bigop.slice(0, 1) as OpChar
        else return null
    }

    expr(precedence?: number): Expr {
        precedence = precedence ?? 0
        let expr: Expr = this.atom()
        while (true) {
            const op = this.operator()
            if (op == null) break
            else if (op === '[') {
                // Function call
                // Calls have the highest precedence, so we don't have to worry about that
                const args: Expr[] = []
                while (this.peek() === '[') {
                    this.next()
                    args.push(this.expr())
                    const close = this.next()
                    if (close !== ']') throw "Unclosed square bracket"
                }
                expr = { ty: 'call', func: expr, args }
            } else {
                // A binary operator
                const [opPrec, opAssoc] = OP_CHARS[op]
                if (opPrec < precedence) {
                    break
                } else {
                    for (let i = 0; i < op.length; i++) this.next()
                    const rhs = this.expr(opPrec + (opAssoc === 'l' ? 1 : 0))
                    expr = { ty: 'op', op, lhs: expr, rhs }
                }
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
