import type { Expr } from "./ast"
import { Context, getReferences, type Params } from "./eval"
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
    wantParams: DefinedParamGroup[]
}

export interface DefinedParam {
    id: string
    humanName: string
    default: number
}

export interface DefinedParamGroup {
    name: string
    params: DefinedParam[]
}

export interface ParsedSpell {
    name: string
    expr: Expr
}

interface Parsed {
    spells: ParsedSpell[]
    defs: Record<string, Expr>
    definedParams: DefinedParamGroup[]
    lastGroup: string
}

function isDefined(parsed: Parsed, name: string): boolean {
    return name in parsed.defs || parsed.definedParams.find(group => group.params.find(param => param.id === name)) != null
}

function parseLine(line: string, into: Parsed, lineNum: number) {
    const isSpell = /^\s*([^:]*?)\s*\:(.*)$/.exec(line)
    const isDef = /^\s*([a-zA-Z_][a-zA-Z_0-9]*)\s*=\s*(.*?)\s*$/.exec(line)
    const isGroup = /^\s*\[\s*([^\]]*?)\s*\]\s*$/.exec(line)
    const isParam = /^\s*([a-zA-Z_][a-zA-Z_0-9]*)\s*\?\s*(.*?)\s*(?:=\s*([0-9]*)\s)*$/.exec(line)
    let name = null
    try {
        if (isSpell) {
            name = isSpell[1]
            const raw = isSpell[2]
            if (!name) throw `Spell name cannot be empty`
            const expr = parse(raw, lineNum)
            into.spells.push({ name, expr })
        } else if (isDef) {
            name = isDef[1]
            const raw = isDef[2]
            if (!name) throw `Definition name cannot be empty`
            if (isDefined(into, name)) throw `Duplicated definition of ${name}`
            const expr = parse(raw)
            into.defs[name] = expr
        } else if (isGroup) {
            name = isGroup[1]
            into.lastGroup = name
        } else if (isParam) {
            name = isParam[1]
            const human = isParam[2]
            const dfault = isParam[3]
            if (!name || !human) throw `Parameter name cannot be empty`
            if (!dfault) throw `Supply a default for parameter ${name}`
            if (isDefined(into, name)) throw `Duplicate definition of ${name}`
            let group = into.definedParams.find(g => g.name === into.lastGroup)
            if (group === undefined) {
                group = {
                    name,
                    params: [],
                }
                into.definedParams.push(group)
            }
            group.params.push({
                id: name,
                humanName: human,
                default: parseInt(dfault),
            })
        } else {
            throw `Invalid syntax`
        }
    } catch (e) {
        console.error(e)
        if (name) {
            throw `${name}: ${e}`
        } else {
            throw `Line ${lineNum}: ${e}`
        }
    }
}

export function analyzeSpell(ctx: Context, spell: ParsedSpell): SpellAnalysis {
    const level = -1 // getLevel(expr) TODO: reimplement this
    const result = ctx.eval(spell.expr, ctx.globals)
    if (result.ty !== 'distr') throw `Spell must return a number`
    const average = distribution.average(result)
    const damage: Map<number, number> = new Map(result.bins.entries().map(([val, cnt]) => {
        return [val, Number(cnt * BigInt(2 ** 53) / result.total) / 2 ** 53]
    }))
    return {
        lineNum: spell.expr.line ?? 0,
        name: spell.name,
        expr: spell.expr,
        damage,
        level: level === -1 ? null : level,
        average,
        stddev: distribution.stddev(result, average),
        min: distribution.min(result),
        max: distribution.max(result),
    }
}

function define(ctx: Context, analysis: CollectionAnalysis, parsed: Parsed, seen: Map<string, 'wip' | 'done'>, name: string, expr: Expr) {
    if (seen.has(name)) return
    seen.set(name, 'wip')

    try {
        // Define dependencies first
        for (const ref of getReferences(expr)) {
            if (ref in parsed.defs) {
                if (seen.get(ref) === 'wip') throw `Circular dependency between ${name} and ${ref}`
                define(ctx, analysis, parsed, seen, ref, parsed.defs[ref])
            }
        }

        // Evaluate
        const defined = ctx.eval(expr, ctx.globals)
        ctx.globals.set(name, defined)
    } catch (e) {
        console.error(e)
        analysis.errors.push(`Definition ${name}: ${e}`)
    } finally {
        seen.set(name, 'done')
    }
}

export function analyze(source: string, p: Params): CollectionAnalysis {
    const analysis: CollectionAnalysis = {
        spells: [],
        errors: [],
        wantParams: [],
    }

    // Parse the source
    const parsed: Parsed = { definedParams: [], defs: {}, lastGroup: '', spells: [] }
    source.split('\n').flatMap((line, idx) => {
        const commentStart = line.indexOf('#')
        if (commentStart !== -1) line = line.slice(0, commentStart)
        if (line.trim() === '') return []
        try {
            parseLine(line, parsed, idx + 1)
        } catch (e) {
            analysis.errors.push(`${e}`)
            return []
        }
    })

    // Fill in parameters
    const ctx = new Context()
    analysis.wantParams = parsed.definedParams
    for (const group of parsed.definedParams) {
        for (const param of group.params) {
            const pvalue = p.get(param.id) ?? param.default
            ctx.param(param.id, pvalue)
        }
    }

    // Run all definitions
    const seen = new Map<string, 'wip' | 'done'>()
    for (const [name, def] of Object.entries(parsed.defs)) {
        define(ctx, analysis, parsed, seen, name, def)
    }

    // Analyze all spells now
    analysis.spells = parsed.spells.flatMap(spell => {
        try {
            return analyzeSpell(ctx, spell)
        } catch (e) {
            console.error(e)
            analysis.errors.push(`Spell ${spell.name}: ${e}`)
            return []
        }
    })

    analysis.spells.sort(cmpKeyed(analysis => [typeof analysis.average === 'number' ? -analysis.average : Infinity, analysis.name, analysis.lineNum]))
    return analysis
}
