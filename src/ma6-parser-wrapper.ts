/**
 * 6502 Assembly Language Parser (Nearley version)
 * Generated from ma6.ne grammar
 *
 * Usage:
 *   1. Compile grammar: nearleyc src/ma6.ne -o src/ma6-parser-generated.ts
 *   2. Import: import { parseAssemblyLine } from './ma6-parser-wrapper'
 *   3. Parse: const result = parseAssemblyLine(input)
 */

import { lexer } from "./ma6-lexer-moo.js";
import grammar from "./generated/ma6-parser-generated.js";
import moo from "moo";
import nearley, { Grammar } from "nearley";
const { Parser } = nearley;

export interface ParseResult {
  ast: any;
  errors: string[];
  input: string;
  line: number;
}

export interface ParserOptions {
  lexer?: moo.Lexer;
  throwOnError?: boolean;
}

/**
 * Create a new Nearley parser instance
 */
function createParser(): InstanceType<typeof Parser> {
  // @ts-ignore: Nearley grammar has `any` type
  const parser = new Parser(Grammar.fromCompiled(grammar), {
    keepHistory: true,
    lexer: undefined,
  });
  return parser;
}

/**
 * Parse a single assembly language line
 * @param input Assembly code line
 * @param options Parser options
 * @returns Parse result with AST and errors
 */
export function parseAssemblyLine(
  input: string,
  options: ParserOptions = {},
): ParseResult {
  const parser = createParser();
  const useLexer = options.lexer || lexer;
  const errors: string[] = [];

  try {
    useLexer.reset(input);

    let token = useLexer.next();
    while (token) {
      try {
        // @ts-ignore: Moo tokens are compatible with Nearley feed method at runtime
        parser.feed(token);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Token error at position ${token.offset}: ${msg}`);
        if (options.throwOnError) throw e;
      }
      token = useLexer.next();
    }

    const results = parser.finish();

    if (results.length === 0) {
      errors.push(`No valid parse for: "${input}"`);
      return { ast: null, errors, input, line: 1 };
    }

    // Return first (most likely) parse result
    return {
      ast: results[0],
      errors,
      input,
      line: 1,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(message);

    if (options.throwOnError) {
      throw err;
    }

    return { ast: null, errors, input, line: 1 };
  }
}

/**
 * Parse multiple lines of assembly code
 * @param lines Array of assembly code lines
 * @param options Parser options
 * @returns Array of parse results
 */
export function parseAssemblyLines(
  lines: string[],
  options: ParserOptions = {},
): ParseResult[] {
  return lines.map((line, idx) => {
    const result = parseAssemblyLine(line, options);
    result.line = idx + 1;
    return result;
  });
}

/**
 * Parse complete assembly file content
 * @param content Full file content
 * @param options Parser options
 * @returns Array of parse results (one per line)
 */
export function parseAssemblyFile(
  content: string,
  options: ParserOptions = {},
): ParseResult[] {
  const lines = content.split(/\r?\n/);
  return parseAssemblyLines(lines, options);
}

// Export parser factory for advanced usage
export { createParser };
