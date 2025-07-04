import type { Distr } from "./distribution";

export const OP_CHARS = {
  "<": [9, "l"],
  ">": [9, "l"],
  "<=": [9, "l"],
  ">=": [9, "l"],
  "==": [9, "l"],
  "!=": [9, "l"],
  "+": [10, "l"],
  "-": [10, "l"],
  // empty spaces are equivalent to *
  // multiplication is right-associative, because multiplication is actually convolution
  "": [11, "r"],
  "*": [11, "r"],
  // division has higher precedence than multiplication, to preserve conventions
  "/": [12, "l"],
  "^": [13, "r"],
} as const;

export const UNOP_CHARS = {
  "-": 10,
} as const;

export type OpChar = keyof typeof OP_CHARS;

export const OP_NAMES = ["max", "min"] as const;

export type UnopChar = keyof typeof UNOP_CHARS;

export type OpName = (typeof OP_NAMES)[number];

export const SKILLS = [
  "atk",
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
] as const;

export type Skill = (typeof SKILLS)[number];

export const VARIABLES = ["area", "time"] as const;

export type VariableKind = (typeof VARIABLES)[number];

export const UNOP_NAMES = ["floor", "ceil"] as const;

export type UnopName = (typeof UNOP_NAMES)[number];

export interface Lit {
  ty: "lit";
  lit: number;
}

export interface Func {
  ty: "func";
  params: string[];
  body: Expr;
}

export interface Die {
  ty: "die";
  n: number;
}

export interface Level {
  ty: "lvl";
  lvl: number;
}

export interface Name {
  ty: "name";
  name: string;
}

export interface Op {
  ty: "op";
  op: OpChar | OpName;
  lhs: Expr;
  rhs: Expr;
}

export interface Unop {
  ty: "unop";
  op: UnopChar | UnopName;
  inner: Expr;
}

export interface Call {
  ty: "call";
  func: Expr;
  args: Expr[];
}

export type Atom = Lit | Die | Level | Name;

export type CoreExpr = Atom | Op | Unop | Call | Func;

export type Expr = CoreExpr & {
  line?: number;
  char?: number;
  span?: number;
  hash?: number;
  deps?: string[];
};

/**
 * Any value that an expression can take: a distribution (including constant numbers) or a function.
 */
export type Value = Distr | Func;
