/**
 * Multi-Pass Assembler Orchestrator
 * Coordinates the assembly pipeline: macro scan -> pass 1+ with relaxation
 */

import { readFileSync } from "node:fs";
import type { AssemblyResult, ProcessorState } from "./assembler-types.js";
import { SymbolTable, ExpressionMemoStore } from "./assembler-types.js";
import { scanMacroBlocks } from "./macro-scanner.js";
import { processPass } from "./line-processor.js";
import { formatOutput } from "./output-formatter.js";

export interface AssemblerOptions {
  maxPasses?: number;
  file: string;
}

/**
 * Main assembler entry point
 * Processes a source file through multiple passes until convergence
 *
 * Returns:
 *   - Binary machine code
 *   - Hex listing with addresses
 *   - Symbol table
 *   - Errors and warnings
 *   - Number of passes performed
 */
export function assemble(
  content: string,
  options: AssemblerOptions,
): AssemblyResult {
  const lines = content.split("\n");
  const maxPasses = options.maxPasses ?? 10;
  const file = options.file;

  // Phase 0: Scan macro blocks
  const scanResult = scanMacroBlocks(lines, file);

  // Phase 1+: Multi-pass assembly with relaxation
  let state: ProcessorState = {
    symbolTable: new SymbolTable(),
    memos: new ExpressionMemoStore(),
    pc: 0,
    errors: [],
    warnings: [],
    generated: [],
  };

  let passNum = 0;
  let converged = false;

  while (passNum < maxPasses && !converged) {
    passNum++;

    // Save label addresses for convergence check
    const prevSymbols = collectLabelAddresses(state.symbolTable);

    // Run assembly pass (each pass starts with a fresh error list so that
    // forward references resolved in later passes clear earlier errors)
    state = processPass(lines, state, {
      file,
      macros: scanResult.macros,
      maxIncludeDepth: 10,
    });

    // Convergence is driven purely by label-address stability. We require at
    // least two passes so forward references (labels defined later in the
    // file) have a chance to populate the symbol table before being used.
    const newSymbols = collectLabelAddresses(state.symbolTable);
    if (passNum > 1 && addressesEqual(prevSymbols, newSymbols)) {
      converged = true;
    }
  }

  if (!converged && passNum >= maxPasses) {
    state.errors.push({
      file,
      line: 0,
      message: `Assembly did not converge after ${maxPasses} passes (possible infinite loop in relaxation)`,
      type: "error",
    });
  }

  // Format output
  const output = formatOutput(
    state.generated,
    state.symbolTable.all(),
    state.errors,
    state.warnings,
  );

  return {
    binary: Array.from(output.binary),
    listing: state.generated,
    symbolTable: state.symbolTable.all(),
    errors: state.errors,
    warnings: state.warnings,
    passes: passNum,
  };
}

/**
 * Extract label addresses from symbol table for convergence checking
 */
function collectLabelAddresses(symbolTable: SymbolTable): Map<string, number> {
  const addresses = new Map<string, number>();
  for (const sym of symbolTable.all()) {
    if (sym.type === "label" && typeof sym.address === "number") {
      addresses.set(sym.name, sym.address);
    }
  }
  return addresses;
}

/**
 * Compare two label address maps
 */
function addressesEqual(
  a: Map<string, number>,
  b: Map<string, number>,
): boolean {
  if (a.size !== b.size) {
    return false;
  }

  for (const [name, addrA] of a) {
    const addrB = b.get(name);
    if (addrB !== addrA) {
      return false;
    }
  }

  return true;
}

/**
 * Load file and assemble it
 */
export function assembleFile(
  filename: string,
  options?: Partial<AssemblerOptions>,
): AssemblyResult {
  const content = readFileSync(filename, "utf-8");
  return assemble(content, {
    file: filename,
    maxPasses: options?.maxPasses ?? 10,
  });
}

/**
 * Convert assembly result to printable format
 */
export function printAssemblyResult(result: AssemblyResult): string {
  const lines: string[] = [];

  lines.push("=".repeat(80));
  lines.push("ASSEMBLY RESULT");
  lines.push("=".repeat(80));
  lines.push("");

  lines.push(`Passes: ${result.passes}`);
  lines.push(`Binary size: ${result.binary.length} bytes`);
  lines.push(`Errors: ${result.errors.length}`);
  lines.push(`Warnings: ${result.warnings.length}`);
  lines.push("");

  // Hex dump (first 256 bytes)
  if (result.binary.length > 0) {
    lines.push("MEMORY IMAGE (first 256 bytes):");
    lines.push("-".repeat(80));
    for (let i = 0; i < Math.min(256, result.binary.length); i += 16) {
      const addr = i.toString(16).padStart(4, "0").toUpperCase();
      const bytes = result.binary
        .slice(i, i + 16)
        .map((b) => (b as number).toString(16).padStart(2, "0").toUpperCase())
        .join(" ");
      lines.push(`${addr}: ${bytes}`);
    }
    lines.push("");
  }

  // Symbol table
  const symbols = result.symbolTable;
  if (symbols.length > 0) {
    lines.push("SYMBOL TABLE:");
    lines.push("-".repeat(80));
    const labels = symbols
      .filter((s) => s.type === "label")
      .sort((a, b) => (a.address ?? 0) - (b.address ?? 0));
    for (const sym of labels) {
      const addr = (sym.address ?? 0)
        .toString(16)
        .padStart(4, "0")
        .toUpperCase();
      lines.push(`  ${sym.name.padEnd(20)} = $${addr}`);
    }
    lines.push("");
  }

  // Errors
  if (result.errors.length > 0) {
    lines.push("ERRORS:");
    lines.push("-".repeat(80));
    for (const err of result.errors) {
      lines.push(`  Line ${err.line}: ${err.message}`);
    }
    lines.push("");
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push("WARNINGS:");
    lines.push("-".repeat(80));
    for (const warn of result.warnings) {
      lines.push(`  Line ${warn.line}: ${warn.message}`);
    }
    lines.push("");
  }

  lines.push("=".repeat(80));

  return lines.join("\n");
}
