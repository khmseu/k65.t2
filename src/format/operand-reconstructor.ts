/**
 * Operand reconstructor: convert OperandNode AST back to addressing-mode text.
 */

import type { OperandNode } from "../assembler-types.js";
import { reconstructExpression } from "./expr-reconstructor.js";

/**
 * Convert an operand AST node to its text representation, respecting 6502 addressing modes.
 */
export function reconstructOperand(operand: OperandNode): string {
  if (!operand.expr) {
    // Accumulator mode: just "A"
    return "A";
  }

  const exprText = reconstructExpression(operand.expr);

  switch (operand.mode) {
    case "accumulator":
      return "A";

    case "immediate":
      // Immediate: #expr
      return `#${exprText}`;

    case "indirectX":
      // Indirect X: (expr,X)
      return `(${exprText},X)`;

    case "indirectY":
      // Indirect Y: (expr),Y
      return `(${exprText}),Y`;

    case "indirect":
      // Indirect: (expr)
      return `(${exprText})`;

    case "indexedX":
      // Indexed X: expr,X
      return `${exprText},X`;

    case "indexedY":
      // Indexed Y: expr,Y
      return `${exprText},Y`;

    case "absolute":
    default:
      // Absolute: just expr
      return exprText;
  }
}
