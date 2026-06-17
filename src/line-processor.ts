/**
 * Line-by-Line Streaming Processor
 * Core assembly loop: unified preprocessor + assembler working line-by-line
 * Each line: evaluate directives using current symbol table, then assemble
 */

import type {
  MacroDefinition,
  ParsedLine,
  ProcessorState,
} from "./assembler-types.js";
import { ExpressionMemoStore } from "./assembler-types.js";
import { evaluateExpression } from "./expr-evaluator.js";
import { findOpcode } from "./6502-opcodes.js";

/**
 * Strip comments from an expression/argument string
 * Comments start with ; and continue to end of line
 * IMPORTANT: Only treat ; as comment if not inside parentheses
 * This allows comments inside operands like: STA (LOWTR ;comment),Y
 */
function stripComment(str: string): string {
  let parenDepth = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i]!;
    if (c === "(") {
      parenDepth++;
    } else if (c === ")") {
      parenDepth--;
    } else if (c === ";" && parenDepth === 0) {
      // Found comment marker outside parentheses
      return str.substring(0, i).trim();
    }
  }
  return str.trim();
}

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
    errors: [...state.errors],
    warnings: [...state.warnings],
    generated: [],
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
          if (parsed.expression) {
            const result = evaluateExpression(
              parsed.expression,
              state.symbolTable,
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
          if (parsed.label && parsed.expression) {
            const result = evaluateExpression(
              parsed.expression,
              state.symbolTable,
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
          if (parsed.expression) {
            const result = evaluateExpression(
              parsed.expression,
              state.symbolTable,
            );

            // Record memoized expression value (always record, even on errors)
            if (result) {
              recordMemo(
                state,
                options.file,
                lineNum,
                "if",
                parsed.expression,
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
          if (parsed.expression) {
            const result = evaluateExpression(
              parsed.expression,
              state.symbolTable,
            );

            // Record memoized expression value (always record, even on errors)
            if (result) {
              recordMemo(
                state,
                options.file,
                lineNum,
                "repeat",
                parsed.expression,
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

        case "endrepeat":
        case "endmacro":
          // Should have been handled by containing block
          break;

        case "include":
          if (parsed.expression && includeDepth < maxDepth) {
            const filename = parsed.expression.replace(/^["']|["']$/g, "");
            // TODO: implement file loading
            addError(
              state,
              options.file,
              lineNum,
              `.include not yet implemented: ${filename}`,
            );
          }
          break;

        case "byte":
        case "word":
          if (parsed.args) {
            const byteCount = emitData(
              state,
              options.file,
              lineNum,
              line,
              parsed.directive as "byte" | "word",
              parsed.args,
            );
            state.pc += byteCount;
          }
          break;

        default:
          // Other directives (list, nolist, page, title, etc.) - no-op for now
          break;
      }
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
    if (parsed.type === "operation" && parsed.operation && parsed.args) {
      const encoded = encodeInstruction(
        state,
        options.file,
        lineNum,
        parsed.operation,
        parsed.args,
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
 * Parse a single source line into components
 */
function parseLine(line: string): ParsedLine {
  const trimmed = line.trim();

  // Empty or comment
  if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("*")) {
    return {
      type:
        trimmed.startsWith(";") || trimmed.startsWith("*")
          ? "comment"
          : "empty",
      raw: line,
    };
  }

  // Try parsing directive
  const directive = parseDirective(trimmed);
  if (directive) {
    return directive;
  }

  // Check for label
  const labelMatch = trimmed.match(/^(@?[a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)/);
  if (labelMatch && labelMatch[1]) {
    const label = labelMatch[1];
    const rest = stripComment(labelMatch[2] || "").trim();

    if (!rest) {
      return { type: "label", label, raw: line };
    }

    // Label followed by instruction or directive
    const restParsed = parseLine(rest);
    return { ...restParsed, label };
  }

  // Check for instruction
  // Must have exactly 3 uppercase letters followed by whitespace or end of line
  const instrMatch = trimmed.match(/^([A-Z]{3})(?:\s+(.*))?$/i);
  if (instrMatch && instrMatch[1]) {
    const operation = instrMatch[1];
    const argsStr = stripComment((instrMatch[2] || "").trim());

    // Smart argument splitting that respects parentheses
    const args = parseArgumentList(argsStr);

    return {
      type: "operation",
      operation,
      args,
      raw: line,
    };
  }

  // Unknown, treat as data/comment
  return { type: "comment", raw: line };
}

/**
 * Parse a directive line
 */
function parseDirective(line: string): ParsedLine | null {
  // .org EXPR
  const orgMatch = line.match(/^\.org\s+(.+)$/i);
  if (orgMatch) {
    return {
      type: "directive",
      directive: "org",
      expression: stripComment(orgMatch[1] || ""),
      raw: line,
    };
  }

  // .equ NAME EXPR or NAME = EXPR
  const equMatch = line.match(
    /^([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\.equ|=)\s+(.+)$/i,
  );
  if (equMatch) {
    return {
      type: "directive",
      directive: "equ",
      label: equMatch[1] || "",
      expression: stripComment(equMatch[2] || ""),
      raw: line,
    };
  }

  // .set NAME EXPR
  const setMatch = line.match(/^\.set\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(.+)$/i);
  if (setMatch) {
    return {
      type: "directive",
      directive: "set",
      label: setMatch[1] || "",
      expression: stripComment(setMatch[2] || ""),
      raw: line,
    };
  }

  // .if EXPR
  const ifMatch = line.match(/^\.if\s+(.+)$/i);
  if (ifMatch) {
    return {
      type: "directive",
      directive: "if",
      expression: stripComment(ifMatch[1] || ""),
      raw: line,
    };
  }

  // .repeat EXPR
  const repeatMatch = line.match(/^\.repeat\s+(.+)$/i);
  if (repeatMatch) {
    return {
      type: "directive",
      directive: "repeat",
      expression: stripComment(repeatMatch[1] || ""),
      raw: line,
    };
  }

  // .byte | .word
  const dataMatch = line.match(/^\.(?:byte|word)\s+(.+)$/i);
  if (dataMatch) {
    const type = line.match(/byte/i) ? "byte" : "word";
    const argsStr = stripComment(dataMatch[1] || "");
    return {
      type: "directive",
      directive: type as "byte" | "word",
      args: argsStr.split(",").map((a) => a.trim()),
      raw: line,
    };
  }

  // Single-keyword directives
  if (line.match(/^\.endif$/i)) {
    return { type: "directive", directive: "endif", raw: line };
  }
  if (line.match(/^\.endrepeat$/i)) {
    return { type: "directive", directive: "endrepeat", raw: line };
  }
  if (line.match(/^\.else$/i)) {
    return { type: "directive", directive: "else", raw: line };
  }
  const elseifMatch = line.match(/^\.elseif\s+(.+)$/i);
  if (elseifMatch) {
    return {
      type: "directive",
      directive: "elseif",
      expression: elseifMatch[1] || "",
      raw: line,
    };
  }

  return null;
}

/**
 * Encode an instruction to machine bytes
 */
function encodeInstruction(
  state: ProcessorState,
  file: string,
  lineNum: number,
  mnemonic: string,
  args: string[],
): number[] | null {
  // Determine addressing mode from arguments
  const mode = determineAddressingMode(mnemonic, args);
  if (!mode) {
    addError(
      state,
      file,
      lineNum,
      `Invalid addressing mode for ${mnemonic} ${args.join(", ")}`,
    );
    return null;
  }

  const opcode = findOpcode(mnemonic, mode);
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

  // Add operand bytes
  if (opcode.bytes > 1 && args.length > 0) {
    let operand = args[0];
    if (!operand) {
      addError(state, file, lineNum, `Missing operand for ${mnemonic}`);
      return null;
    }

    // For immediate mode, strip the # prefix before evaluation
    if (mode && mode === "immediate" && operand.startsWith("#")) {
      operand = operand.substring(1);
    }

    // For indirect modes, extract the value from parentheses
    if (
      mode &&
      (mode === "indirect" || mode === "indirectX" || mode === "indirectY")
    ) {
      // Extract the value from (VALUE) or (VALUE,X) or (VALUE),Y
      // Handle both single-argument format "(VALUE),Y" and multi-argument format "(VALUE)" + "Y"
      let fullOperand = operand;
      if (
        args.length >= 2 &&
        operand.match(/^\([^)]+\)$/) &&
        args[1]?.match(/^[XY]$/i)
      ) {
        // Multi-argument format - operand is already the address part
        fullOperand = operand;
      }

      const match = fullOperand.match(/^\(([^,)]+)/);
      if (match && match[1]) {
        operand = stripComment(match[1]); // Strip comments from extracted operand
      }
    }

    const value = evaluateExpression(operand, state.symbolTable);

    if (!value.success) {
      addError(state, file, lineNum, `Invalid operand: ${value.error}`);
      return null;
    }

    if (opcode.bytes === 2) {
      bytes.push(value.value & 0xff);
    } else if (opcode.bytes === 3) {
      bytes.push(value.value & 0xff);
      bytes.push((value.value >> 8) & 0xff);
    }
  }

  return bytes;
}

/**
 * Determine addressing mode from argument list
 * Takes the mnemonic into account to properly identify relative addressing for branches
 */
function determineAddressingMode(
  mnemonic: string,
  args: string[],
): string | null {
  // Check for branch instructions (all use relative addressing)
  const branchInstructions = [
    "BNE",
    "BEQ",
    "BCS",
    "BCC",
    "BMI",
    "BPL",
    "BVC",
    "BVS",
  ];
  if (branchInstructions.includes(mnemonic.toUpperCase()) && args.length > 0) {
    return "relative";
  }

  if (args.length === 0) {
    return "implied";
  }

  // Handle indexed indirect modes split across arguments: (ADDR),Y or (ADDR),X
  if (
    args.length >= 2 &&
    args[0]?.match(/^\([^)]+\)$/) &&
    args[1]?.match(/^[XY]$/i)
  ) {
    if (args[1].toUpperCase() === "X") {
      return "indirectX";
    } else if (args[1].toUpperCase() === "Y") {
      return "indirectY";
    }
  }

  const arg = args[0];
  if (!arg) {
    return null;
  }

  // Accumulator: A
  if (arg.match(/^A$/i)) {
    return "accumulator";
  }

  // Immediate: #VALUE
  if (arg.match(/^#/)) {
    return "immediate";
  }

  // Indirect and indexed-indirect: (VALUE), (VALUE,X), (VALUE),Y
  if (arg.match(/^\([^)]+/)) {
    // Check for indexed: (VALUE,X) or (VALUE),Y
    if (arg.match(/^\([^)]+,X\)$/i)) {
      return "indirectX";
    }
    if (arg.match(/^\([^)]+\),Y$/i)) {
      return "indirectY";
    }
    if (arg.match(/^\([^)]+\)$/)) {
      return "indirect";
    }
    // If we matched the opening paren but don't have a valid pattern, return null
    return null;
  }

  // Absolute or zero page: VALUE or VALUE,X or VALUE,Y
  if (
    arg.match(/^[a-zA-Z_$@][a-zA-Z0-9_$@.]*|0x[0-9A-Fa-f]+|0o[0-7]+|\d+|^[\*]/)
  ) {
    if (arg.match(/,X$/i)) {
      return "absoluteX"; // Could be zeropageX, but we'll let the assembler decide
    }
    if (arg.match(/,Y$/i)) {
      return "absoluteY";
    }
    return "absolute"; // Could be zeropage
  }

  return null;
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
  args: string[],
): number {
  const bytes: number[] = [];

  for (const arg of args) {
    if (!arg) continue;
    const result = evaluateExpression(arg, state.symbolTable);
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
