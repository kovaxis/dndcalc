import type { Expr } from "./ast"
import { evaluate, type Params } from "./eval"
import * as distribution from "./distribution"
import { parse } from "./parse"
import { cmpKeyed } from "./util"

export interface SpellAnalysis {
    lineNum: number
    name: string
    expr: Expr
    damage: Map<number, number>
    level: number | null
    average: number | null
    stddev: number | null
    min: number | null
    max: number | null
}

export interface CollectionAnalysis {
    spells: SpellAnalysis[]
    errors: string[]
}

function analyzeLine(line: string, p: Params, lineNum: number): SpellAnalysis {
    let name
    let raw
    try {
        const splitted = line.match(/^([^:]+)\:([^:]+)$/)
        if (!splitted) throw 'Does not match format "name: spell"'
        name = splitted[1].trim()
        raw = splitted[2]
    } catch (e) {
        throw `Line ${lineNum}: ${e}`
    }
    try {
        const expr = parse(raw)
        const level = -1 // getLevel(expr) TODO: reimplement this
        const table = evaluate(expr, p)
        const average = distribution.average(table)
        const damage: Map<number, number> = new Map(table.bins.entries().map(([val, cnt]) => {
            return [val, Number(cnt * BigInt(2 ** 53) / table.total) / 2 ** 53]
        }))
        return {
            lineNum,
            name,
            expr,
            damage,
            level: level === -1 ? null : level,
            average,
            stddev: distribution.stddev(table, average),
            min: distribution.min(table),
            max: distribution.max(table),
        }
    } catch (e) {
        console.error(e)
        throw `${name}: ${e}`
    }
}

export function analyze(collection: string, p: Params): CollectionAnalysis {
    const errors: string[] = []
    const analysisList = collection.split('\n').flatMap((line, idx) => {
        const commentStart = line.indexOf('#')
        if (commentStart !== -1) line = line.slice(0, commentStart)
        line = line.trim()
        if (line === '') return []
        try {
            return analyzeLine(line, p, idx + 1)
        } catch (e) {
            errors.push(`${e}`)
            return []
        }
    })
    analysisList.sort(cmpKeyed(analysis => [typeof analysis.average === 'number' ? -analysis.average : Infinity, analysis.name, analysis.lineNum]))
    return {
        spells: analysisList,
        errors,
    }
}
