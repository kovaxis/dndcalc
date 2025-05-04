

export const OP_CHARS = {
    '+': [0, 'l'],
    '-': [0, 'l'],
    // empty spaces are equivalent to *
    // multiplication is right-associative, because multiplication is actually convolution
    '': [1, 'r'],
    '*': [1, 'r'],
    // division has higher precedence than multiplication, to preserve conventions
    // i am 99% percent sure that making division higher precedence than multiplication and left-to-right makes operations with constant numbers behave the same as standard arithmetic
    '/': [2, 'l'],
    '^': [3, 'r'],
} as const

export type OpChar = keyof typeof OP_CHARS

export const OP_NAMES = [
    'max',
    'min',
] as const

export type OpName = typeof OP_NAMES[number]

export const SKILLS = [
    'atk',
    'str',
    'dex',
    'con',
    'int',
    'wis',
    'cha',
] as const

export type Skill = typeof SKILLS[number]

export const VARIABLES = [
    'area',
    'time',
] as const

export type VariableKind = typeof VARIABLES[number]

export const UNOP_NAMES = [
    'floor',
    'ceil',
] as const

export type UnopName = typeof UNOP_NAMES[number]

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

export interface Unop {
    ty: 'unop'
    op: UnopName
    inner: Expr
}

export type Atom =
    | Lit
    | Die
    | Check
    | Variable
    | Level

export type Expr =
    | Atom
    | Op
    | Unop
