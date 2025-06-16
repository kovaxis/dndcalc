import type { Expr, Func, Value } from "./ast";
import type { Distr } from "./distribution";

function hashInt(s: number, int: number): number {
  s |= 0;
  int |= 0;
  // fxhash
  return (
    Number(
      (BigInt(((s << 5) | (s >>> 27)) ^ int) * 0x27220a95n) & 0xffffffffn
    ) | 0
  );
  // Maybe use this to avoid bigints? (based on xoroshiro64*)
  // int ^= s;
  // return ((s << 26) | (s >>> (32 - 26))) ^ int ^ (int << 9);
}

function hashNumber(s: number, num: number): number {
  const float = new Float64Array(1);
  float[0] = num;
  const ints = new Uint32Array(float.buffer);
  s = hashInt(s, ints[0]);
  s = hashInt(s, ints[1]);
  return s;
}

function hashDistr(s: number, distr: Distr): number {
  // Hash number of bins
  s = hashInt(s, distr.bins.size);
  // Hash bins themselves
  for (const [val, cnt] of distr.bins.entries()) {
    // Hash value
    s = hashNumber(s, val);
    // Hash count
    let cntTemp = cnt;
    let cntSize = 0;
    while (cntTemp) {
      const MASK = 0xffffffffn;
      s = hashInt(s, Number(cntTemp & MASK));
      cntTemp >>= 32n;
      cntSize += 1;
    }
    s = hashInt(s, cntSize);
  }
  return s;
}

function hashString(s: number, str: string): number {
  s = hashInt(s, str.length);
  for (const char of str) {
    s = hashInt(s, char.codePointAt(0) ?? 0);
  }
  return s;
}

function hashExpr(expr: Expr): number {
  if (expr.hash !== undefined) return expr.hash;
  let s: number | null = null;
  switch (expr.ty) {
    case "call":
      s = hashInt(0, 4351);
      s = hashInt(s, expr.args.length);
      for (const arg of expr.args) {
        s = hashInt(s, hashExpr(arg));
      }
      s = hashInt(s, hashExpr(expr.func));
      break;
    case "die":
      s = hashInt(0, 7354);
      s = hashInt(s, expr.n);
      break;
    case "func":
      s = hashInt(0, 3842);
      s = hashFunc(s, expr);
      break;
    case "lit":
      s = hashInt(0, 6381);
      s = hashNumber(s, expr.lit);
      break;
    case "lvl":
      s = hashInt(0, 3741);
      s = hashInt(s, expr.lvl);
      break;
    case "name":
      s = hashInt(0, 7834);
      s = hashString(s, expr.name);
      break;
    case "op":
      s = hashInt(0, 9815);
      s = hashString(s, expr.op);
      s = hashInt(s, hashExpr(expr.lhs));
      s = hashInt(s, hashExpr(expr.rhs));
      break;
    case "unop":
      s = hashInt(0, 6781);
      s = hashString(s, expr.op);
      s = hashInt(s, hashExpr(expr.inner));
      break;
  }
  return (expr.hash = s);
}

function hashFunc(s: number, func: Func): number {
  s = hashInt(s, func.params.length);
  for (const param of func.params) {
    s = hashString(s, param);
  }
  s = hashInt(s, hashExpr(func.body));
  return s;
}

function hashValue(s: number, val: Value | undefined): number {
  if (val === undefined) return hashInt(s, 4231);
  switch (val.ty) {
    case "distr":
      s = hashInt(s, 8123);
      return hashDistr(s, val);
    case "func":
      s = hashInt(s, 1592);
      return hashFunc(s, val);
  }
}

export {
  hashInt as int32,
  hashNumber as number,
  hashString as string,
  hashDistr as distr,
  hashValue as value,
  hashExpr as expr,
  hashFunc as func,
};
