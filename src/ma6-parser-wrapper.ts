/**
 * 6502 Assembly Language Parser (Nearley version)
 * Generated from ma6.ne grammar
 *
 * Usage:
 *   1. Compile grammar: nearleyc src/ma6.ne -o src/ma6-parser-generated.ts
 *   2. Import: import { parseAssemblyLine } from './ma6-parser-wrapper'
 *   3. Parse: const result = parseAssemblyLine(input)
 */

import lexer from "./ma6-lexer-moo.js";
import grammar from "./generated/ma6-parser-generated.js";
import moo from "moo";
import nearley from "nearley";
import type {
  ExprNode,
  OperandNode,
  TextItem,
  StmtNode,
  DirectiveNode,
  LineAst,
} from "./assembler-types.js";
const { Parser, Grammar } = nearley;

// Re-export the AST node types (defined in assembler-types) for consumers that
// import them from the parser wrapper.
export type {
  ExprNode,
  OperandNode,
  TextItem,
  StmtNode,
  DirectiveNode,
  LineAst,
};

export interface ParseResult {
  ast: any;
  errors: string[];
  input: string;
  line: number;
  tokens: any[]; // Include tokens in result
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
  });
  return parser;
}

// ===========================================================================
// AST-PRODUCING LINE PARSER (used by the assembler)
// ===========================================================================
//
// This is the integration point the line-processor consumes. parseLine takes a
// single physical source line, strips the comment, filters whitespace, runs the
// Nearley grammar, and returns a normalized AST. Control-flow handling
// (.if/.macro/.repeat, macro expansion, passes) is the caller's responsibility.
//
// The AST node types (ExprNode, OperandNode, TextItem, StmtNode, DirectiveNode,
// LineAst) are defined in assembler-types.ts and re-exported above.

export interface LineParseResult {
  /** Parsed AST, or null when the line is empty/comment-only or failed. */
  ast: LineAst | null;
  /** True when the line had no content (blank or comment-only). */
  empty: boolean;
  /** Error message when parsing failed; undefined on success/empty. */
  error?: string;
  /**
   * The comment-stripped, trimmed source line that was parsed. Present for
   * non-empty lines (success or failure). The assembler slices this using the
   * token offsets below to recover expression/operand source text, which it
   * feeds to its own (string-based) expression evaluator and macro expander.
   */
  source?: string;
  /** Non-whitespace tokens (with `.offset`/`.text`) for `source`. */
  tokens?: moo.Token[];
}

/**
 * Strip an end-of-line comment. Comments start at the first `;` and run to the
 * end of the line regardless of any open parentheses (project rule: every
 * comment runs to the end of the line; a `;` always terminates the line).
 */
function stripLineComment(line: string): string {
  const idx = line.indexOf(";");
  return idx === -1 ? line : line.slice(0, idx);
}

/**
 * A thin adapter over the Moo lexer that transparently discards whitespace
 * tokens. The grammar references no %WS, so filtering here keeps the grammar
 * simple and unambiguous. Implements the minimal Nearley lexer interface.
 */
const filteringLexer = {
  reset(chunk?: string, info?: unknown) {
    // @ts-ignore: Moo's reset signature is compatible at runtime
    lexer.reset(chunk, info);
    return this;
  },
  next(): moo.Token | undefined {
    let token = lexer.next();
    while (token && token.type === "WS") {
      token = lexer.next();
    }
    return token;
  },
  save() {
    return lexer.save();
  },
  formatError(token: moo.Token, message?: string) {
    return lexer.formatError(token, message);
  },
  has(tokenType: string) {
    return lexer.has(tokenType);
  },
};

/**
 * Parse a single source line into a normalized AST.
 *
 * The caller (line-processor) is responsible for everything stateful:
 * symbol resolution, .if/.macro/.repeat block handling, macro expansion, and
 * instruction encoding. This function only recognizes the line's structure.
 */
export function parseLine(line: string): LineParseResult {
  const stripped = stripLineComment(line).trim();
  if (stripped === "") {
    return { ast: null, empty: true };
  }

  // Collect the non-whitespace tokens (with offsets) so the assembler can
  // recover expression/operand source text by slicing `stripped`.
  let tokens: moo.Token[];
  try {
    tokens = collectTokens(stripped);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ast: null,
      empty: false,
      error: msg.split("\n")[0] ?? msg,
      source: stripped,
    };
  }

  // @ts-ignore: Nearley grammar has `any` type
  const parser = new Parser(Grammar.fromCompiled(grammar), {
    lexer: filteringLexer,
  });

  try {
    parser.feed(stripped);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ast: null,
      empty: false,
      error: msg.split("\n")[0] ?? msg,
      source: stripped,
      tokens,
    };
  }

  const results = parser.finish();
  if (results.length === 0) {
    return {
      ast: null,
      empty: false,
      error: "Incomplete or invalid syntax",
      source: stripped,
      tokens,
    };
  }
  return { ast: results[0] as LineAst, empty: false, source: stripped, tokens };
}

/** Lex a (comment-stripped) line, discarding whitespace tokens. */
function collectTokens(text: string): moo.Token[] {
  lexer.reset(text);
  const tokens: moo.Token[] = [];
  let token = lexer.next();
  while (token) {
    if (token.type !== "WS") {
      tokens.push(token);
    }
    token = lexer.next();
  }
  return tokens;
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
  const tokens: any[] = []; // Collect tokens here

  try {
    useLexer.reset(input);
    let token = useLexer.next();
    while (token) {
      if (token.type !== "WS") tokens.push(token); // Save the token
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
      return { ast: null, errors, input, line: 1, tokens };
    }

    // Return first (most likely) parse result
    return {
      ast: results[0],
      tokens, // Include tokens in result
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

    return { ast: null, errors, input, line: 1, tokens };
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
