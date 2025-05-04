import type { Expr } from "./ast"
import { compute, getLevel, tableAverage, tableMax, tableMin, tableStddev, type Params } from "./eval"
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
        const level = getLevel(expr)
        const table = compute(expr, p)
        const average = tableAverage(table)
        const damage: Map<number, number> = new Map(table.counts.entries().map(([val, cnt]) => {
            return [val, Number(cnt * BigInt(2 ** 53) / table.denominator) / 2 ** 53]
        }))
        return {
            lineNum,
            name,
            expr,
            damage,
            level: level === -1 ? null : level,
            average,
            stddev: tableStddev(table, average),
            min: tableMin(table),
            max: tableMax(table),
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
