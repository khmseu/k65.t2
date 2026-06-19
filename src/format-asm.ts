#!/usr/bin/env node

/**
 * Assembly source formatter CLI.
 * Reformats 6502 assembly source to fixed-width columns with normalized expressions.
 *
 * Usage:
 *   npx format-asm <input-file> [output-file] [--config <config-file>]
 *   npx format-asm test/m6502.converted.asm > formatted.asm
 *   npx format-asm test/m6502.converted.asm formatted.asm --config docs/format-asm.config.json
 */

import * as fs from "fs";
import { parseLine } from "./ma6-parser-wrapper.js";
import { formatLine } from "./format/line-formatter.js";
import { detectColumnWidths } from "./format/width-detector.js";
import { loadConfig } from "./format/config-loader.js";
import type { FormattedLine, ColumnWidths } from "./formatter-types.js";

interface CLIArgs {
  inputFile: string;
  outputFile?: string | undefined;
  configFile?: string | undefined;
}

/**
 * Parse command-line arguments.
 */
function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(
      "Usage: format-asm <input-file> [output-file] [--config <config-file>]",
    );
    process.exit(1);
  }

  const inputFile = args[0]!;
  let outputFile: string | undefined;
  let configFile: string | undefined;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--config" && i + 1 < args.length) {
      configFile = args[++i];
    } else if (arg && !arg.startsWith("-")) {
      if (!outputFile) {
        outputFile = arg;
      }
    }
  }

  return { inputFile, outputFile, configFile };
}

/**
 * Read and parse all lines from an assembly source file.
 */
function readAndParseLines(filePath: string): FormattedLine[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Failed to read file "${filePath}": ${msg}`);
    process.exit(1);
  }

  const lines = content.split("\n");
  const formattedLines: FormattedLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const sourceLineNum = i + 1;
    const source = lines[i] ?? "";

    const parseResult = parseLine(source);
    const formatted = formatLine(source, parseResult.ast, sourceLineNum);
    formattedLines.push(formatted);

    if (parseResult.error) {
      console.warn(`Line ${sourceLineNum}: ${parseResult.error}`);
    }
  }

  return formattedLines;
}

/**
 * Collapse consecutive blank lines (keep only the first of each sequence).
 */
function collapseBlankLines(lines: FormattedLine[]): FormattedLine[] {
  const result: FormattedLine[] = [];
  let lastWasBlank = false;

  for (const line of lines) {
    if (line.isBlank) {
      if (!lastWasBlank) {
        result.push(line);
        lastWasBlank = true;
      }
    } else {
      result.push(line);
      lastWasBlank = false;
    }
  }

  return result;
}

/**
 * Render formatted lines with fixed-width columns.
 */
function renderLines(lines: FormattedLine[], widths: ColumnWidths): string[] {
  const output: string[] = [];

  for (const line of lines) {
    if (line.isBlank) {
      output.push("");
      continue;
    }

    // Pad each column to its width, then concatenate
    let formatted = "";
    formatted += line.label.padEnd(widths.label);
    formatted += line.operation.padEnd(widths.operation);
    formatted += line.arguments.padEnd(widths.arguments);

    // Append comment (no padding needed for last column)
    if (line.comment) {
      formatted += "; " + line.comment;
    }

    output.push(formatted.trimEnd());
  }

  return output;
}

/**
 * Main entry point.
 */
async function main() {
  const args = parseArgs();

  // Read and parse all lines
  console.error(`Reading ${args.inputFile}...`);
  const formattedLines = readAndParseLines(args.inputFile);
  console.error(`Parsed ${formattedLines.length} lines.`);

  // Collapse consecutive blanks
  const collapsed = collapseBlankLines(formattedLines);
  console.error(
    `Collapsed blank lines: ${formattedLines.length} → ${collapsed.length} lines.`,
  );

  // Load or auto-detect column widths
  let widths: ColumnWidths;
  try {
    const config = loadConfig(args.configFile);
    const detected = detectColumnWidths(collapsed);

    // Use config widths if non-zero, otherwise use detected
    widths = {
      label: config.columnWidths.label || detected.label,
      operation: config.columnWidths.operation || detected.operation,
      arguments: config.columnWidths.arguments || detected.arguments,
      comment: config.columnWidths.comment || detected.comment,
    };

    if (args.configFile) {
      console.error(
        `Using config-provided widths: label=${widths.label}, op=${widths.operation}, args=${widths.arguments}, comment=${widths.comment}`,
      );
    } else {
      console.error(
        `Auto-detected widths: label=${widths.label}, op=${widths.operation}, args=${widths.arguments}, comment=${widths.comment}`,
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Config error: ${msg}`);
    process.exit(1);
  }

  // Render formatted output
  const output = renderLines(collapsed, widths);
  const outputText = output.join("\n") + "\n";

  // Write output
  if (args.outputFile) {
    try {
      fs.writeFileSync(args.outputFile, outputText, "utf-8");
      console.error(`Wrote ${args.outputFile}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Failed to write output file: ${msg}`);
      process.exit(1);
    }
  } else {
    // Write to stdout
    process.stdout.write(outputText);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
