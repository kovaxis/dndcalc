import {
  OP_CHARS,
  OP_NAMES,
  UNOP_CHARS,
  type CoreExpr,
  type Expr,
  type OpChar,
  type OpName,
  type UnopChar,
} from "./ast";

class Parser {
  lineNum?: number;
  startChar?: number;

  src: string;
  i: number;

  constructor(src: string, lineNum?: number, startChar?: number) {
    this.lineNum = lineNum;
    this.startChar = startChar;

    this.src = src;
    this.i = 0;
  }

  next(): string | undefined {
    const s = this.src[this.i];
    this.i += 1;
    return s;
  }

  char(): string {
    const s = this.next();
    if (s === undefined) throw "Unexpected end of line";
    return s;
  }

  peek(far?: number): string | undefined {
    return this.src[this.i + (far ?? 0)];
  }

  trim() {
    while (this.peek()?.match(/\s/)) this.i += 1;
  }

  spanify(expr: CoreExpr, start: number, end?: number): Expr {
    if (this.lineNum == null || this.startChar == null) return expr;
    end = end ?? this.i;
    return {
      ...expr,
      line: this.lineNum,
      char: this.startChar + start,
      span: end - start,
    };
  }

  extend(expr: CoreExpr, base: Expr, end?: number): Expr {
    if (this.startChar == null || base.char == null) return expr;
    end = end ?? this.i;
    return {
      ...expr,
      line: base.line,
      char: base.char,
      span: this.startChar + end - base.char,
    };
  }

  atom(): Expr {
    this.trim();
    const start = this.i;
    const first = this.char();
    if (first === "(") {
      const sub = this.expr();
      const close = this.next();
      if (close !== ")") throw "Unclosed parenthesis";
      return sub;
    } else if (first in UNOP_CHARS) {
      const unop = first as UnopChar;
      const inner = this.expr(UNOP_CHARS[unop] + 1);
      return this.spanify({ ty: "unop", op: unop, inner }, start);
    } else if (first.match(/[0-9.]/)) {
      let lit = first;
      while (this.peek()?.match(/[0-9]/)) lit += this.char();
      if (this.peek() === ".") lit += this.char();
      while (this.peek()?.match(/[0-9]/)) lit += this.char();
      const num = parseFloat(lit);
      if (isNaN(num)) throw `Invalid numeric literal "${lit}"`;
      return this.spanify({ ty: "lit", lit: num }, start);
    } else if (first.match(/[a-zA-Z_]/)) {
      let name = first;
      while (this.peek()?.match(/[a-zA-Z_0-9]/)) name += this.char();
      name = name.toLowerCase();
      const isDie = name.match(/^d([1-9][0-9]*)$/);
      const isLvl = name.match(/^lvl([1-9][0-9]*)$/);
      const isBinop = (OP_NAMES as readonly string[]).includes(name);
      if (isDie) {
        const [, n] = isDie;
        return this.spanify({ ty: "die", n: parseInt(n) }, start);
      } else if (isLvl) {
        const [, lvl] = isLvl;
        this.trim();
        let expr: Expr = { ty: "lvl", lvl: parseInt(lvl) };
        if (this.peek() === "[") {
          this.char();
          expr = this.extend(
            { ty: "op", op: "+", lhs: this.expr(), rhs: expr },
            expr
          );
          const close = this.char();
          if (close !== "]") throw `Expected closing square bracket`;
        }
        return expr;
      } else if (isBinop) {
        const op = name as OpName;
        let expr: Expr | null = null;
        while (this.peek() === "[") {
          this.char();
          const subexpr = this.expr();
          if (expr == null) expr = subexpr;
          else
            expr = this.spanify(
              { ty: "op", op: op, lhs: expr, rhs: subexpr },
              start
            );
          const close = this.char();
          if (close !== "]") throw `Expected closing square bracket`;
        }
        if (expr == null) throw `Operator ${op} expects arguments`;
        return expr;
      } else if (name === "fn") {
        const params: string[] = [];
        while (true) {
          this.trim();
          let name = this.next();
          if (name === "{") break;
          if (!name?.match(/[a-zA-Z_]/)) throw "Expected function parameters";
          while (this.peek()?.match(/[a-zA-Z_0-9]/)) name += this.char();
          params.push(name);
        }
        const body = this.expr();
        const close = this.char();
        if (close !== "}") throw `Function body does not close`;
        return this.spanify({ ty: "func", params, body: body }, start);
      } else {
        return this.spanify({ ty: "name", name }, start);
      }
    } else {
      throw `Unexpected character ${first}`;
    }
  }

  operator(): OpChar | "[" | null {
    this.trim();
    let bigop = this.peek();
    if (bigop === undefined) return null;
    if (bigop.match(/[a-zA-Z0-9(]/)) return "";
    if (bigop === "[") return "[";
    bigop += this.peek(1) ?? "";
    if (bigop.length >= 2 && bigop.slice(0, 2) in OP_CHARS)
      return bigop.slice(0, 2) as OpChar;
    else if (bigop.length >= 1 && bigop.slice(0, 1) in OP_CHARS)
      return bigop.slice(0, 1) as OpChar;
    else return null;
  }

  expr(precedence?: number): Expr {
    precedence = precedence ?? 0;
    let expr: Expr = this.atom();
    while (true) {
      const op = this.operator();
      if (op == null) break;
      else if (op === "[") {
        // Function call
        // Calls have the highest precedence, so we don't have to worry about that
        const args: Expr[] = [];
        while (this.peek() === "[") {
          this.next();
          args.push(this.expr());
          const close = this.next();
          if (close !== "]") throw "Unclosed square bracket";
        }
        expr = this.extend({ ty: "call", func: expr, args }, expr);
      } else {
        // A binary operator
        const [opPrec, opAssoc] = OP_CHARS[op];
        if (opPrec < precedence) {
          break;
        } else {
          for (let i = 0; i < op.length; i++) this.next();
          const rhs = this.expr(opPrec + (opAssoc === "l" ? 1 : 0));
          expr = this.extend({ ty: "op", op, lhs: expr, rhs }, expr);
        }
      }
    }
    return expr;
  }
}

export function parse(raw: string, lineNum?: number, startChar?: number): Expr {
  const parser = new Parser(raw, lineNum, startChar);
  const expr = parser.expr();
  if (parser.peek() !== undefined) throw `Too many closing parenthesis`;
  return expr;
}
