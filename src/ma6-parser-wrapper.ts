/**
 * 6502 Assembly Language Parser (Nearley version)
 * Generated from ma6.ne grammar
 *
 * Usage:
 *   1. Compile grammar: nearleyc src/ma6.ne -o src/ma6-parser-generated.ts
 *   2. Import: import { parser, lexer } from './ma6-parser-wrapper'
 *   3. Parse: const ast = parser.parse(input, { lexer })
 */

import lexer from "./ma6-lexer-moo.js";

// Import the generated parser from Nearley
// NOTE: Run `nearleyc src/ma6.ne -o src/ma6-parser-generated.ts` first
import nearleyParser from "./ma6-parser-generated.js";

export interface ParseResult {
  ast: any;
  errors: string[];
  input: string;
  line: number;
}

export interface ParserOptions {
  lexer?: any;
  throwOnError?: boolean;
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
  const parser = nearleyParser;
  const useLexer = options.lexer || lexer;
  const errors: string[] = [];

  try {
    useLexer.reset();
    useLexer.setText(input);
    const result = parser.feed(useLexer);

    if (result.length === 0) {
      errors.push(`No valid parse for: "${input}"`);
      return { ast: null, errors, input, line: 1 };
    }

    // Return first (most likely) parse result
    return {
      ast: result[0],
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

// Export lexer for direct use
export { lexer };

// Export parser for advanced usage
export { nearleyParser as parser };
