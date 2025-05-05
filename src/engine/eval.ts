import gcd from "bigint-gcd/gcd"
import type { Expr, OpName, OpChar, UnopName } from "./ast"
import type { Distr } from "./distribution"
import * as distribution from "./distribution"

export type Params = Map<string, number>

type Env = Map<string, Value>

export interface Func {
    ty: 'func'
    expr: Expr
    params: string[]
}

export interface CallCtx {
    func: Func
    args: Value[]
    env: Env
    out: Distr
    grown: bigint
}

const STANDARD_ENV: Env = new Map(Object.entries<Value>({
    min: { ty: 'func', params: ['a', 'b'], expr: { ty: 'op', op: 'min', lhs: { ty: 'name', name: 'a' }, rhs: { ty: 'name', name: 'b' } } }
}))

/**
 * Any value that an expression can take: a distribution (including constant numbers) or a function.
 */
export type Value = Distr | Func

class Context {
    params: Params
    globals: Env

    constructor(params: Params) {
        this.params = params
        this.globals = new Map(STANDARD_ENV)
        for (const [pname, pval] of params) {
            this.globals.set(pname, distribution.singular(pval))
        }
    }

    eval(expr: Expr, env: Env): Value {
        switch (expr.ty) {
            case 'die':
                return distribution.create([...Array(expr.n)].map((_, idx) => [idx + 1, 1]))
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
            case 'call':
                const func = this.eval(expr.func, env)
                if (func.ty !== 'func') throw `Attempt to call ${func.ty}`
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
            const produced = this.eval(ctx.func.expr, ctx.env)
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
        case 'die': case 'lit': case 'name':
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
        console.log('convolving', lhs, 'and', rhs)
        const upTo = Math.max(...lhs.bins.keys())
        const out: Distr = {
            ty: 'distr',
            bins: new Map(),
            total: lhs.total * rhs.total ** BigInt(upTo),
        }
        console.log('upTo:', upTo)
        console.log('rhsDenom:', rhs.total ** BigInt(upTo))
        console.log('finalDenom:', out.total)
        let tmp = distribution.create([[0, 1]])
        for (let lval = 0; lval <= upTo; lval++) {
            const lcnt = lhs.bins.get(lval)
            if (lcnt !== undefined) {
                console.log('applying lval =', lval, 'with rtmp =', tmp)
                const rhsScaleup = rhs.total ** BigInt(upTo - lval)
                for (const [rval, rcnt] of tmp.bins.entries()) {
                    out.bins.set(rval, (out.bins.get(rval) ?? BigInt(0)) + lcnt * rhsScaleup * rcnt)
                }
                console.log('accumulated result is', out)
            }
            if (lval < upTo) tmp = convolve(tmp, rhs)
        }
        console.log("convolved", lhs, "and", rhs, "to obtain", out)
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

export function evaluate(expr: Expr, p: Params): Distr {
    console.log('evaluating expression', expr)
    const ctx = new Context(p)
    const result = ctx.eval(expr, ctx.globals)
    if (result.ty !== 'distr') throw `Spell must return a number`
    return result
}
