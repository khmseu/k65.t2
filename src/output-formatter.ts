/**
 * Output Formatter
 * Generates hex listing, binary image, and symbol table from assembly results
 */

import type {
  Symbol,
  GeneratedLine,
  AssemblyError,
  ListingEvent,
} from "./assembler-types.js";

export interface FormattedOutput {
  listing: string; // Hex dump with addresses and annotations
  binary: Buffer; // Raw binary image
  symbolTable: string; // Symbol table dump
}

const hex2 = (n: number) => (n & 0xff).toString(16).padStart(2, "0");
const hex4 = (n: number) =>
  (n & 0xffff).toString(16).padStart(4, "0").toUpperCase();

/**
 * Generate a formatted hex listing with addresses and source annotations.
 *
 * Listing-control directives (title/subttl/page/eject/pagesize/bytesperline/
 * list/nolist/print) are replayed in source order via `events`, each tagged
 * with the number of generated code lines that preceded it. The renderer
 * paginates output, prints a per-page header with the running title/subtitle,
 * wraps object bytes at the current bytes-per-line, suppresses output between
 * `.nolist`/`.list`, and emits `.print` messages inline.
 */
export function formatListing(
  generated: GeneratedLine[],
  errors: AssemblyError[],
  warnings: AssemblyError[],
  events: ListingEvent[] = [],
): string {
  const lines: string[] = [];

  lines.push("=".repeat(80));
  lines.push("HEX LISTING");
  lines.push("=".repeat(80));

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

  // Group listing events by the generated-line index they follow.
  const eventsByAfter = new Map<number, ListingEvent[]>();
  for (const ev of events) {
    if (!eventsByAfter.has(ev.after)) {
      eventsByAfter.set(ev.after, []);
    }
    eventsByAfter.get(ev.after)!.push(ev);
  }

  // Listing-control state, with MACRO-10-ish defaults.
  let title = "";
  let subttl = "";
  let pageSize = 60; // body lines per page; 0 disables automatic paging
  let bytesPerLine = 8; // object bytes shown per listing line
  let listEnabled = true; // .nolist suppresses body lines until .list
  let pageNum = 0;
  let lineOnPage = 0;
  let needHeader = true; // emit a page header before the next body line

  const startNewPage = () => {
    pageNum++;
    lineOnPage = 0;
    lines.push("");
    lines.push(title ? `Page ${pageNum}   ${title}` : `Page ${pageNum}`);
    if (subttl) {
      lines.push(`          ${subttl}`);
    }
    lines.push("-".repeat(80));
  };

  // Emit one body line, starting a new page first if a header is pending or the
  // current page is full. No-op while listing is disabled.
  const emitBody = (text: string) => {
    if (!listEnabled) {
      return;
    }
    if (needHeader || (pageSize > 0 && lineOnPage >= pageSize)) {
      startNewPage();
      needHeader = false;
    }
    lines.push(text);
    lineOnPage++;
  };

  const applyEvents = (idx: number) => {
    const evs = eventsByAfter.get(idx);
    if (!evs) {
      return;
    }
    for (const ev of evs) {
      switch (ev.type) {
        case "title":
          title = ev.text ?? "";
          needHeader = true; // a new title starts a new page
          break;
        case "subttl":
          subttl = ev.text ?? ""; // updates the running subtitle
          break;
        case "page":
          needHeader = true;
          break;
        case "pagesize":
          if (ev.value && ev.value > 0) {
            pageSize = ev.value;
          }
          break;
        case "bytesperline":
          if (ev.value && ev.value > 0) {
            bytesPerLine = ev.value;
          }
          break;
        case "list":
          listEnabled = true;
          break;
        case "nolist":
          listEnabled = false;
          break;
        case "print":
          // PRINTX-style message: always shown, independent of paging.
          lines.push(`*** ${ev.text ?? ""}`);
          break;
      }
    }
  };

  // Format each generated line, replaying any listing events that precede it.
  for (let i = 0; i < generated.length; i++) {
    applyEvents(i);

    const gen = generated[i]!;
    const width = bytesPerLine * 3; // "xx " per byte

    if (gen.bytes.length === 0) {
      emitBody(`${hex4(gen.address)}: ${"".padEnd(width)} ${gen.sourceText}`);
    } else {
      // Wrap object bytes at the current bytes-per-line; only the first chunk
      // carries the source text, continuation chunks show their own address.
      for (let off = 0; off < gen.bytes.length; off += bytesPerLine) {
        const chunk = gen.bytes.slice(off, off + bytesPerLine);
        const bytesHex = chunk.map(hex2).join(" ").padEnd(width);
        const text = off === 0 ? gen.sourceText : "";
        emitBody(`${hex4(gen.address + off)}: ${bytesHex} ${text}`);
      }
    }

    // Annotate errors and warnings
    if (errorMap.has(gen.sourceLine)) {
      for (const err of errorMap.get(gen.sourceLine)!) {
        emitBody(`       ERROR: ${err.message}`);
      }
    }

    if (warningMap.has(gen.sourceLine)) {
      for (const warn of warningMap.get(gen.sourceLine)!) {
        emitBody(`       WARNING: ${warn.message}`);
      }
    }
  }

  // Replay any trailing events that follow the last generated line.
  applyEvents(generated.length);

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
  events: ListingEvent[] = [],
): FormattedOutput {
  const listing = formatListing(generated, errors, warnings, events);
  const binary = generateBinary(generated);
  const symbolTable = formatSymbolTable(symbols);

  return { listing, binary, symbolTable };
}
