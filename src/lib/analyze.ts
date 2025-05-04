import type { Expr } from "./ast"
import { getAverage, getLevel, type Params } from "./eval"
import { parse } from "./parse"

export interface SpellAnalysis {
    lineNum: number
    name: string
    expr: Expr
    level: number | null
    average: number | string
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
        return {
            lineNum,
            name,
            expr,
            level: level === -1 ? null : level,
            average: getAverage(expr, p),
        }
    } catch (e) {
        throw `${name}: ${e}`
    }
}

function cmpKeyed<T>(getKey: (elem: T) => unknown[]): (a: T, b: T) => number {
    return (aObj: T, bObj: T) => {
        const aArr = getKey(aObj)
        const bArr = getKey(bObj)
        for (let i = 0; i < Math.max(aArr.length, bArr.length); i++) {
            const a = aArr[i]
            const b = bArr[i]
            // @ts-expect-error
            if (a < b) return -1
            // @ts-expect-error
            if (a > b) return 1
        }
        return 0
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
