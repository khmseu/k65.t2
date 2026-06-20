/**
 * Expression reconstructor: convert ExprNode AST back to canonical text form.
 * Produces normalized expressions with spaces around operators for consistency.
 */

import type { ExprNode } from "../assembler-types.js";

/**
 * Binding strength of each binary operator, matching the grammar's precedence
 * ladder (orExpr < xorExpr < andExpr < eqExpr < relExpr < addExpr < mulExpr).
 * Higher numbers bind tighter. All binary operators are left-associative.
 */
const BIN_PRECEDENCE: Readonly<Record<string, number>> = {
  "|": 1,
  "^": 2,
  "&": 3,
  "==": 4,
  "!=": 4,
  "<": 5,
  ">": 5,
  "<=": 5,
  ">=": 5,
  "+": 6,
  "-": 6,
  "*": 7,
  "/": 7,
  "%": 7,
};

/** Unary operators bind tighter than every binary operator. */
const UNARY_PRECEDENCE = 8;
/** Atoms (numbers, symbols, `*`, parenthesized groups) never need parens. */
const ATOM_PRECEDENCE = 9;

/** Precedence of a node as it appears when nested inside another expression. */
function precedenceOf(expr: ExprNode): number {
  if (expr.t === "bin") {
    return BIN_PRECEDENCE[expr.op] ?? 0;
  }
  if (expr.t === "un") {
    return UNARY_PRECEDENCE;
  }
  return ATOM_PRECEDENCE;
}

/**
 * Convert an expression AST node to its canonical text representation.
 * Normalizes to add spaces around binary operators for readability, and adds
 * parentheses only where required to preserve the parse tree. The grouping in
 * the source is not recorded in the AST, so emitting parentheses around every
 * binary node would (a) invent grouping the author never wrote and (b) corrupt
 * addressing modes: `BUF-4,Y` (absolute,Y) would become `(BUF - 4),Y`, which a
 * 6502 assembler reads as the indirect-indexed mode.
 */
export function reconstructExpression(expr: ExprNode): string {
  if (expr.t === "num") {
    // Prefer the original literal text so the author's chosen base/form (hex,
    // octal, decimal, char) is preserved rather than re-based.
    if (expr.raw !== undefined && expr.raw !== "") {
      return expr.raw;
    }
    // Fallback (synthesized nodes with no source text): format as hex if
    // >= 256, else decimal.
    const v = expr.v;
    if (v >= 256 || v < 0) {
      return `$${v.toString(16).toUpperCase().padStart(4, "0")}`;
    }
    return v.toString(10);
  }

  if (expr.t === "sym") {
    // Symbol reference: preserve the leading backslash for `\IDENT`
    // macro-parameter references.
    return expr.escaped ? `\\${expr.name}` : expr.name;
  }

  if (expr.t === "pc") {
    // Program counter: *
    return "*";
  }

  if (expr.t === "bin") {
    // Binary operation: normalize spacing, parenthesizing a child only when its
    // operator binds more loosely than this one. Because the operators are
    // left-associative, an equal-precedence child needs parentheses only on the
    // right (e.g. `A - (B - C)`), never on the left (`A - B - C`).
    const prec = BIN_PRECEDENCE[expr.op] ?? 0;
    const left = wrapIfNeeded(expr.l, precedenceOf(expr.l) < prec);
    const right = wrapIfNeeded(expr.r, precedenceOf(expr.r) <= prec);
    return `${left} ${expr.op} ${right}`;
  }

  if (expr.t === "un") {
    // Unary operation: parenthesize the operand only when it binds more loosely
    // than the unary operator (i.e. any binary sub-expression).
    const wrap = precedenceOf(expr.e) < UNARY_PRECEDENCE;
    return `${expr.op}${wrapIfNeeded(expr.e, wrap)}`;
  }

  // Fallback (should not reach)
  return "???";
}

/** Reconstruct `expr`, wrapping it in parentheses when `needed` is true. */
function wrapIfNeeded(expr: ExprNode, needed: boolean): string {
  const text = reconstructExpression(expr);
  return needed ? `(${text})` : text;
}
