import type { Expr, OpName, OpChar } from "./ast"

export interface Params {
    chances: Record<string, number>
    targets: number
    time: number
    level: number
}

export interface Value {
    table: Map<number, BigInt>
    denominator: BigInt
}

function constEval(op: OpChar | OpName, lhs: number, rhs: number): number {
    switch (op) {
        case '':
            return lhs * rhs
        case '+':
            return lhs + rhs
        case '-':
            return lhs - rhs
        case '*':
            return lhs * rhs
        case '/':
            return lhs / rhs
        case '^':
            return lhs ** rhs
        case 'max':
            return Math.max(lhs, rhs)
        case 'min':
            return Math.min(lhs, rhs)
    }
}

function enter(expr: Expr, visit: (expr: Expr) => void): void {
    switch (expr.ty) {
        case 'op':
            visit(expr.lhs)
            visit(expr.rhs)
            break
        case 'var': case 'check': case 'die': case 'lit': case 'lvl':
            return
        default:
            return expr
    }
}

function average(expr: Expr, p: Params): number {
    switch (expr.ty) {
        case 'var':
            switch (expr.kind) {
                case 'area':
                    return p.targets
                case 'time':
                    return p.time
            }
        case 'check':
            const c = p.chances[expr.skill] ?? 0.5
            return expr.half ? (1 + c) / 2 : c
        case 'die':
            return (1 + expr.n) / 2
        case 'lit':
            return expr.lit
        case 'op':
            return constEval(expr.op, average(expr.lhs, p), average(expr.rhs, p)) // Some operation only work if arguments are constant. In particular, min and max are wrong
        case 'lvl':
            return p.level - expr.level
    }
}

export function getLevel(expr: Expr): number {
    if (expr.ty === 'lvl') return expr.level
    let lvl = -1
    enter(expr, (e) => lvl = Math.max(lvl, getLevel(e)))
    return lvl
}

export function getAverage(expr: Expr, p: Params): number | string {
    const lvl = getLevel(expr)
    if (p.level < lvl) return `Cannot cast at level ${p.level}`
    return average(expr, p)
}
