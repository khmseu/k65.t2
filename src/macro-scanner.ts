/**
 * Macro Boundary Scanner - Prep Phase
 * Scans source to identify .macro/.endmacro and block boundaries
 * Enables treating macro bodies as opaque units during line-by-line assembly
 */

import type { MacroDefinition, BlockBoundary } from "./assembler-types.js";

export interface ScannerResult {
  macros: MacroDefinition[];
  blockMap: BlockBoundary[];
}

/**
 * Scan source lines to extract macro definitions and block boundaries
 * Maintains nesting depth for proper block matching
 */
export function scanMacroBlocks(lines: string[], file: string): ScannerResult {
  const macros: MacroDefinition[] = [];
  const blockMap: BlockBoundary[] = [];
  const blockStack: Array<{ type: string; startLine: number; name?: string }> =
    [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();

    // Skip comments and empty lines
    if (!line || line.startsWith(";") || line.startsWith("*")) {
      continue;
    }

    // .macro NAME [, PARAMS]
    const macroMatch = line.match(
      /^\.macro\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:,\s*(.*))?$/i,
    );
    if (macroMatch && macroMatch[1]) {
      const macroName = macroMatch[1];

      blockStack.push({ type: "macro", startLine: i, name: macroName });
      continue;
    }

    // .endmacro
    if (line.match(/^\.endmacro$/i)) {
      const block = blockStack.pop();
      if (block && block.type === "macro" && block.name) {
        const bodyLines: number[] = [];
        const bodyText: string[] = [];
        for (let j = block.startLine + 1; j < i; j++) {
          bodyLines.push(j);
          bodyText.push(lines[j]!);
        }

        macros.push({
          name: block.name,
          params: extractMacroParams(lines[block.startLine]!),
          bodyLines,
          bodyText,
          file,
        });

        blockMap.push({
          type: "macro",
          startLine: block.startLine,
          endLine: i,
          name: block.name,
          nesting: blockStack.length,
        });
      }
      continue;
    }

    // .if, .repeat (start blocks)
    const blockStart = line.match(/^\.(?:if|repeat)\s/i);
    if (blockStart) {
      const type = line.match(/^\.if\s/i) ? "if" : "repeat";
      blockStack.push({ type, startLine: i });
      continue;
    }

    // .endif, .endrepeat
    const blockEnd = line.match(/^\.(?:endif|endrepeat)$/i);
    if (blockEnd) {
      const block = blockStack.pop();
      if (block) {
        blockMap.push({
          type: block.type as "if" | "repeat",
          startLine: block.startLine,
          endLine: i,
          nesting: blockStack.length,
        });
      }
      continue;
    }
  }

  return { macros, blockMap };
}

/**
 * Extract macro parameter names from .macro directive
 */
function extractMacroParams(macroLine: string): string[] {
  const match = macroLine.match(
    /^\.macro\s+[a-zA-Z_][a-zA-Z0-9_]*\s*(?:,\s*(.*))?$/i,
  );
  if (!match || !match[1]) {
    return [];
  }

  return match[1]
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(p));
}

/**
 * Check if a line is inside a macro definition
 */
export function isInsideMacro(
  lineNum: number,
  blockMap: BlockBoundary[],
): boolean {
  for (const block of blockMap) {
    if (
      block.type === "macro" &&
      lineNum > block.startLine &&
      lineNum < block.endLine
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Find matching end block for a directive at given line
 * Returns line number of matching end directive, or -1 if not found
 */
export function findBlockEnd(lines: string[], startLine: number): number {
  const startLine_text = lines[startLine]!.trim();
  let blockType: "if" | "repeat" | null = null;

  if (startLine_text.match(/^\.if\s/i)) {
    blockType = "if";
  } else if (startLine_text.match(/^\.repeat\s/i)) {
    blockType = "repeat";
  }

  if (!blockType) {
    return -1;
  }

  let depth = 1;
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line || line.startsWith(";") || line.startsWith("*")) {
      continue;
    }

    if (
      blockType === "if" &&
      (line.match(/^\.if\s/i) || line.match(/^\.elseif\s/i))
    ) {
      depth++;
    } else if (blockType === "if" && line.match(/^\.endif$/i)) {
      depth--;
      if (depth === 0) {
        return i;
      }
    } else if (blockType === "repeat" && line.match(/^\.repeat\s/i)) {
      depth++;
    } else if (blockType === "repeat" && line.match(/^\.endrepeat$/i)) {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}
