import gcd from "bigint-gcd/gcd";
import type {
  Expr,
  OpName,
  OpChar,
  UnopName,
  Func,
  UnopChar,
  Value,
} from "./ast";
import type { Distr } from "./distribution";
import * as distribution from "./distribution";
import * as hash from "./hash";

/**
 * If an expression has more than this amount of dependencies, skip caching for it.
 */
const SKIP_CACHE_IF_MORE_DEPS_THAN = 4;

/**
 * Enable cache test mode.
 * When enabled, expressions will always be re-evaluated and verified for equality against cached values.
 */
const TEST_CACHING: boolean = false;

export type Params = Map<string, number>;

function valueEq(lhs: Value, rhs: Value): boolean {
  function arrayEq<T>(
    lhs: T[],
    rhs: T[],
    eq?: (l: T, r: T) => boolean
  ): boolean {
    if (lhs.length !== rhs.length) return false;
    if (lhs.some((param, i) => (eq ? !eq(param, rhs[i]) : param !== rhs[i])))
      return false;
    return true;
  }

  function exprEq(lhs: Expr, rhs: Expr): boolean {
    switch (lhs.ty) {
      case "call":
        if (lhs.ty !== rhs.ty) return false;
        if (!arrayEq(lhs.args, rhs.args, exprEq)) return false;
        return exprEq(lhs.func, rhs.func);
      case "die":
        if (lhs.ty !== rhs.ty) return false;
        return lhs.n === rhs.n;
      case "func":
        if (lhs.ty !== rhs.ty) return false;
        if (!arrayEq(lhs.params, rhs.params)) return false;
        return exprEq(lhs.body, rhs.body);
      case "lit":
        if (lhs.ty !== rhs.ty) return false;
        return lhs.lit === rhs.lit;
      case "lvl":
        if (lhs.ty !== rhs.ty) return false;
        return lhs.lvl === rhs.lvl;
      case "name":
        if (lhs.ty !== rhs.ty) return false;
        return lhs.name === rhs.name;
      case "op":
        if (lhs.ty !== rhs.ty) return false;
        if (lhs.op !== rhs.op) return false;
        return exprEq(lhs.lhs, rhs.lhs) && exprEq(lhs.rhs, rhs.rhs);
      case "unop":
        return (
          lhs.ty === rhs.ty && lhs.op === rhs.op && exprEq(lhs.inner, rhs.inner)
        );
    }
  }

  function funcEq(lhs: Func, rhs: Func): boolean {
    if (lhs.params.length !== rhs.params.length) return false;
    if (lhs.params.some((param, i) => param !== rhs.params[i])) return false;
    return exprEq(lhs.body, rhs.body);
  }

  function distrEq(lhs: Distr, rhs: Distr): boolean {
    if (lhs.bins.size !== rhs.bins.size) return false;
    for (const [val, cnt] of lhs.bins.entries()) {
      const rcnt = rhs.bins.get(val);
      if (cnt !== rcnt) return false;
    }
    return true;
  }

  switch (lhs.ty) {
    case "func":
      if (rhs.ty !== lhs.ty) return false;
      return funcEq(lhs, rhs);
    case "distr":
      if (rhs.ty !== lhs.ty) return false;
      return distrEq(lhs, rhs);
  }
}

function dependsOn(expr: Expr): string[] {
  if (expr.deps !== undefined) return expr.deps;
  const deps: string[] = [];
  switch (expr.ty) {
    case "call":
      if (expr.func.ty === "func") {
        deps.push(...dependsOn(expr.func.body));
      }
      for (const arg of expr.args) {
        deps.push(...dependsOn(arg));
      }
      deps.sort();
      return (expr.deps = deps);
    case "name":
      return (expr.deps = [expr.name]);
    case "op":
      deps.push(...dependsOn(expr.lhs));
      deps.push(...dependsOn(expr.rhs));
      deps.sort();
      return (expr.deps = deps);
    case "unop":
      return (expr.deps = dependsOn(expr.inner));
    case "die":
    case "func":
    case "lit":
    case "lvl":
      return [];
  }
}

export class Env {
  #map: Map<string, Value>;

  constructor(from?: Env) {
    if (from == null) {
      this.#map = new Map();
    } else {
      this.#map = new Map(from.#map);
    }
  }

  static fromObject(obj: Record<string, Value>): Env {
    const env = new Env();
    for (const [key, val] of Object.entries(obj)) {
      env.set(key, val);
    }
    return env;
  }

  copy(): Env {
    return new Env(this);
  }

  set(key: string, val: Value) {
    this.#map.set(key, val);
  }

  setNumber(key: string, num: number) {
    this.set(key, distribution.singular(num));
  }

  get(key: string): Value | undefined {
    return this.#map.get(key);
  }

  getNumber(key: string): number | undefined {
    const v = this.#map.get(key);
    if (v?.ty === "distr" && v.bins.size === 1) {
      for (const val of v.bins.keys()) {
        return val;
      }
    }
    return undefined;
  }
}

export interface CallCtx {
  func: Func;
  args: Value[];
  env: Env;
  out: Distr;
  grown: bigint;
}

const STANDARD_ENV: Env = Env.fromObject({});

export class Cache {
  #cached: Map<number, Value>;
  #used: Set<number>;

  constructor() {
    this.#cached = new Map();
    this.#used = new Set();
  }

  static key(expr: Expr, deps: string[], env: Env): number {
    let s = hash.expr(expr);
    s = hash.int32(s, deps.length);
    for (const dep of deps) {
      s = hash.value(s, env.get(dep));
    }
    return s;
  }

  search(key: number): Value | undefined {
    this.#used.add(key);
    return this.#cached.get(key);
  }

  store(key: number, result: Value) {
    this.#cached.set(key, result);
  }

  /**
   * Removes any values from the cached that were not used since the last call to `gc`.
   * This means that calling `gc()` twice will clear the cache (!)
   */
  gc() {
    const oldcnt = this.#cached.size;
    for (const key of this.#cached.keys()) {
      if (!this.#used.has(key)) this.#cached.delete(key);
    }
    this.#used.clear();
    const newcnt = this.#cached.size;
    console.log(`cleaned up ${oldcnt - newcnt} values, ${newcnt} values left`);
  }
}

export class Context {
  globals: Env;
  cache: Cache;

  constructor(cache: Cache) {
    this.globals = STANDARD_ENV.copy();
    this.cache = cache;
  }

  eval(expr: Expr): Value {
    return this.#evalCached(expr, this.globals);
  }

  #evalCached(expr: Expr, env: Env): Value {
    const deps = dependsOn(expr);
    // Do not cache if there are too many dependencies (too expensive to check)
    if (deps.length > SKIP_CACHE_IF_MORE_DEPS_THAN)
      return this.#evalUncached(expr, env);
    // Cache this call
    const key = Cache.key(expr, deps, env);
    const cached = this.cache.search(key);
    if (!TEST_CACHING && cached !== undefined) return cached;
    const result = this.#evalUncached(expr, env);
    if (TEST_CACHING && cached != null && !valueEq(cached, result)) {
      console.error("mismatch between cached and result:", cached, result);
      console.error(
        "on expression",
        expr,
        "with deps",
        deps,
        "and env",
        env,
        ": cache key is",
        key
      );
    }
    this.cache.store(key, result);
    return result;
  }

  #evalUncached(expr: Expr, env: Env): Value {
    switch (expr.ty) {
      case "die":
        return distribution.create(
          [...Array(expr.n)].map((_, idx) => [idx + 1, 1])
        );
      case "lvl":
        const levelVal = env.get("level");
        let level = null;
        if (levelVal && levelVal.ty === "distr" && levelVal.bins.size === 1) {
          for (const val of levelVal.bins.keys()) {
            level = Math.floor(val);
          }
        }
        return distribution.singular(
          level == null ? 0 : Math.max(level - expr.lvl, 0)
        );
      case "lit":
        return distribution.create([[expr.lit, 1]]);
      case "op":
        const lhs = this.#evalCached(expr.lhs, env);
        const rhs = this.#evalCached(expr.rhs, env);
        if (lhs.ty !== "distr" || rhs.ty !== "distr")
          throw `Cannot execute operation ${lhs.ty} ${expr.op} ${rhs.ty}`;
        return binopApply(expr.op, lhs, rhs);
      case "unop":
        // Use evalUncached, because if expr.inner was cacheable, expr would be cacheable too
        const inner = this.#evalUncached(expr.inner, env);
        if (inner.ty !== "distr")
          throw `Cannot execute operation ${expr.op} on ${inner.ty}`;
        return unopApply(expr.op, inner);
      case "name":
        const val = env.get(expr.name);
        if (val === undefined) throw `Undefined name ${expr.name}`;
        return val;
      case "func":
        return expr;
      case "call":
        // Use evalUncached, because functions are usually cheap to evaluate
        const func = this.#evalUncached(expr.func, env);
        if (func.ty !== "func") throw `Attempt to call non-function`;
        const args = expr.args.map((arg) => this.#evalCached(arg, env));
        if (args.length < func.params.length)
          throw `Function expected ${func.params.length} arguments but ${args.length} were supplied`;
        const out: Distr = {
          ty: "distr",
          bins: new Map(),
          total: args.reduce(
            (prod, val) => prod * (val.ty === "distr" ? val.total : BigInt(1)),
            BigInt(1)
          ),
        };
        this.#call(
          { func, args, env: env.copy(), grown: BigInt(1), out },
          0,
          BigInt(1)
        );
        return out;
    }
  }

  #call(ctx: CallCtx, idx: number, weight: bigint): void {
    if (idx >= ctx.args.length) {
      const produced = this.#evalCached(ctx.func.body, ctx.env);
      if (produced.ty !== "distr") throw `Functions can only return numbers`;
      const g = gcd(ctx.grown, produced.total);
      if (g !== produced.total) {
        const by = produced.total / g;
        distribution.grow(ctx.out, by);
        ctx.grown *= by;
      }
      const scale = (weight * ctx.grown) / produced.total;
      for (const [val, cnt] of produced.bins) {
        ctx.out.bins.set(
          val,
          (ctx.out.bins.get(val) ?? BigInt(0)) + cnt * scale
        );
      }
    } else {
      const arg = ctx.args[idx];
      switch (arg.ty) {
        case "func":
          ctx.env.set(ctx.func.params[idx], arg);
          return this.#call(ctx, idx + 1, weight);
        case "distr":
          for (const [val, cnt] of arg.bins) {
            ctx.env.set(ctx.func.params[idx], {
              ty: "distr",
              bins: new Map([[val, BigInt(1)]]),
              total: BigInt(1),
            });
            this.#call(ctx, idx + 1, weight * cnt);
          }
          return;
      }
      // This code is here to ensure that the switch handles all cases
      return arg;
    }
  }
}

function enter(expr: Expr, visit: (expr: Expr) => void): void {
  switch (expr.ty) {
    case "op":
      visit(expr.lhs);
      visit(expr.rhs);
      return;
    case "unop":
      visit(expr.inner);
      return;
    case "call":
      visit(expr.func);
      for (const arg of expr.args) visit(arg);
      return;
    case "func":
      visit(expr.body);
      return;
    case "die":
    case "lit":
    case "name":
    case "lvl":
      return;
    default:
      return expr;
  }
}

function constSingleOperate(op: UnopChar | UnopName, inner: number): number {
  switch (op) {
    case "-":
      return -inner;
    case "floor":
      return Math.floor(inner);
    case "ceil":
      return Math.ceil(inner);
  }
}

function convolve(lhs: Distr, rhs: Distr): Distr {
  const out: Distr = {
    ty: "distr",
    bins: new Map(),
    total: lhs.total * rhs.total,
  };
  for (const [lval, lcnt] of lhs.bins.entries()) {
    for (const [rval, rcnt] of rhs.bins.entries()) {
      const fval = Math.floor(lval + rval);
      out.bins.set(fval, (out.bins.get(fval) ?? BigInt(0)) + lcnt * rcnt);
    }
  }
  return out;
}

function binopApply(op: OpChar | OpName, lhs: Distr, rhs: Distr): Distr {
  if (
    (op === "" || op === "*") &&
    lhs.bins.size > 0 &&
    lhs.bins.keys().every((val) => Math.floor(val) === val && val >= 0) &&
    lhs.bins.keys().some((val) => val >= 2)
  ) {
    // Multiplication with a nonnegative integral left-hand-side is special: it is iterated convolution
    const upTo = Math.max(...lhs.bins.keys());
    const out: Distr = {
      ty: "distr",
      bins: new Map(),
      total: lhs.total * rhs.total ** BigInt(upTo),
    };
    let tmp = distribution.create([[0, 1]]);
    for (let lval = 0; lval <= upTo; lval++) {
      const lcnt = lhs.bins.get(lval);
      if (lcnt !== undefined) {
        const rhsScaleup = rhs.total ** BigInt(upTo - lval);
        for (const [rval, rcnt] of tmp.bins.entries()) {
          out.bins.set(
            rval,
            (out.bins.get(rval) ?? BigInt(0)) + lcnt * rhsScaleup * rcnt
          );
        }
      }
      if (lval < upTo) tmp = convolve(tmp, rhs);
    }
    return out;
  } else {
    const out: Distr = {
      ty: "distr",
      bins: new Map(),
      total: lhs.total * rhs.total,
    };
    for (const [lval, lcnt] of lhs.bins.entries()) {
      for (const [rval, rcnt] of rhs.bins.entries()) {
        const fval = (() => {
          switch (op) {
            case "":
            case "*":
              return Math.floor(lval * rval);
            case "+":
              return lval + rval;
            case "-":
              return lval - rval;
            case "/":
              return Math.floor(lval / rval);
            case "^":
              return lval ** rval;
            case "<":
              return lval < rval ? 1 : 0;
            case ">":
              return lval > rval ? 1 : 0;
            case "<=":
              return lval <= rval ? 1 : 0;
            case ">=":
              return lval >= rval ? 1 : 0;
            case "!=":
              return lval !== rval ? 1 : 0;
            case "==":
              return lval === rval ? 1 : 0;
            case "max":
              return Math.max(lval, rval);
            case "min":
              return Math.min(lval, rval);
          }
        })();
        out.bins.set(fval, (out.bins.get(fval) ?? BigInt(0)) + lcnt * rcnt);
      }
    }
    return out;
  }
}

function unopApply(op: UnopChar | UnopName, inner: Distr): Distr {
  const out: Distr = {
    ty: "distr",
    bins: new Map(),
    total: inner.total,
  };
  for (const [ival, icnt] of inner.bins.entries()) {
    const fval = constSingleOperate(op, ival);
    out.bins.set(fval, (out.bins.get(fval) ?? BigInt(0)) + icnt);
  }
  return out;
}

function extractReferences(expr: Expr, out: string[]) {
  if (expr.ty === "name") out.push(expr.name);
  enter(expr, (subexpr) => extractReferences(subexpr, out));
}

export function getReferences(expr: Expr): string[] {
  const out: string[] = [];
  extractReferences(expr, out);
  return out;
}

export function getLevel(expr: Expr): number | null {
  let lvl: number | null = null;
  if (expr.ty === "lvl") lvl = expr.lvl;
  enter(expr, (subexpr) => {
    const sublvl = getLevel(subexpr);
    if (sublvl !== null && (lvl === null || sublvl > lvl)) lvl = sublvl;
  });
  return lvl;
}
