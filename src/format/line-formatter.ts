/**
 * Line formatter: reconstruct a single assembly line into formatted fields.
 */

import type { LineAst, DirectiveNode } from "../assembler-types.js";
import type { FormattedLine } from "../formatter-types.js";
import { reconstructExpression } from "./expr-reconstructor.js";
import { reconstructOperand } from "./operand-reconstructor.js";

/**
 * Extract the end-of-line comment body from a raw source line.
 *
 * Comments start at the first `;` and run to end of line. The body is the text
 * after the `;` with trailing whitespace removed but leading whitespace (the
 * spacing/tabs between the `;` and the first non-blank character) preserved, so
 * the renderer can reproduce the author's original indentation verbatim.
 */
function extractComment(source: string): string {
  const idx = source.indexOf(";");
  if (idx === -1) {
    return "";
  }
  return source.slice(idx + 1).replace(/\s+$/, "");
}

/**
 * Reconstruct directive arguments into a single string.
 */
function reconstructDirectiveArgs(stmt: DirectiveNode): string {
  switch (stmt.name) {
    case "org":
    case "equ":
    case "if":
    case "elseif":
    case "repeat":
    case "pagesize":
    case "bytesperline":
      // Single expression argument
      if (stmt.expr) {
        return reconstructExpression(stmt.expr);
      }
      return "";

    case "align":
    case "fill":
      // Expression with optional fill argument
      if (stmt.expr) {
        const expr = reconstructExpression(stmt.expr);
        if (stmt.fill) {
          return `${expr}, ${reconstructExpression(stmt.fill)}`;
        }
        return expr;
      }
      return "";

    case "byte":
    case "word":
      // Data list (array of expressions)
      if (stmt.args && stmt.args.length > 0) {
        return stmt.args.map(reconstructExpression).join(", ");
      }
      return "";

    case "text":
    case "textc":
      // Text items (strings and expressions)
      if (stmt.items) {
        return stmt.items
          .map((item) => {
            if (item.t === "str") {
              return `"${item.v}"`;
            } else {
              return reconstructExpression(item.v);
            }
          })
          .join(", ");
      }
      return "";

    case "include":
      // File path (already in form `"path"`)
      return `"${stmt.file ?? ""}"`;

    case "macro":
      // Macro name with parameters
      let macroText = stmt.macroName ?? "???";
      if (stmt.params && stmt.params.length > 0) {
        macroText += ", " + stmt.params.join(", ");
      }
      return macroText;

    case "title":
    case "subttl":
    case "print":
      // Free-form text
      return stmt.text ?? "";

    case "list":
    case "nolist":
    case "page":
    case "eject":
    case "endmacro":
    case "endrepeat":
    case "endif":
    case "else":
    default:
      // No arguments
      return "";
  }
}

/**
 * Format a single assembly line into structured fields.
 *
 * @param source - Raw source line (with comment intact)
 * @param ast - Parsed AST, or null if parse failed or line was empty
 * @param lineNumber - Original line number for tracking
 * @returns FormattedLine with all fields populated
 */
export function formatLine(
  source: string,
  ast: LineAst | null,
  lineNumber: number,
): FormattedLine {
  const comment = extractComment(source);

  // Determine the code portion (everything before the first `;`).
  const idx = source.indexOf(";");
  const contentWithoutComment = (
    idx === -1 ? source : source.slice(0, idx)
  ).trim();

  // Truly blank line: no code and no comment.
  if (contentWithoutComment === "" && comment === "") {
    return {
      label: "",
      operation: "",
      arguments: "",
      comment: "",
      isBlank: true,
      isComment: false,
      commentAtMargin: false,
      originalLineNumber: lineNumber,
    };
  }

  // Comment-only line: no code, comment present. A `;` in the very first column
  // is a margin comment (kept at the left edge); an indented `;` is treated as
  // a trailing comment with no code and is moved to the shared comment column.
  if (contentWithoutComment === "") {
    return {
      label: "",
      operation: "",
      arguments: "",
      comment,
      isBlank: false,
      isComment: true,
      commentAtMargin: idx === 0,
      originalLineNumber: lineNumber,
    };
  }

  // Line has code but failed to parse: preserve it verbatim so no content is
  // silently dropped. The caller still reports the parse error separately.
  if (!ast) {
    return {
      label: "",
      operation: "",
      arguments: "",
      comment,
      isBlank: false,
      isComment: false,
      commentAtMargin: false,
      raw: source.replace(/\s+$/, ""),
      originalLineNumber: lineNumber,
    };
  }

  let label = ast.label || "";
  let operation = "";
  let args = "";

  if (ast.stmt) {
    const stmt = ast.stmt;

    if (stmt.kind === "instruction") {
      const instr = stmt as any; // Cast to instruction type
      operation = (instr.mnemonic ?? "???").toUpperCase();
      if (instr.arg !== null && instr.arg !== undefined) {
        args = reconstructOperand(instr.arg);
      }
    } else if (stmt.kind === "directive") {
      // Directives are output as lowercase .name
      const directive = stmt as DirectiveNode;
      operation = `.${directive.name}`;
      args = reconstructDirectiveArgs(directive);
    } else if (stmt.kind === "assign") {
      // Assignment: NAME = EXPR. The assigned symbol belongs in the label
      // column, with `=` as the operation and the value as the argument.
      const assign = stmt as any; // Cast to assign type
      label = label || assign.name;
      operation = "=";
      const value = assign.value || ({ t: "num", v: 0 } as any);
      args = reconstructExpression(value);
    }
  }

  return {
    label,
    operation,
    arguments: args,
    comment,
    isBlank: false,
    isComment: false,
    commentAtMargin: false,
    originalLineNumber: lineNumber,
  };
}
