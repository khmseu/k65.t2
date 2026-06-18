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

  // --- Phase 1: flatten the listing into a stream of body lines and control
  // markers, without paginating. Byte-per-line wrapping and .list/.nolist
  // suppression are resolved here; pagination and page headers are resolved in
  // phase 2 so a page header can reflect a title/subtitle that appears partway
  // down the page.
  type Item =
    | { kind: "body"; text: string }
    | { kind: "title"; value: string }
    | { kind: "subttl"; value: string }
    | { kind: "page" }
    | { kind: "pagesize"; value: number }
    | { kind: "print"; text: string };

  const items: Item[] = [];
  let bytesPerLine = 8; // object bytes shown per listing line
  let listEnabled = true; // .nolist suppresses body lines until .list

  const applyEvents = (idx: number) => {
    const evs = eventsByAfter.get(idx);
    if (!evs) {
      return;
    }
    for (const ev of evs) {
      switch (ev.type) {
        case "title":
          items.push({ kind: "title", value: ev.text ?? "" });
          break;
        case "subttl":
          items.push({ kind: "subttl", value: ev.text ?? "" });
          break;
        case "page":
          items.push({ kind: "page" });
          break;
        case "pagesize":
          if (ev.value && ev.value > 0) {
            items.push({ kind: "pagesize", value: ev.value });
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
          items.push({ kind: "print", text: `*** ${ev.text ?? ""}` });
          break;
      }
    }
  };

  const emitBody = (text: string) => {
    if (listEnabled) {
      items.push({ kind: "body", text });
    }
  };

  // Format each generated line, replaying any listing events that precede it.
  for (let i = 0; i < generated.length; i++) {
    applyEvents(i);

    const gen = generated[i]!;
    const width = bytesPerLine * 3; // "xx " per byte

    // Overlay an info address (branch target / assigned value) onto the last
    // four columns of a byte field of the given width.
    const overlayInfo = (field: string): string => {
      if (gen.infoAddress === undefined) {
        return field;
      }
      const padded = field.padEnd(width);
      return padded.slice(0, Math.max(0, width - 4)) + hex4(gen.infoAddress);
    };

    if (gen.bytes.length === 0) {
      emitBody(
        `${hex4(gen.address)}: ${overlayInfo("".padEnd(width))} ${gen.sourceText}`,
      );
    } else {
      // Wrap object bytes at the current bytes-per-line; only the first chunk
      // carries the source text, continuation chunks show their own address.
      // The info address (if any) is shown on the first chunk only.
      for (let off = 0; off < gen.bytes.length; off += bytesPerLine) {
        const chunk = gen.bytes.slice(off, off + bytesPerLine);
        const bytesHex = chunk.map(hex2).join(" ").padEnd(width);
        const field = off === 0 ? overlayInfo(bytesHex) : bytesHex;
        const text = off === 0 ? gen.sourceText : "";
        emitBody(`${hex4(gen.address + off)}: ${field} ${text}`);
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

  // --- Phase 2: group the item stream into pages. A `.title` starts a new page
  // and a `.page` forces one; `.pagesize` changes the running page length. The
  // header for each page uses the FIRST title/subtitle that lands on that page
  // (falling back to the running value carried from earlier pages).
  interface Page {
    title?: string;
    subttl?: string;
    lines: string[];
  }
  const pages: Page[] = [];
  let pageSize = 60; // body lines per page; 0 disables automatic paging
  let runningTitle = "";
  let runningSubttl = "";
  let cur: Page = { lines: [] };
  let open = false; // whether `cur` is the active page receiving content

  // Finalize `cur`: a page with no title/subtitle of its own inherits the
  // value running at the moment it is closed. Only non-empty pages are kept.
  const finishPage = () => {
    if (cur.lines.length > 0) {
      cur.title ??= runningTitle;
      cur.subttl ??= runningSubttl;
      pages.push(cur);
    }
    cur = { lines: [] };
    open = false;
  };

  for (const item of items) {
    switch (item.kind) {
      case "pagesize":
        pageSize = item.value;
        break;
      case "page":
        finishPage();
        break;
      case "title":
        // The title belongs to the page being built; the first one on a page
        // wins for that page's header. Page breaks come from `.page`/page fill.
        runningTitle = item.value;
        cur.title ??= item.value;
        open = true;
        break;
      case "subttl":
        // The subtitle belongs to the page being built; the first one on a
        // page wins for that page's header.
        runningSubttl = item.value;
        cur.subttl ??= item.value;
        open = true;
        break;
      case "body":
      case "print":
        if (!open || (pageSize > 0 && cur.lines.length >= pageSize)) {
          finishPage();
          open = true;
        }
        cur.lines.push(item.text);
        break;
    }
  }
  finishPage();

  // --- Render the pages with their headers.
  let pageNum = 0;
  for (const page of pages) {
    pageNum++;
    const title = page.title ?? "";
    const subttl = page.subttl ?? "";
    lines.push("");
    lines.push(title ? `Page ${pageNum}   ${title}` : `Page ${pageNum}`);
    if (subttl) {
      lines.push(`          ${subttl}`);
    }
    lines.push("-".repeat(80));
    for (const text of page.lines) {
      lines.push(text);
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
 * Generate symbol table dump.
 *
 * Labels and constants are listed twice: once sorted numerically (by address /
 * value) and once sorted alphabetically by name, so a symbol can be found
 * either way. Macros are listed once, alphabetically.
 */
export function formatSymbolTable(symbols: Symbol[]): string {
  const lines: string[] = [];

  lines.push("=".repeat(80));
  lines.push("SYMBOL TABLE");
  lines.push("=".repeat(80));
  lines.push("");

  // Numeric value of a symbol: address for labels, value for constants.
  const valueOf = (s: Symbol): number => {
    const raw = s.type === "label" ? s.address : s.value;
    return typeof raw === "number" ? raw : 0;
  };

  const valued = symbols.filter(
    (s) => s.type === "label" || s.type === "constant",
  );
  const macros = symbols
    .filter((s) => s.type === "macro")
    .sort((a, b) => a.name.localeCompare(b.name));

  const formatSym = (sym: Symbol): string => {
    const v = valueOf(sym);
    const addr = (v & 0xffff).toString(16).padStart(4, "0").toUpperCase();
    const kind = sym.type === "label" ? "label" : "const";
    return `  ${sym.name.padEnd(20)} = $${addr} (${v})  [${kind}]`;
  };

  if (valued.length > 0) {
    const byValue = [...valued].sort((a, b) => valueOf(a) - valueOf(b));
    lines.push("BY VALUE (numerical):");
    lines.push("-".repeat(80));
    for (const sym of byValue) {
      lines.push(formatSym(sym));
    }
    lines.push("");

    const byName = [...valued].sort((a, b) => a.name.localeCompare(b.name));
    lines.push("BY NAME (alphabetical):");
    lines.push("-".repeat(80));
    for (const sym of byName) {
      lines.push(formatSym(sym));
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
  listingLines: GeneratedLine[],
  symbols: Symbol[],
  errors: AssemblyError[],
  warnings: AssemblyError[],
  events: ListingEvent[] = [],
): FormattedOutput {
  const listing = formatListing(listingLines, errors, warnings, events);
  const binary = generateBinary(generated);
  const symbolTable = formatSymbolTable(symbols);

  return { listing, binary, symbolTable };
}
