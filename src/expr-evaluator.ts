/**
 * Expression Evaluator
 *
 * Evaluates an expression AST (produced by the Nearley grammar in ma6.ne)
 * against the current symbol table. There is intentionally no string parsing
 * here: the only parser in the assembler is the Nearley grammar, and this
 * module consumes the AST it produces. All arithmetic is performed modulo
 * 2**16 (expressions are 16-bit unsigned, 0..65535), matching docs/README.md.
 */

import type { ExprNode, SymbolTable } from "./assembler-types.js";

export interface EvalResult {
  value: number;
  success: boolean;
  error?: string;
}

const WORD = 0xffff;

/**
 * Evaluate an expression AST node.
 *
 *   { t: "num", v }            -> literal
 *   { t: "sym", name }         -> symbol lookup (constant value or label address)
 *   { t: "pc" }                -> current program counter ("*")
 *   { t: "un",  op, e }        -> unary operator
 *   { t: "bin", op, l, r }     -> binary operator
 */
export function evaluateExpression(
  node: ExprNode | undefined,
  symbolTable: SymbolTable,
  currentPC?: number,
): EvalResult {
  if (!node) {
    return { value: 0, success: false, error: "Empty expression" };
  }
  try {
    return {
      value: evalNode(node, symbolTable, currentPC) & WORD,
      success: true,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { value: 0, success: false, error: msg };
  }
}

function evalNode(
  node: ExprNode,
  symbols: SymbolTable,
  pc: number | undefined,
): number {
  switch (node.t) {
    case "num":
      return node.v & WORD;

    case "pc":
      return (pc ?? 0) & WORD;

    case "sym": {
      const symbol = symbols.get(node.name);
      if (!symbol) {
        throw new Error(`Undefined symbol: ${node.name}`);
      }
      const val = symbol.value ?? symbol.address;
      if (typeof val === "number") {
        return val & WORD;
      }
      throw new Error(`Symbol ${node.name} has no numeric value`);
    }

    case "un": {
      const e = evalNode(node.e, symbols, pc);
      switch (node.op) {
        case "-":
          return -e & WORD;
        case "~":
          return ~e & WORD;
        case "!":
          return e === 0 ? 1 : 0;
        case "<":
          return e & 0xff; // low byte
        case ">":
          return (e >> 8) & 0xff; // high byte
        default:
          throw new Error(`Unknown unary operator: ${node.op}`);
      }
    }

    case "bin": {
      const l = evalNode(node.l, symbols, pc);
      const r = evalNode(node.r, symbols, pc);
      switch (node.op) {
        case "+":
          return (l + r) & WORD;
        case "-":
          return (l - r) & WORD;
        case "*":
          return (l * r) & WORD;
        case "/":
          if (r === 0) throw new Error("Division by zero");
          return Math.floor(l / r) & WORD;
        case "%":
          if (r === 0) throw new Error("Division by zero");
          return (l % r) & WORD;
        case "&":
          return l & r & WORD;
        case "|":
          return (l | r) & WORD;
        case "^":
          return (l ^ r) & WORD;
        case "==":
          return l === r ? 1 : 0;
        case "!=":
          return l !== r ? 1 : 0;
        case "<":
          return l < r ? 1 : 0;
        case ">":
          return l > r ? 1 : 0;
        case "<=":
          return l <= r ? 1 : 0;
        case ">=":
          return l >= r ? 1 : 0;
        default:
          throw new Error(`Unknown binary operator: ${node.op}`);
      }
    }
  }
}

/**
 * Render an expression AST back to a human-readable string. Used only for
 * diagnostics and memoization display (never for evaluation).
 */
export function unparseExpr(node: ExprNode | undefined): string {
  if (!node) {
    return "";
  }
  switch (node.t) {
    case "num":
      return String(node.v);
    case "pc":
      return "*";
    case "sym":
      return node.name;
    case "un":
      return `${node.op}${unparseExpr(node.e)}`;
    case "bin":
      return `(${unparseExpr(node.l)} ${node.op} ${unparseExpr(node.r)})`;
  }
}
