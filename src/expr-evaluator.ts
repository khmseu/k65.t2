/**
 * Expression Evaluator
 * Evaluates assembly expressions (.if conditions, .repeat counts, .equ values, etc.)
 * Reuses the existing parser for syntax and integrates with symbol table
 */

import { SymbolTable } from "./assembler-types.js";

export interface EvalResult {
  value: number;
  success: boolean;
  error?: string;
}

/**
 * Evaluate an expression using the current symbol table
 * Supports: literals, symbols, arithmetic operators, comparisons
 *
 * Examples:
 *   "42" -> { value: 42, success: true }
 *   "MYVAR + 1" -> { value: <MYVAR>+1, success: true }
 *   "0x1000" -> { value: 4096, success: true }
 *   "0o40000" -> { value: 16384, success: true }
 *   "(REALIO) == 0" -> { value: 1 or 0, success: true }
 *   "UNDEFINED" -> { value: 0, success: false, error: "Undefined symbol" }
 */
export function evaluateExpression(
  expr: string,
  symbolTable: SymbolTable,
): EvalResult {
  try {
    const trimmed = expr.trim();
    if (!trimmed) {
      return { value: 0, success: false, error: "Empty expression" };
    }

    // Try to tokenize and evaluate
    const tokens = tokenize(trimmed);
    const result = evaluateTokens(tokens, symbolTable);
    if (!result) {
      return {
        value: 0,
        success: false,
        error: "Internal error: no result from evaluateTokens",
      };
    }
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      value: 0,
      success: false,
      error: `Expression evaluation failed: ${msg}`,
    };
  }
}

interface Token {
  type: "number" | "symbol" | "operator" | "lparen" | "rparen";
  value: string | number;
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const c = expr[i]!;

    // Whitespace
    if (/\s/.test(c)) {
      i++;
      continue;
    }

    // Parentheses
    if (c === "(") {
      tokens.push({ type: "lparen", value: "(" });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ type: "rparen", value: ")" });
      i++;
      continue;
    }

    // Operators (two-char first)
    if (i + 1 < expr.length) {
      const twoChar = expr.slice(i, i + 2);
      if (["==", "!=", "<=", ">=", "<>", "<<", ">>"].includes(twoChar)) {
        tokens.push({ type: "operator", value: twoChar });
        i += 2;
        continue;
      }
    }

    // Single-char operators
    if ("+-*/%&|^<>!~=".includes(c)) {
      tokens.push({ type: "operator", value: c });
      i++;
      continue;
    }

    // Numbers (hex, octal, decimal)
    if (
      /\d/.test(c) ||
      (c === "0" && i + 1 < expr.length && /[xo]/i.test(expr[i + 1]!))
    ) {
      const numStr = consumeNumber(expr, i);
      const num = parseNumber(numStr);
      tokens.push({ type: "number", value: num });
      i += numStr.length;
      continue;
    }

    // Symbols and identifiers
    if (/[a-zA-Z_$@]/.test(c)) {
      const symbolStr = consumeSymbol(expr, i);
      tokens.push({ type: "symbol", value: symbolStr });
      i += symbolStr.length;
      continue;
    }

    throw new Error(`Unexpected character '${c}' at position ${i}`);
  }

  return tokens;
}

function consumeNumber(expr: string, start: number): string {
  let i = start;

  // Hex: 0x[0-9A-Fa-f]+
  if (
    i < expr.length &&
    expr[i]! === "0" &&
    i + 1 < expr.length &&
    /[xX]/.test(expr[i + 1]!)
  ) {
    i += 2;
    while (i < expr.length && /[0-9A-Fa-f]/.test(expr[i]!)) {
      i++;
    }
    return expr.slice(start, i);
  }

  // Octal: 0o[0-7]+ or 0O[0-7]+
  if (
    i < expr.length &&
    expr[i]! === "0" &&
    i + 1 < expr.length &&
    /[oO]/.test(expr[i + 1]!)
  ) {
    i += 2;
    while (i < expr.length && /[0-7]/.test(expr[i]!)) {
      i++;
    }
    return expr.slice(start, i);
  }

  // Decimal: [0-9]+
  while (i < expr.length && /[0-9]/.test(expr[i]!)) {
    i++;
  }
  return expr.slice(start, i);
}

function consumeSymbol(expr: string, start: number): string {
  let i = start;
  while (i < expr.length && /[a-zA-Z0-9_$@.]/.test(expr[i]!)) {
    i++;
  }
  return expr.slice(start, i);
}

function parseNumber(s: string): number {
  if (s.startsWith("0x") || s.startsWith("0X")) {
    return parseInt(s.slice(2), 16);
  }
  if (s.startsWith("0o") || s.startsWith("0O")) {
    return parseInt(s.slice(2), 8);
  }
  return parseInt(s, 10);
}

/**
 * Simple recursive descent expression evaluator
 * Respects operator precedence:
 *   1. Parentheses
 *   2. Unary operators (~, !)
 *   3. Multiplicative (*, /, %)
 *   4. Additive (+, -)
 *   5. Bitwise shifts (<<, >>)
 *   6. Relational (<, >, <=, >=)
 *   7. Equality (==, !=, <>)
 *   8. Bitwise AND (&)
 *   9. Bitwise XOR (^)
 *  10. Bitwise OR (|)
 */

class Evaluator {
  tokens: Token[];
  pos: number = 0;
  symbolTable: SymbolTable;

  constructor(tokens: Token[], symbolTable: SymbolTable) {
    this.tokens = tokens;
    this.symbolTable = symbolTable;
  }

  private peek(): Token | undefined {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : undefined;
  }

  private consume(): Token | undefined {
    return this.pos < this.tokens.length ? this.tokens[this.pos++] : undefined;
  }

  private expect(type: string): Token {
    const token = this.consume();
    if (!token || token.type !== type) {
      throw new Error(`Expected ${type}, got ${token?.type || "EOF"}`);
    }
    return token;
  }

  evaluate(): number {
    const result = this.parseOr();
    if (this.peek()) {
      throw new Error(`Unexpected token at end: ${this.peek()?.value}`);
    }
    return result;
  }

  private parseOr(): number {
    let left = this.parseXor();
    while (this.peek()?.type === "operator" && this.peek()?.value === "|") {
      this.consume();
      const right = this.parseXor();
      left = left | right;
    }
    return left;
  }

  private parseXor(): number {
    let left = this.parseAnd();
    while (this.peek()?.type === "operator" && this.peek()?.value === "^") {
      this.consume();
      const right = this.parseAnd();
      left = left ^ right;
    }
    return left;
  }

  private parseAnd(): number {
    let left = this.parseEquality();
    while (this.peek()?.type === "operator" && this.peek()?.value === "&") {
      this.consume();
      const right = this.parseEquality();
      left = left & right;
    }
    return left;
  }

  private parseEquality(): number {
    let left = this.parseRelational();
    while (true) {
      const peekToken = this.peek();
      if (
        !peekToken ||
        peekToken.type !== "operator" ||
        typeof peekToken.value !== "string" ||
        !["==", "!=", "<>", "="].includes(peekToken.value)
      ) {
        break;
      }
      const op = this.consume()!.value as string;
      const right = this.parseRelational();
      if (op === "==" || op === "=") {
        left = left === right ? 1 : 0;
      } else if (op === "!=" || op === "<>") {
        left = left !== right ? 1 : 0;
      }
    }
    return left;
  }

  private parseRelational(): number {
    let left = this.parseShift();
    while (true) {
      const peekToken = this.peek();
      if (
        !peekToken ||
        peekToken.type !== "operator" ||
        typeof peekToken.value !== "string" ||
        !["<", ">", "<=", ">="].includes(peekToken.value)
      ) {
        break;
      }
      const op = this.consume()!.value as string;
      const right = this.parseShift();
      if (op === "<") {
        left = left < right ? 1 : 0;
      } else if (op === ">") {
        left = left > right ? 1 : 0;
      } else if (op === "<=") {
        left = left <= right ? 1 : 0;
      } else if (op === ">=") {
        left = left >= right ? 1 : 0;
      }
    }
    return left;
  }

  private parseShift(): number {
    let left = this.parseAdditive();
    while (true) {
      const peekToken = this.peek();
      if (
        !peekToken ||
        peekToken.type !== "operator" ||
        typeof peekToken.value !== "string" ||
        !["<<", ">>"].includes(peekToken.value)
      ) {
        break;
      }
      const op = this.consume()!.value as string;
      const right = this.parseAdditive();
      if (op === "<<") {
        left = left << right;
      } else if (op === ">>") {
        left = left >> right;
      }
    }
    return left;
  }

  private parseAdditive(): number {
    let left = this.parseMultiplicative();
    let peekToken = this.peek();
    while (
      peekToken?.type === "operator" &&
      typeof peekToken?.value === "string" &&
      ["+", "-"].includes(peekToken.value)
    ) {
      const op = this.consume()!.value as string;
      const right = this.parseMultiplicative();
      if (op === "+") {
        left = left + right;
      } else if (op === "-") {
        left = left - right;
      }
      peekToken = this.peek();
    }
    return left;
  }

  private parseMultiplicative(): number {
    let left = this.parseUnary();
    let peekToken = this.peek();
    while (
      peekToken?.type === "operator" &&
      typeof peekToken?.value === "string" &&
      ["*", "/", "%"].includes(peekToken.value)
    ) {
      const op = this.consume()!.value as string;
      const right = this.parseUnary();
      if (op === "*") {
        left = left * right;
      } else if (op === "/") {
        if (right === 0) throw new Error("Division by zero");
        left = Math.floor(left / right);
      } else if (op === "%") {
        if (right === 0) throw new Error("Division by zero");
        left = left % right;
      }
      peekToken = this.peek();
    }
    return left;
  }

  private parseUnary(): number {
    const peek = this.peek();
    if (
      peek?.type === "operator" &&
      typeof peek?.value === "string" &&
      ["~", "!"].includes(peek.value)
    ) {
      const op = this.consume()!.value as string;
      const val = this.parseUnary();
      if (op === "~") {
        return ~val;
      } else if (op === "!") {
        return val === 0 ? 1 : 0;
      }
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const token = this.peek();
    if (!token) {
      throw new Error("Unexpected end of expression");
    }

    if (token.type === "number") {
      this.consume();
      return token.value as number;
    }

    if (token.type === "symbol") {
      this.consume();
      const symbolName = token.value as string;
      const symbol = this.symbolTable.get(symbolName);
      if (!symbol) {
        throw new Error(`Undefined symbol: ${symbolName}`);
      }
      if (symbol.type === "constant" || symbol.type === "label") {
        const val = symbol.value ?? symbol.address;
        if (typeof val === "number") {
          return val;
        }
        throw new Error(`Symbol ${symbolName} is not a numeric constant`);
      }
      throw new Error(`Symbol ${symbolName} is not a constant or label`);
    }

    if (token.type === "lparen") {
      this.consume();
      const val = this.parseOr();
      this.expect("rparen");
      return val;
    }

    throw new Error(`Unexpected token: ${token.type} = ${token.value}`);
  }
}

function evaluateTokens(tokens: Token[], symbolTable: SymbolTable): EvalResult {
  try {
    const evaluator = new Evaluator(tokens, symbolTable);
    const value = evaluator.evaluate();
    return { value, success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { value: 0, success: false, error: msg };
  }
}
