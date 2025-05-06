import gcd from "bigint-gcd/gcd"
import type { Expr, OpName, OpChar, UnopName, Func } from "./ast"
import type { Distr } from "./distribution"
import * as distribution from "./distribution"

export type Params = Map<string, number>

type Env = Map<string, Value>

export interface CallCtx {
    func: Func
    args: Value[]
    env: Env
    out: Distr
    grown: bigint
}

const STANDARD_ENV: Env = new Map(Object.entries<Value>({
    min: { ty: 'func', params: ['a', 'b'], body: { ty: 'op', op: 'min', lhs: { ty: 'name', name: 'a' }, rhs: { ty: 'name', name: 'b' } } },
    max: { ty: 'func', params: ['a', 'b'], body: { ty: 'op', op: 'max', lhs: { ty: 'name', name: 'a' }, rhs: { ty: 'name', name: 'b' } } },
}))

/**
 * Any value that an expression can take: a distribution (including constant numbers) or a function.
 */
export type Value = Distr | Func

export class Context {
    globals: Env

    constructor() {
        this.globals = new Map(STANDARD_ENV)
    }

    setGlobal(name: string, value: number) {
        this.globals.set(name, distribution.singular(value))
    }

    getGlobal(name: string): number | null {
        const v = this.globals.get(name)
        if (v?.ty === 'distr' && v.bins.size === 1) {
            for (const val of v.bins.keys()) {
                return val
            }
        }
        return null
    }

    eval(expr: Expr, env: Env): Value {
        switch (expr.ty) {
            case 'die':
                return distribution.create([...Array(expr.n)].map((_, idx) => [idx + 1, 1]))
            case 'lvl':
                const levelVal = env.get('level')
                let level = null
                if (levelVal && levelVal.ty === 'distr' && levelVal.bins.size === 1) {
                    for (const val of levelVal.bins.keys()) {
                        level = Math.floor(val)
                    }
                }
                return distribution.singular(level == null ? 0 : Math.max(level - expr.lvl, 0))
            case 'lit':
                return distribution.create([[expr.lit, 1]])
            case 'op':
                const lhs = this.eval(expr.lhs, env)
                const rhs = this.eval(expr.rhs, env)
                if (lhs.ty !== 'distr' || rhs.ty !== 'distr') throw `Cannot execute operation ${lhs.ty} ${expr.op} ${rhs.ty}`
                return binopApply(expr.op, lhs, rhs)
            case 'unop':
                const inner = this.eval(expr.inner, env)
                if (inner.ty !== 'distr') throw `Cannot execute operation ${expr.op} on ${inner.ty}`
                return unopApply(expr.op, inner)
            case 'name':
                const val = env.get(expr.name)
                if (val === undefined) throw `Undefined name ${expr.name}`
                return val
            case 'func':
                return expr
            case 'call':
                const func = this.eval(expr.func, env)
                if (func.ty !== 'func') throw `Attempt to call non-function`
                const args = expr.args.map(arg => this.eval(arg, env))
                if (args.length < func.params.length) throw `Function expected ${func.params.length} arguments but ${args.length} were supplied`
                const out: Distr = {
                    ty: 'distr',
                    bins: new Map(),
                    total: args.reduce((prod, val) => prod * (val.ty === 'distr' ? val.total : BigInt(1)), BigInt(1)),
                }
                this.call({ func, args, env: new Map(env), grown: BigInt(1), out }, 0, BigInt(1))
                return out
        }
    }

    call(ctx: CallCtx, idx: number, weight: bigint): void {
        if (idx >= ctx.args.length) {
            const produced = this.eval(ctx.func.body, ctx.env)
            if (produced.ty !== 'distr') throw `Functions can only return numbers`
            const g = gcd(ctx.grown, produced.total)
            if (g !== produced.total) {
                const by = produced.total / g
                distribution.grow(ctx.out, by)
                ctx.grown *= by
            }
            const scale = weight * ctx.grown / produced.total
            for (const [val, cnt] of produced.bins) {
                ctx.out.bins.set(val, (ctx.out.bins.get(val) ?? BigInt(0)) + cnt * scale)
            }
        } else {
            const arg = ctx.args[idx]
            switch (arg.ty) {
                case 'func':
                    ctx.env.set(ctx.func.params[idx], arg)
                    return this.call(ctx, idx + 1, weight)
                case 'distr':
                    for (const [val, cnt] of arg.bins) {
                        ctx.env.set(ctx.func.params[idx], { ty: 'distr', bins: new Map([[val, BigInt(1)]]), total: BigInt(1) })
                        this.call(ctx, idx + 1, weight * cnt)
                    }
                    return
            }
            // This code is here to ensure that the switch handles all cases
            return arg
        }
    }
}

function enter(expr: Expr, visit: (expr: Expr) => void): void {
    switch (expr.ty) {
        case 'op':
            visit(expr.lhs)
            visit(expr.rhs)
            return
        case 'unop':
            visit(expr.inner)
            return
        case 'call':
            visit(expr.func)
            for (const arg of expr.args) visit(arg)
            return
        case 'func':
            visit(expr.body)
            return
        case 'die': case 'lit': case 'name': case 'lvl':
            return
        default:
            return expr
    }
}

function constSingleOperate(op: UnopName, inner: number): number {
    switch (op) {
        case 'floor':
            return Math.floor(inner)
        case 'ceil':
            return Math.ceil(inner)
    }
}

function convolve(lhs: Distr, rhs: Distr): Distr {
    const out: Distr = {
        ty: 'distr',
        bins: new Map(),
        total: lhs.total * rhs.total,
    }
    for (const [lval, lcnt] of lhs.bins.entries()) {
        for (const [rval, rcnt] of rhs.bins.entries()) {
            const fval = Math.floor(lval + rval)
            out.bins.set(fval, (out.bins.get(fval) ?? BigInt(0)) + lcnt * rcnt)
        }
    }
    return out
}

function binopApply(op: OpChar | OpName, lhs: Distr, rhs: Distr): Distr {
    if ((op === '' || op === '*') && lhs.bins.size > 0 && lhs.bins.keys().every(val => Math.floor(val) === val && val >= 0) && lhs.bins.keys().some(val => val >= 2)) {
        // Multiplication with a nonnegative integral left-hand-side is special: it is iterated convolution
        const upTo = Math.max(...lhs.bins.keys())
        const out: Distr = {
            ty: 'distr',
            bins: new Map(),
            total: lhs.total * rhs.total ** BigInt(upTo),
        }
        let tmp = distribution.create([[0, 1]])
        for (let lval = 0; lval <= upTo; lval++) {
            const lcnt = lhs.bins.get(lval)
            if (lcnt !== undefined) {
                const rhsScaleup = rhs.total ** BigInt(upTo - lval)
                for (const [rval, rcnt] of tmp.bins.entries()) {
                    out.bins.set(rval, (out.bins.get(rval) ?? BigInt(0)) + lcnt * rhsScaleup * rcnt)
                }
            }
            if (lval < upTo) tmp = convolve(tmp, rhs)
        }
        return out
    } else {
        const out: Distr = {
            ty: 'distr',
            bins: new Map(),
            total: lhs.total * rhs.total,
        }
        for (const [lval, lcnt] of lhs.bins.entries()) {
            for (const [rval, rcnt] of rhs.bins.entries()) {
                const fval = (() => {
                    switch (op) {
                        case '': case '*':
                            return Math.floor(lval * rval)
                        case '+':
                            return lval + rval
                        case '-':
                            return lval - rval
                        case '/':
                            return Math.floor(lval / rval)
                        case '^':
                            return lval ** rval
                        case '<':
                            return lval < rval ? 1 : 0
                        case '>':
                            return lval > rval ? 1 : 0
                        case '<=':
                            return lval <= rval ? 1 : 0
                        case '>=':
                            return lval >= rval ? 1 : 0
                        case '!=':
                            return lval !== rval ? 1 : 0
                        case '==':
                            return lval === rval ? 1 : 0
                        case 'max':
                            return Math.max(lval, rval)
                        case 'min':
                            return Math.min(lval, rval)
                    }
                })()
                out.bins.set(fval, (out.bins.get(fval) ?? BigInt(0)) + lcnt * rcnt)
            }
        }
        return out
    }
}

function unopApply(op: UnopName, inner: Distr): Distr {
    const out: Distr = {
        ty: 'distr',
        bins: new Map(),
        total: inner.total,
    }
    for (const [ival, icnt] of inner.bins.entries()) {
        const fval = constSingleOperate(op, ival)
        out.bins.set(fval, (out.bins.get(fval) ?? BigInt(0)) + icnt)
    }
    return out
}

function extractReferences(expr: Expr, out: string[]) {
    if (expr.ty === 'name') out.push(expr.name)
    enter(expr, subexpr => extractReferences(subexpr, out))
}

export function getReferences(expr: Expr): string[] {
    const out: string[] = []
    extractReferences(expr, out)
    return out
}

export function getLevel(expr: Expr): number | null {
    let lvl: number | null = null
    if (expr.ty === 'lvl') lvl = expr.lvl
    enter(expr, subexpr => {
        const sublvl = getLevel(subexpr)
        if (sublvl !== null && (lvl === null || sublvl > lvl)) lvl = sublvl
    })
    return lvl
}
