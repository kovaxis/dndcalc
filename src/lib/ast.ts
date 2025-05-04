

export const OP_CHARS = {
    '+': [0, 'l'],
    '-': [0, 'l'],
    '': [1, 'l'],
    '*': [1, 'l'],
    '/': [1, 'l'],
    '^': [2, 'r'],
} as const

export type OpChar = keyof typeof OP_CHARS

export const OP_NAMES = [
    'max',
    'min',
] as const

export type OpName = typeof OP_NAMES[number]

export const SKILLS = [
    'int',
    'wis',
    'dex',
    'str',
    'cha',
    'con',
    'atk',
] as const

export type Skill = typeof SKILLS[number]

export const VARIABLES = [
    'area',
    'time',
] as const

export type VariableKind = typeof VARIABLES[number]

export interface Lit {
    ty: 'lit'
    lit: number
}

export interface Die {
    ty: 'die'
    n: number
}

export interface Check {
    ty: 'check'
    skill: Skill
    half: boolean
}

export interface Level {
    ty: 'lvl'
    level: number
}

export interface Variable {
    ty: 'var'
    kind: VariableKind
}

export interface Op {
    ty: 'op'
    op: OpChar | OpName
    lhs: Expr
    rhs: Expr
}

export type Expr =
    | Lit
    | Die
    | Op
    | Check
    | Variable
    | Level
