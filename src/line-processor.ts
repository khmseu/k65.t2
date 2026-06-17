/**
 * Line-by-Line Streaming Processor
 * Core assembly loop: unified preprocessor + assembler working line-by-line
 * Each line: evaluate directives using current symbol table, then assemble
 */

import type {
  AddressingMode,
  DirectiveType,
  MacroDefinition,
  ParsedLine,
  ProcessorState,
  ExprNode,
  OperandNode,
  TextItem,
  StmtNode,
  DirectiveNode,
} from "./assembler-types.js";
import { ExpressionMemoStore } from "./assembler-types.js";
import { evaluateExpression, unparseExpr } from "./expr-evaluator.js";
import { findOpcode, getOpcodesByMnemonic } from "./6502-opcodes.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  parseLine as parseLineNearley,
  type LineParseResult,
} from "./ma6-parser-wrapper.js";

/**
 * Parse argument list while respecting parentheses
 * For example: "(ADDR),Y" should be a single argument, not split into "(ADDR)" and "Y"
 */
function parseArgumentList(argsStr: string): string[] {
  if (!argsStr) {
    return [];
  }

  const args: string[] = [];
  let current = "";
  let parenDepth = 0;

  for (let i = 0; i < argsStr.length; i++) {
    const c = argsStr[i]!;

    if (c === "(") {
      parenDepth++;
      current += c;
    } else if (c === ")") {
      parenDepth--;
      current += c;
    } else if (c === "," && parenDepth === 0) {
      // Comma outside parentheses - this is an argument separator
      if (current.trim()) {
        args.push(current.trim());
      }
      current = "";
    } else {
      current += c;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

export interface LineProcessorOptions {
  file: string;
  macros: MacroDefinition[];
  maxIncludeDepth?: number;
}

/**
 * Process a single pass through source lines
 * Returns: final state with updated symbol table, memoized expressions, and generated code
 */
export function processPass(
  lines: string[],
  state: ProcessorState,
  options: LineProcessorOptions,
): ProcessorState {
  const newState = {
    symbolTable: state.symbolTable.clone(),
    memos: new ExpressionMemoStore(),
    pc: 0,
    errors: [],
    warnings: [],
    generated: [],
    macros: [],
    listingEvents: [],
  };

  processLinesRecursive(
    lines,
    newState,
    options,
    0, // includeDepth
  );

  return newState;
}

function processLinesRecursive(
  lines: string[],
  state: ProcessorState,
  options: LineProcessorOptions,
  includeDepth: number,
  macroDepth = 0,
): void {
  const maxDepth = options.maxIncludeDepth ?? 10;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1;

    // Parse the line
    const parsed = parseLine(line);

    // Handle directives
    if (parsed.type === "directive" && parsed.directive) {
      switch (parsed.directive) {
        case "org":
          if (parsed.expr) {
            const result = evaluateExpression(
              parsed.expr,
              state.symbolTable,
              state.pc,
            );
            if (result.success) {
              state.pc = result.value;
            } else {
              addError(
                state,
                options.file,
                lineNum,
                `Invalid .org expression: ${result.error}`,
              );
            }
          }
          break;

        case "equ":
        case "set":
          if (parsed.label && parsed.expr) {
            const result = evaluateExpression(
              parsed.expr,
              state.symbolTable,
              state.pc,
            );
            if (result.success) {
              state.symbolTable.set(parsed.label, {
                name: parsed.label,
                type: "constant",
                value: result.value,
              });
            } else {
              addError(
                state,
                options.file,
                lineNum,
                `Invalid expression for ${parsed.directive}: ${result.error}`,
              );
            }
          }
          break;

        case "if":
          if (parsed.expr) {
            const result = evaluateExpression(
              parsed.expr,
              state.symbolTable,
              state.pc,
            );

            // Record memoized expression value (always record, even on errors)
            if (result) {
              recordMemo(
                state,
                options.file,
                lineNum,
                "if",
                unparseExpr(parsed.expr),
                result.value,
              );
            }

            if (!result || !result.success) {
              addError(
                state,
                options.file,
                lineNum,
                `Invalid .if expression: ${result?.error || "Unknown error"}`,
              );
              // Skip to matching .endif
              i = findMatchingEndif(lines, i) - 1;
            } else if (result.value === 0) {
              // Condition false, skip block
              i = findMatchingEndif(lines, i) - 1;
            }
            // If true, continue to next line
          }
          break;

        case "elseif":
          // Reached elseif means previous if was true, skip to endif
          i = findMatchingEndif(lines, i) - 1;
          break;

        case "else":
          // Reached else means previous condition was true, skip to endif
          i = findMatchingEndif(lines, i) - 1;
          break;

        case "endif":
          // Just skip, no action needed
          break;

        case "repeat":
          if (parsed.expr) {
            const result = evaluateExpression(
              parsed.expr,
              state.symbolTable,
              state.pc,
            );

            // Record memoized expression value (always record, even on errors)
            if (result) {
              recordMemo(
                state,
                options.file,
                lineNum,
                "repeat",
                unparseExpr(parsed.expr),
                result.value,
              );
            }

            if (!result || !result.success) {
              addError(
                state,
                options.file,
                lineNum,
                `Invalid .repeat expression: ${result?.error || "Unknown error"}`,
              );
              i = findMatchingEndrepeat(lines, i) - 1;
            } else {
              const count = result.value;
              const endLine = findMatchingEndrepeat(lines, i);
              const bodyLines = lines.slice(i + 1, endLine);

              // Expand body `count` times
              for (let rep = 0; rep < count; rep++) {
                processLinesRecursive(bodyLines, state, options, includeDepth);
              }

              i = endLine; // Skip to after endrepeat
            }
          }
          break;

        case "macro": {
          // Register the macro at its definition point (so macros inside a
          // skipped conditional block are never registered) then skip its body.
          const endLine = findMatchingEndmacro(lines, i);
          if (parsed.label) {
            const params = parsed.params ?? [];
            const bodyText = lines.slice(i + 1, endLine);
            // Later definitions override earlier ones of the same name.
            const existing = state.macros.findIndex(
              (m) => m.name.toUpperCase() === parsed.label!.toUpperCase(),
            );
            const def: MacroDefinition = {
              name: parsed.label,
              params,
              bodyLines: [],
              bodyText,
              file: options.file,
            };
            if (existing >= 0) {
              state.macros[existing] = def;
            } else {
              state.macros.push(def);
            }
          }
          i = endLine;
          break;
        }

        case "endrepeat":
        case "endmacro":
          // Should have been handled by containing block
          break;

        case "include":
          if (parsed.file) {
            const filename = parsed.file;
            if (includeDepth >= maxDepth) {
              addError(
                state,
                options.file,
                lineNum,
                `.include nesting too deep (> ${maxDepth}): ${filename}`,
              );
              break;
            }
            // Resolve relative to the directory of the including file.
            const includePath = join(dirname(options.file), filename);
            let includeContent: string;
            try {
              includeContent = readFileSync(includePath, "utf-8");
            } catch {
              addError(
                state,
                options.file,
                lineNum,
                `.include file not found: ${filename}`,
              );
              break;
            }
            const includeLines = includeContent.split(/\r?\n/);
            processLinesRecursive(
              includeLines,
              state,
              { ...options, file: includePath },
              includeDepth + 1,
              macroDepth,
            );
          }
          break;

        case "byte":
        case "word":
          if (parsed.data) {
            const byteCount = emitData(
              state,
              options.file,
              lineNum,
              line,
              parsed.directive as "byte" | "word",
              parsed.data,
            );
            state.pc += byteCount;
          }
          break;

        case "text":
        case "textc":
          if (parsed.text) {
            const byteCount = emitText(
              state,
              options.file,
              lineNum,
              line,
              parsed.text,
              parsed.directive === "textc",
            );
            state.pc += byteCount;
          }
          break;

        case "fill": {
          // .fill COUNT [, VALUE]  -> COUNT bytes of VALUE (default 0).
          if (parsed.expr) {
            const countRes = evaluateExpression(
              parsed.expr,
              state.symbolTable,
              state.pc,
            );
            if (!countRes.success) {
              addError(
                state,
                options.file,
                lineNum,
                `Invalid .fill count: ${countRes.error}`,
              );
              break;
            }
            const value = evalFillValue(
              state,
              options.file,
              lineNum,
              parsed.fill,
            );
            const byteCount = emitFill(
              state,
              options.file,
              lineNum,
              line,
              countRes.value,
              value,
            );
            state.pc += byteCount;
          }
          break;
        }

        case "align": {
          // .align BOUNDARY [, VALUE]  -> pad with VALUE until pc % BOUNDARY == 0.
          if (parsed.expr) {
            const boundaryRes = evaluateExpression(
              parsed.expr,
              state.symbolTable,
              state.pc,
            );
            if (!boundaryRes.success || boundaryRes.value <= 0) {
              addError(
                state,
                options.file,
                lineNum,
                `Invalid .align boundary: ${boundaryRes.error ?? boundaryRes.value}`,
              );
              break;
            }
            const boundary = boundaryRes.value;
            const pad = (boundary - (state.pc % boundary)) % boundary;
            if (pad > 0) {
              const value = evalFillValue(
                state,
                options.file,
                lineNum,
                parsed.fill,
              );
              const byteCount = emitFill(
                state,
                options.file,
                lineNum,
                line,
                pad,
                value,
              );
              state.pc += byteCount;
            }
          }
          break;
        }

        case "title":
        case "subttl":
        case "print":
          // Text-bearing listing directives: the free-form text rides in the
          // `file` field (see directiveToParsedLine). A title also implies a
          // new listing page, which the formatter derives from the event.
          state.listingEvents.push({
            type: parsed.directive,
            after: state.generated.length,
            text: parsed.file ?? "",
          });
          break;

        case "pagesize":
        case "bytesperline": {
          // Sizing listing directives carry a numeric expression.
          let value = 0;
          if (parsed.expr) {
            const res = evaluateExpression(
              parsed.expr,
              state.symbolTable,
              state.pc,
            );
            if (res.success) {
              value = res.value;
            } else {
              addError(
                state,
                options.file,
                lineNum,
                `Invalid .${parsed.directive} value: ${res.error}`,
              );
              break;
            }
          }
          state.listingEvents.push({
            type: parsed.directive,
            after: state.generated.length,
            value,
          });
          break;
        }

        case "list":
        case "nolist":
        case "page":
        case "eject":
          // Flag/page-break listing directives carry no payload. `eject` is a
          // synonym for `page` in the formatter.
          state.listingEvents.push({
            type: parsed.directive === "eject" ? "page" : parsed.directive,
            after: state.generated.length,
          });
          break;

        default:
          // Any other no-byte directive is ignored by the assembler.
          break;
      }
    }

    // Handle parse errors: never silently drop an unparseable line.
    if (parsed.type === "error") {
      addError(
        state,
        options.file,
        lineNum,
        parsed.error ?? "Could not parse line",
      );
      continue;
    }

    // Handle labels
    if (parsed.label && parsed.type === "label") {
      state.symbolTable.set(parsed.label, {
        name: parsed.label,
        type: "label",
        address: state.pc,
      });
    }

    // Handle instructions
    if (parsed.type === "operation" && parsed.operation) {
      // Macro call? Expand it instead of encoding as an instruction.
      const macro = state.macros.find(
        (m) => m.name.toUpperCase() === parsed.operation!.toUpperCase(),
      );
      if (macro) {
        if (macroDepth >= 50) {
          addError(
            state,
            options.file,
            lineNum,
            `Macro expansion too deep (recursive?): ${macro.name}`,
          );
        } else {
          const expanded = expandMacro(macro, parsed.args ?? []);
          processLinesRecursive(
            expanded,
            state,
            options,
            includeDepth,
            macroDepth + 1,
          );
        }
        continue;
      }

      // Not a macro and not a known 6502 mnemonic: surface it as an error
      // rather than silently dropping the line.
      if (getOpcodesByMnemonic(parsed.operation).length === 0) {
        addError(
          state,
          options.file,
          lineNum,
          `Unknown instruction: ${parsed.operation}`,
        );
        continue;
      }

      const encoded = encodeInstruction(
        state,
        options.file,
        lineNum,
        parsed.operation,
        parsed.operand ?? null,
      );

      if (encoded) {
        state.generated.push({
          sourceFile: options.file,
          sourceLine: lineNum,
          address: state.pc,
          bytes: encoded,
          sourceText: line,
        });
        state.pc += encoded.length;
      }
    }
  }
}

/**
 * Parse a single source line into the assembler's ParsedLine shape.
 *
 * Recognition (label / directive / assignment / instruction + addressing
 * mode) AND the expression/operand structure are produced entirely by the
 * Nearley parser (ma6-parser-wrapper). Nothing here re-parses source text:
 * the parser's AST nodes are carried straight through to the assembler, which
 * evaluates them. A line the grammar cannot parse becomes a ParsedLine of
 * type "error" so the caller can report it (never silently dropped).
 */
function parseLine(line: string): ParsedLine {
  const result = parseLineNearley(line);

  if (result.empty) {
    // Distinguish blank lines from comment-only lines (both no-ops downstream).
    const trimmed = line.trim();
    return {
      type: trimmed === "" ? "empty" : "comment",
      raw: line,
    };
  }

  if (!result.ast) {
    return {
      type: "error",
      error: result.error ?? "Could not parse line",
      raw: line,
    };
  }

  return astToParsedLine(result, line);
}

/** Branch mnemonics always use relative addressing regardless of operand shape. */
const BRANCH_MNEMONICS = new Set([
  "BNE",
  "BEQ",
  "BCS",
  "BCC",
  "BMI",
  "BPL",
  "BVC",
  "BVS",
]);

/**
 * Source text of the statement's expression/operand: everything in the parsed
 * (comment-stripped) line at or after the token following the keyword token.
 * `keywordTokenIndex` is the index of the directive/mnemonic/name token; the
 * expression begins at the next token (or the token after that for
 * assignments, which have an `=`/`.set` operator in between).
 */
function sliceFrom(
  result: LineParseResult,
  exprTokenIndex: number,
): string | undefined {
  const tokens = result.tokens;
  const source = result.source;
  if (!tokens || source === undefined) {
    return undefined;
  }
  const tok = tokens[exprTokenIndex];
  if (!tok) {
    return undefined;
  }
  return source.slice(tok.offset).trim();
}

/** Convert a successful Nearley parse into the assembler's ParsedLine shape. */
function astToParsedLine(result: LineParseResult, line: string): ParsedLine {
  const ast = result.ast!;
  const label = ast.label ?? undefined;
  const stmt = ast.stmt as StmtNode | null;

  // Index of the first token of the statement (after an optional `LABEL :`).
  const stmtTokenStart = ast.label ? 2 : 0;

  if (!stmt) {
    // Label only.
    return label
      ? { type: "label", label, raw: line }
      : { type: "empty", raw: line };
  }

  const base: Pick<ParsedLine, "label" | "raw"> = label
    ? { label, raw: line }
    : { raw: line };

  switch (stmt.kind) {
    case "assign": {
      // NAME = EXPR  or  NAME .set EXPR -> treat as an equ-style constant.
      return {
        ...base,
        type: "directive",
        directive: "equ",
        label: stmt.name,
        expr: stmt.value,
      };
    }

    case "instruction": {
      // Carry the operand AST through for encoding. The raw operand text is
      // captured too, but ONLY for textual macro-argument substitution (a
      // legitimate textual use); it is never re-parsed for evaluation.
      const operandText = sliceFrom(result, stmtTokenStart + 1) ?? "";
      const args = parseArgumentList(operandText);
      return {
        ...base,
        type: "operation",
        operation: stmt.mnemonic,
        operand: stmt.arg,
        args,
      };
    }

    default:
      return directiveToParsedLine(stmt, base);
  }
}

/** Map a directive AST node to a ParsedLine, carrying its AST payloads. */
function directiveToParsedLine(
  stmt: DirectiveNode,
  base: Pick<ParsedLine, "label" | "raw">,
): ParsedLine {
  switch (stmt.name) {
    case "org":
    case "if":
    case "elseif":
    case "repeat":
    case "equ":
    case "pagesize":
    case "bytesperline":
      return {
        ...base,
        type: "directive",
        directive: stmt.name,
        ...(stmt.expr !== undefined ? { expr: stmt.expr } : {}),
      };

    case "macro": {
      // .macro NAME [, PARAMS]
      const macroName = stmt.macroName ?? base.label;
      return {
        ...base,
        type: "directive",
        directive: "macro",
        ...(macroName !== undefined ? { label: macroName } : {}),
        ...(stmt.params ? { params: stmt.params } : {}),
      };
    }

    case "byte":
    case "word":
      return {
        ...base,
        type: "directive",
        directive: stmt.name,
        ...(stmt.args ? { data: stmt.args } : {}),
      };

    case "text":
    case "textc":
      return {
        ...base,
        type: "directive",
        directive: stmt.name,
        ...(stmt.items ? { text: stmt.items } : {}),
      };

    case "fill":
    case "align":
      return {
        ...base,
        type: "directive",
        directive: stmt.name,
        ...(stmt.expr !== undefined ? { expr: stmt.expr } : {}),
        ...(stmt.fill !== undefined ? { fill: stmt.fill } : {}),
      };

    case "include":
      return {
        ...base,
        type: "directive",
        directive: "include",
        ...(stmt.file !== undefined ? { file: stmt.file } : {}),
      };

    case "title":
    case "subttl":
    case "print":
      return {
        ...base,
        type: "directive",
        directive: stmt.name as DirectiveType,
        ...(stmt.text !== undefined ? { file: stmt.text } : {}),
      };

    case "else":
    case "endif":
    case "endmacro":
    case "endrepeat":
    case "list":
    case "nolist":
    case "page":
    case "eject":
      return {
        ...base,
        type: "directive",
        directive: stmt.name as DirectiveType,
      };

    default:
      return {
        ...base,
        type: "directive",
        directive: stmt.name as DirectiveType,
      };
  }
}

/**
 * Encode an instruction to machine bytes.
 *
 * The operand's addressing-mode *shape* (immediate / indirect / indexed / ...)
 * comes from the parser. The choice between zeropage and absolute forms is made
 * here, per pass, from the evaluated operand value: when the value is known and
 * fits in a byte and a zeropage opcode exists for the mnemonic, the zeropage
 * form is used; otherwise the absolute form is used. Unknown/forward operands
 * default to absolute. If the resulting (mnemonic, mode) pair has no opcode
 * (e.g. STY abs,X), that is a hard error.
 */
function encodeInstruction(
  state: ProcessorState,
  file: string,
  lineNum: number,
  mnemonic: string,
  operand: OperandNode | null,
): number[] | null {
  const M = mnemonic.toUpperCase();

  // No operand -> implied.
  if (!operand) {
    const opcode = findOpcode(M, "implied");
    if (!opcode) {
      addError(state, file, lineNum, `Unknown instruction: ${mnemonic}`);
      return null;
    }
    return [opcode.opcode];
  }

  // Accumulator operand (e.g. "ASL A") carries no expression.
  if (operand.mode === "accumulator") {
    const opcode = findOpcode(M, "accumulator");
    if (!opcode) {
      addError(
        state,
        file,
        lineNum,
        `Unknown instruction: ${mnemonic} (accumulator)`,
      );
      return null;
    }
    return [opcode.opcode];
  }

  const evalRes = operand.expr
    ? evaluateExpression(operand.expr, state.symbolTable, state.pc)
    : { value: 0, success: false, error: "Missing operand expression" };

  const mode = selectMode(M, operand.mode, evalRes.success, evalRes.value);

  const opcode = findOpcode(M, mode);
  if (!opcode) {
    addError(
      state,
      file,
      lineNum,
      `Unknown instruction: ${mnemonic} (${mode})`,
    );
    return null;
  }

  const bytes: number[] = [opcode.opcode];

  if (opcode.bytes > 1) {
    if (!evalRes.success) {
      addError(state, file, lineNum, `Invalid operand: ${evalRes.error}`);
      return null;
    }
    bytes.push(evalRes.value & 0xff);
    if (opcode.bytes === 3) {
      bytes.push((evalRes.value >> 8) & 0xff);
    }
  }

  return bytes;
}

/**
 * Map the parser's operand shape to a concrete 6502 addressing mode, choosing
 * the zeropage form when the operand value is known to fit in a byte and the
 * mnemonic has a zeropage opcode (otherwise the absolute form).
 */
function selectMode(
  mnemonic: string,
  parserMode: OperandNode["mode"],
  known: boolean,
  value: number,
): AddressingMode {
  switch (parserMode) {
    case "immediate":
      return "immediate";
    case "indirect":
      return "indirect";
    case "indirectX":
      return "indirectX";
    case "indirectY":
      return "indirectY";
    case "indexedX":
      return pickZeroPage(mnemonic, "zeropageX", "absoluteX", known, value);
    case "indexedY":
      return pickZeroPage(mnemonic, "zeropageY", "absoluteY", known, value);
    case "absolute":
    default:
      if (BRANCH_MNEMONICS.has(mnemonic)) {
        return "relative";
      }
      return pickZeroPage(mnemonic, "zeropage", "absolute", known, value);
  }
}

/** Choose zeropage form when known & < 256 & a zeropage opcode exists. */
function pickZeroPage(
  mnemonic: string,
  zp: AddressingMode,
  abs: AddressingMode,
  known: boolean,
  value: number,
): AddressingMode {
  if (known && value >= 0 && value < 256 && findOpcode(mnemonic, zp)) {
    return zp;
  }
  return abs;
}

/**
 * Emit data bytes for .byte or .word directives
 */
function emitData(
  state: ProcessorState,
  file: string,
  lineNum: number,
  line: string,
  directive: "byte" | "word",
  items: ExprNode[],
): number {
  const bytes: number[] = [];

  for (const item of items) {
    const result = evaluateExpression(item, state.symbolTable, state.pc);
    if (!result.success) {
      addError(state, file, lineNum, `Invalid data value: ${result.error}`);
      continue;
    }

    if (directive === "byte") {
      bytes.push(result.value & 0xff);
    } else if (directive === "word") {
      bytes.push(result.value & 0xff);
      bytes.push((result.value >> 8) & 0xff);
    }
  }

  state.generated.push({
    sourceFile: file,
    sourceLine: lineNum,
    address: state.pc,
    bytes,
    sourceText: line,
  });

  return bytes.length;
}

/**
 * Emit string/expression bytes for .text and .textc directives. A .textc list
 * sets the high bit of the LAST emitted byte (a common end-of-string marker).
 */
function emitText(
  state: ProcessorState,
  file: string,
  lineNum: number,
  line: string,
  items: TextItem[],
  highBitLast: boolean,
): number {
  const bytes: number[] = [];

  for (const item of items) {
    if (item.t === "str") {
      for (const ch of item.v) {
        bytes.push(ch.charCodeAt(0) & 0xff);
      }
    } else {
      const result = evaluateExpression(item.v, state.symbolTable, state.pc);
      if (!result.success) {
        addError(state, file, lineNum, `Invalid text value: ${result.error}`);
        continue;
      }
      bytes.push(result.value & 0xff);
    }
  }

  if (highBitLast && bytes.length > 0) {
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! | 0x80;
  }

  state.generated.push({
    sourceFile: file,
    sourceLine: lineNum,
    address: state.pc,
    bytes,
    sourceText: line,
  });

  return bytes.length;
}

/** Evaluate an optional .fill/.align fill value (defaults to 0). */
function evalFillValue(
  state: ProcessorState,
  file: string,
  lineNum: number,
  fill: ExprNode | null | undefined,
): number {
  if (!fill) {
    return 0;
  }
  const result = evaluateExpression(fill, state.symbolTable, state.pc);
  if (!result.success) {
    addError(state, file, lineNum, `Invalid fill value: ${result.error}`);
    return 0;
  }
  return result.value & 0xff;
}

/** Emit `count` copies of `value` for .fill / .align padding. */
function emitFill(
  state: ProcessorState,
  file: string,
  lineNum: number,
  line: string,
  count: number,
  value: number,
): number {
  const n = Math.max(0, count);
  const bytes: number[] = new Array(n).fill(value & 0xff);

  state.generated.push({
    sourceFile: file,
    sourceLine: lineNum,
    address: state.pc,
    bytes,
    sourceText: line,
  });

  return bytes.length;
}

/**
 * Record memoized expression value
 */
function recordMemo(
  state: ProcessorState,
  file: string,
  lineNum: number,
  type: "if" | "repeat",
  expression: string,
  value: number,
): void {
  state.memos.set(file, lineNum, {
    lineNum,
    type,
    expression,
    value,
    file,
  });
}

/**
 * Find matching .endif for .if at given line
 */
function findMatchingEndif(lines: string[], startLine: number): number {
  let depth = 1;
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.match(/^\.if\s/i)) depth++;
    if (line.match(/^\.endif$/i)) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return lines.length - 1;
}

/**
 * Find matching .endrepeat for .repeat at given line
 */
function findMatchingEndrepeat(lines: string[], startLine: number): number {
  let depth = 1;
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.match(/^\.repeat\s/i)) depth++;
    if (line.match(/^\.endrepeat$/i)) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return lines.length - 1;
}

/**
 * Find matching .endmacro for .macro at given line
 */
function findMatchingEndmacro(lines: string[], startLine: number): number {
  let depth = 1;
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.match(/^\.macro\s/i)) depth++;
    if (line.match(/^\.endmacro$/i)) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return lines.length - 1;
}

/**
 * Expand a macro invocation: substitute each `\PARAM` in the body with the
 * corresponding argument from the call site, returning the resulting lines.
 */
function expandMacro(macro: MacroDefinition, args: string[]): string[] {
  return macro.bodyText.map((bodyLine) => {
    let result = bodyLine;
    macro.params.forEach((param, idx) => {
      const arg = args[idx] ?? "";
      result = result.replace(new RegExp("\\\\" + param + "\\b", "g"), arg);
    });
    return result;
  });
}

function addError(
  state: ProcessorState,
  file: string,
  lineNum: number,
  message: string,
): void {
  state.errors.push({
    file,
    line: lineNum,
    message,
    type: "error",
  });
}
