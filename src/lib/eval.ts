import type { Expr, OpName, OpChar, Atom } from "./ast"

export interface Params {
    chances: Record<string, number>
    targets: number
    time: number
    level: number
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

export interface Table {
    counts: Map<number, bigint>
    denominator: bigint
}

function constOperate(op: OpChar | OpName, lhs: number, rhs: number): number {
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
            return Math.floor(lhs / rhs)
        case '^':
            return lhs ** rhs
        case 'max':
            return Math.max(lhs, rhs)
        case 'min':
            return Math.min(lhs, rhs)
    }
}

function tableOperate(op: OpChar | OpName, lhs: Table, rhs: Table): Table {
    const out: Table = {
        counts: new Map(),
        denominator: lhs.denominator * rhs.denominator,
    }
    for (const [lval, lcnt] of lhs.counts.entries()) {
        for (const [rval, rcnt] of rhs.counts.entries()) {
            const fval = constOperate(op, lval, rval)
            out.counts.set(fval, (out.counts.get(fval) ?? BigInt(0)) + lcnt * rcnt)
        }
    }
    return out
}

function newTable(counts: Iterable<readonly [number, number]>): Table {
    const table: Table = {
        counts: new Map(),
        denominator: BigInt(0),
    }
    for (const [val, cnt] of counts) {
        if (cnt === 0) continue
        table.counts.set(val, (table.counts.get(val) ?? BigInt(0)) + BigInt(cnt))
        table.denominator += BigInt(cnt)
    }
    return table
}

function tableAtomEval(atom: Atom, p: Params): Table {
    switch (atom.ty) {
        case 'var':
            switch (atom.kind) {
                case 'area':
                    return newTable([[p.targets, 1]])
                case 'time':
                    return newTable([[p.time, 1]])
            }
        case 'check':
            const c20 = Math.round(20 * (p.chances[atom.skill] ?? 0.5))
            return newTable([[1, c20], [atom.half ? 0.5 : 0, 20 - c20]])
        case 'die':
            return newTable([...Array(atom.n)].map((_, idx) => [idx + 1, 1]))
        case 'lit':
            return newTable([[atom.lit, 1]])
        case 'lvl':
            if (p.level < atom.level) return newTable([])
            return newTable([[p.level - atom.level, 1]])
    }

}

export function tableAverage(table: Table): number | null {
    if (Number(table.denominator) === 0) return null
    let total = BigInt(0)
    for (const [val, cnt] of table.counts) {
        total += BigInt(Math.round(val * 2 ** 53)) * cnt
    }
    return Number(total / table.denominator) / (2 ** 53)
}

export function tableStddev(table: Table, average: number | null): number | null {
    if (average === null || Number(table.denominator) === 0) return null
    let variance = BigInt(0)
    for (const [val, cnt] of table.counts) {
        variance += BigInt(Math.round((val - average) * 2 ** 53)) ** BigInt(2) * cnt
    }
    return Math.sqrt(Number(variance / table.denominator) / (2 ** 53))
}

export function tableMin(table: Table): number | null {
    const min = Math.min(...table.counts.keys())
    return min === Infinity ? null : min
}

export function tableMax(table: Table): number | null {
    const max = Math.max(...table.counts.keys())
    return max === -Infinity ? null : max
}

export function compute(expr: Expr, p: Params): Table {
    if (expr.ty === 'op') return tableOperate(expr.op, compute(expr.lhs, p), compute(expr.rhs, p))
    else return tableAtomEval(expr, p)
}

export function getLevel(expr: Expr): number {
    if (expr.ty === 'lvl') return expr.level
    let lvl = -1
    enter(expr, (e) => lvl = Math.max(lvl, getLevel(e)))
    return lvl
}
