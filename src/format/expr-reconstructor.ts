/**
 * Expression reconstructor: convert ExprNode AST back to canonical text form.
 * Produces normalized expressions with spaces around operators for consistency.
 */

import type { ExprNode } from "../assembler-types.js";

/**
 * Convert an expression AST node to its canonical text representation.
 * Normalizes to add spaces around binary operators for readability.
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
    // Binary operation: normalize with spaces around operator
    const left = reconstructExpression(expr.l);
    const right = reconstructExpression(expr.r);
    const op = expr.op;
    return `(${left} ${op} ${right})`;
  }

  if (expr.t === "un") {
    // Unary operation: operator + operand
    const operand = reconstructExpression(expr.e);
    const op = expr.op;
    return `${op}(${operand})`;
  }

  // Fallback (should not reach)
  return "???";
}
