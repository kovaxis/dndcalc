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
    attribs: ParamAttribs
}

export interface DefinedParamGroup {
    name: string
    params: DefinedParam[]
    attribs: GroupAttribs
}

export interface ParsedSpell {
    name: string
    expr: Expr
}

interface Parsed {
    spells: ParsedSpell[]
    defs: Record<string, Expr>
    definedParams: DefinedParamGroup[]
}

function isDefined(parsed: Parsed, name: string): boolean {
    return name in parsed.defs || parsed.definedParams.find(group => group.params.find(param => param.id === name)) != null
}

type AttribModel = Record<string, (raw?: string) => unknown>

function enumAttrib<T>(name: string, values: T[]): (raw?: string) => unknown {
    return (raw?: string) => {
        if (raw === undefined) return values[0]
        for (const val of values) {
            if (raw === val) return val
        }
        throw `Invalid attribute ${name} "${raw}", expected one of ${values.join(', ')}`
    }
}

function intAttrib(name: string, dfault?: number): (raw?: string) => unknown {
    return (raw?: string) => {
        if (raw === undefined && dfault != null) return dfault
        if (raw !== undefined) {
            const x = parseInt(raw)
            if (!isNaN(x)) return x
        }
        throw `Invalid attribute ${name} "${raw}", expected an integer`
    }
}

interface GroupAttribs {
    flow: 'column' | 'row'
}

const GROUP_ATTRIBS: AttribModel = {
    flow: enumAttrib("flow", ['column', 'row']),
}

interface ParamAttribs {
    type: 'number' | 'range'
    min: number
    max: number
    step: number
}

const PARAM_ATTRIBS: AttribModel = {
    type: enumAttrib("type", ['number', 'range']),
    min: intAttrib("min", -20),
    max: intAttrib("max", 20),
    step: intAttrib("step", 1),
}

function parseAttribs<T>(raw: string, model: AttribModel): T {
    const amorphous: Record<string, string> = {}
    for (const [, attrib] of raw.matchAll(/\[([^\]]*)\]/g)) {
        console.log(attrib)
        const pair = attrib.match(/^\s*([^=\s]+)\s*(?:=\s*([^= ]+))?\s*$/)
        if (!pair) throw `Invalid attribute syntax "${attrib}"`
        const key = pair[1]
        const val = pair[2]
        amorphous[key] = val ?? ''
    }
    console.log(amorphous)
    for (const key of Object.keys(amorphous)) {
        if (!(key in model)) {
            throw `Unknown attribute "${key}"`
        }
    }
    return Object.fromEntries(Object.entries(model).map(([key, validate]) => {
        return [key, validate(amorphous[key])]
    })) as T
}

function parseLine(line: string, into: Parsed, lineNum: number) {
    const isSpell = /^\s*([^:]*?)\s*\:(.*)$/.exec(line)
    const isDef = /^\s*define\s+([a-zA-Z_][a-zA-Z_0-9]*)\s*=\s*(.*?)\s*$/.exec(line)
    const isGroup = /^\s*group(?:\s*\[([^\]]*)\]|\s+)\s*(.*?)\s*$/.exec(line)
    const isParam = /^\s*parameter(\s*(?:\[[^\]]*\])+\s*|\s+)([a-zA-Z_][a-zA-Z_0-9]*)\s*\?\s*([^=]*?)\s*(?:=\s*([0-9]*)\s*)?$/.exec(line)
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
            name = isGroup[2]
            const attribs = parseAttribs<GroupAttribs>(isGroup[1], GROUP_ATTRIBS)
            into.definedParams.push({ name, attribs, params: [] })
        } else if (isParam) {
            console.log(isParam)
            name = isParam[2]
            const attribs = parseAttribs<ParamAttribs>(isParam[1], PARAM_ATTRIBS)
            const human = isParam[3]
            const dfault = isParam[4]
            if (!name || !human) throw `Parameter name cannot be empty`
            if (!dfault) throw `Supply a default for parameter ${name}`
            if (isDefined(into, name)) throw `Duplicate definition of ${name}`
            into.definedParams[into.definedParams.length - 1].params.push({
                id: name,
                humanName: human,
                default: parseInt(dfault),
                attribs,
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
    const parsed: Parsed = { definedParams: [{ name: '', attribs: parseAttribs("", GROUP_ATTRIBS), params: [] }], defs: {}, spells: [] }
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
