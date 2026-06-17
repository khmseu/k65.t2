/**
 * Output Formatter
 * Generates hex listing, binary image, and symbol table from assembly results
 */

import type {
  Symbol,
  GeneratedLine,
  AssemblyError,
} from "./assembler-types.js";

export interface FormattedOutput {
  listing: string; // Hex dump with addresses and annotations
  binary: Buffer; // Raw binary image
  symbolTable: string; // Symbol table dump
}

/**
 * Generate a formatted hex listing with addresses and source annotations
 */
export function formatListing(
  generated: GeneratedLine[],
  errors: AssemblyError[],
  warnings: AssemblyError[],
): string {
  const lines: string[] = [];

  lines.push("=".repeat(80));
  lines.push("HEX LISTING");
  lines.push("=".repeat(80));
  lines.push("");

  // Create error/warning map for quick lookup
  const errorMap = new Map<number, AssemblyError[]>();
  const warningMap = new Map<number, AssemblyError[]>();

  for (const err of errors) {
    const key = err.line;
    if (!errorMap.has(key)) {
      errorMap.set(key, []);
    }
    errorMap.get(key)!.push(err);
  }

  for (const warn of warnings) {
    const key = warn.line;
    if (!warningMap.has(key)) {
      warningMap.set(key, []);
    }
    warningMap.get(key)!.push(warn);
  }

  // Format each generated line
  for (const gen of generated) {
    const addr = gen.address.toString(16).padStart(4, "0").toUpperCase();
    const bytesHex = gen.bytes
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    const bytesStr = bytesHex.padEnd(24);

    lines.push(`${addr}: ${bytesStr} ${gen.sourceText}`);

    // Annotate errors and warnings
    if (errorMap.has(gen.sourceLine)) {
      for (const err of errorMap.get(gen.sourceLine)!) {
        lines.push(`       ERROR: ${err.message}`);
      }
    }

    if (warningMap.has(gen.sourceLine)) {
      for (const warn of warningMap.get(gen.sourceLine)!) {
        lines.push(`       WARNING: ${warn.message}`);
      }
    }
  }

  lines.push("");
  lines.push("=".repeat(80));

  return lines.join("\n");
}

/**
 * Generate binary image from generated lines
 * Fills gaps with zeros (undefined memory)
 */
export function generateBinary(generated: GeneratedLine[]): Buffer {
  if (generated.length === 0) {
    return Buffer.alloc(0);
  }

  // Find highest address
  let maxAddr = 0;
  for (const gen of generated) {
    const endAddr = gen.address + gen.bytes.length;
    if (endAddr > maxAddr) {
      maxAddr = endAddr;
    }
  }

  const binary = Buffer.alloc(maxAddr);
  binary.fill(0);

  // Write bytes to binary
  for (const gen of generated) {
    for (let i = 0; i < gen.bytes.length; i++) {
      const idx = (gen.address || 0) + i;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (binary as any)[idx] = gen.bytes[i];
    }
  }

  return binary;
}

/**
 * Generate symbol table dump
 */
export function formatSymbolTable(symbols: Symbol[]): string {
  const lines: string[] = [];

  lines.push("=".repeat(80));
  lines.push("SYMBOL TABLE");
  lines.push("=".repeat(80));
  lines.push("");

  const labels = symbols
    .filter((s) => s.type === "label")
    .sort((a, b) => (a.address ?? 0) - (b.address ?? 0));
  const constants = symbols
    .filter((s) => s.type === "constant")
    .sort((a, b) => a.name.localeCompare(b.name));
  const macros = symbols
    .filter((s) => s.type === "macro")
    .sort((a, b) => a.name.localeCompare(b.name));

  if (labels.length > 0) {
    lines.push("LABELS:");
    lines.push("-".repeat(80));
    for (const sym of labels) {
      const addr = (sym.address ?? 0)
        .toString(16)
        .padStart(4, "0")
        .toUpperCase();
      lines.push(`  ${sym.name.padEnd(20)} = $${addr} (${sym.address ?? 0})`);
    }
    lines.push("");
  }

  if (constants.length > 0) {
    lines.push("CONSTANTS:");
    lines.push("-".repeat(80));
    for (const sym of constants) {
      const val = sym.value;
      const valStr =
        typeof val === "number"
          ? `$${val.toString(16).toUpperCase()} (${val})`
          : String(val);
      lines.push(`  ${sym.name.padEnd(20)} = ${valStr}`);
    }
    lines.push("");
  }

  if (macros.length > 0) {
    lines.push("MACROS:");
    lines.push("-".repeat(80));
    for (const sym of macros) {
      const paramStr = sym.macroParams
        ? sym.macroParams.join(", ")
        : "(no params)";
      lines.push(`  ${sym.name} (${paramStr})`);
    }
    lines.push("");
  }

  lines.push("=".repeat(80));

  return lines.join("\n");
}

/**
 * Format all assembly output components
 */
export function formatOutput(
  generated: GeneratedLine[],
  symbols: Symbol[],
  errors: AssemblyError[],
  warnings: AssemblyError[],
): FormattedOutput {
  const listing = formatListing(generated, errors, warnings);
  const binary = generateBinary(generated);
  const symbolTable = formatSymbolTable(symbols);

  return { listing, binary, symbolTable };
}
