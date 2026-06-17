import * as fs from "node:fs";
import { URL } from "node:url";
import { parse } from "node:path";
/**
 * MACRO-10 to k65.t Assembly Converter
 *
 * INPUT FORMAT: MACRO-10 (PDP-10 assembly language)
 *   - Macro parameters referenced with backslash: \WD, \Q, etc.
 *   - Directives: DEFINE/ENDM, IFE/IFN/ENDIF, REPEAT/ENDREPEAT
 *   - Pseudo-ops: ORG, EQU, DC, DT, ADR, XWD, etc.
 *   - Cheap labels with % prefix: %LABEL
 *
 * OUTPUT FORMAT: k65.t2 (6502 assembly language)
 *   - Macro parameters referenced with backslash: \WD, \Q, etc.
 *   - Directives: .macro/.endmacro, .if/.endif, .repeat/.endrepeat
 *   - Pseudo-ops: .org, .equ, .byte, .text, .word, etc.
 *   - Cheap labels with @ prefix: @LABEL (converted from %)
 *
 * SYMBOL SEMANTICS (MACRO-10):
 * - First 6 characters only (case-insensitive)
 * - Valid chars: letters, numerals, . $ %
 * - % prefix = cheap label (convert to @)
 */
function isValidSymbolChar(ch) {
  return /[A-Za-z0-9.$%]/.test(ch);
}
function normalizeSymbol(name) {
  // Convert % prefix to @ (cheap label marker)
  let normalized = name.startsWith("%") ? "@" + name.slice(1) : name;
  // Replace invalid characters with underscores
  normalized = normalized.replace(/[^A-Za-z0-9.$@]/g, "_");
  // TRUNCATE TO 6 CHARACTERS (MACRO-10 semantics)
  // This is critical: MACRO-10 only recognizes first 6 chars of symbols
  if (normalized.length > 6) {
    normalized = normalized.slice(0, 6);
  }
  return normalized;
}
function collectSymbols(lines) {
  const symbolMap = new Map();
  const keywords = new Set([
    "DEFINE",
    "ENDM",
    "MACRO",
    "IFE",
    "IFN",
    "IF1",
    "IF2",
    "ELSE",
    "ENDIF",
    "REPEAT",
    "ENDREPEAT",
    "TITLE",
    "SUBTTL",
    "PAGE",
    "ORG",
    "BLOCK",
    "EXP",
    "SEARCH",
    "PRINTX",
    "DC",
    "DT",
    "ADR",
    "XWD",
    "COMMENT",
    "SALL",
    "RADIX",
    "LDA",
    "LDX",
    "LDY",
    "STA",
    "STX",
    "STY",
    "ADC",
    "SBC",
    "CMP",
    "CPX",
    "CPY",
    "AND",
    "ORA",
    "EOR",
    "ASL",
    "LSR",
    "ROL",
    "ROR",
    "BIT",
    "BEQ",
    "BNE",
    "BCC",
    "BCS",
    "BMI",
    "BPL",
    "BVC",
    "BVS",
    "JMP",
    "JSR",
    "RTS",
    "RTI",
    "BRK",
    "NOP",
    "CLC",
    "SEC",
    "CLD",
    "SED",
    "CLI",
    "SEI",
    "CLV",
    "TAX",
    "TXA",
    "TAY",
    "TYA",
    "TSX",
    "TXS",
    "PHA",
    "PLA",
    "PHP",
    "PLP",
    "A",
    "X",
    "Y",
    "S",
    "P",
  ]);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("*"))
      continue;
    // Extract symbols from the line
    let inString = false;
    let stringChar = "";
    let current = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inString) {
        if (ch === stringChar && line[i - 1] !== "\\") inString = false;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "/") {
        inString = true;
        stringChar = ch;
        continue;
      }
      if (ch === ";") break; // Rest is comment
      if (/[A-Za-z_%@]/.test(ch)) {
        current += ch;
      } else {
        if (current && !keywords.has(current.toUpperCase())) {
          const normalized = normalizeSymbol(current);
          const key6 = normalized.slice(0, 6).toUpperCase();
          if (!symbolMap.has(key6)) symbolMap.set(key6, new Set());
          symbolMap.get(key6).add(normalized);
        }
        current = "";
      }
    }
    if (current && !keywords.has(current.toUpperCase())) {
      const normalized = normalizeSymbol(current);
      const key6 = normalized.slice(0, 6).toUpperCase();
      if (!symbolMap.has(key6)) symbolMap.set(key6, new Set());
      symbolMap.get(key6).add(normalized);
    }
  }
  return symbolMap;
}
function createSymbolAliases(symbolMap) {
  const groups = [];
  for (const [key6, variants] of symbolMap) {
    if (variants.size <= 1) continue; // No collision
    // Select longest variant as canonical
    const variantArray = Array.from(variants).sort(
      (a, b) => b.length - a.length,
    );
    const canonical = variantArray[0];
    groups.push({
      canonical6: key6,
      canonical,
      variants: variantArray.slice(1),
    });
  }
  return groups.sort((a, b) => a.canonical.localeCompare(b.canonical));
}
function generateAliasDirectives(groups) {
  const directives = [];
  for (const group of groups) {
    for (const variant of group.variants) {
      directives.push(
        `${variant}=${group.canonical} ; Alias for ${group.canonical}`,
      );
    }
  }
  return directives;
}
function uppercaseNonComment(line) {
  let result = "";
  let inString = false;
  let stringChar = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      result += ch;
      if (ch === stringChar && line[i - 1] !== "\\") inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "/") {
      inString = true;
      stringChar = ch;
      result += ch;
      continue;
    }
    if (ch === ";") {
      result += line.slice(i); // Rest is comment
      break;
    }
    result += ch.toUpperCase();
  }
  return result;
}
function normalizeSymbolsInLine(line) {
  let result = "";
  let inString = false;
  let stringChar = "";
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      result += ch;
      if (ch === stringChar && line[i - 1] !== "\\") inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "/") {
      // Flush any accumulated symbol before entering a string
      if (current && /^[A-Za-z_%@]/.test(current[0])) {
        result += normalizeSymbol(current);
      } else {
        result += current;
      }
      current = "";
      inString = true;
      stringChar = ch;
      result += ch;
      continue;
    }
    if (ch === ";") {
      // In comments: don't normalize, preserve as-is
      if (current) result += current;
      result += line.slice(i);
      break;
    }
    if (/[A-Za-z0-9.$%@_]/.test(ch)) {
      current += ch;
    } else {
      // Only normalize if it looks like a symbol (not empty, and valid)
      if (current && /^[A-Za-z_%@]/.test(current[0])) {
        result += normalizeSymbol(current);
      } else {
        result += current;
      }
      result += ch;
      current = "";
    }
  }
  // Final symbol
  if (current && /^[A-Za-z_%@]/.test(current[0])) {
    result += normalizeSymbol(current);
  } else {
    result += current;
  }
  return result;
}
/**
 * Converts MACRO-10 assembler format to k65.t2 format.
 *
 * Takes MACRO-10 assembly source code (PDP-10 format) and converts it to
 * k65.t2 assembly format (6502 assembly). Handles:
 * - Symbol normalization (MACRO-10 6-char limit)
 * - Macro definition and usage conversion
 * - Directive translation (ORG → .org, etc.)
 * - Label conversion (% prefix → @)
 * - Expression handling (.+4 → *+4)
 */
export function convertMacro10ToK65(content) {
  // Two-pass approach: normalize symbols and uppercase non-comments
  let lines = content.split(/\r?\n/);
  // Pass 1: Uppercase and normalize
  const uppercasedLines = lines.map((line) => {
    if (line.trim().startsWith(";") || line.trim().startsWith("*")) return line;
    return normalizeSymbolsInLine(uppercaseNonComment(line));
  });
  // Pass 2: No alias generation - symbols are truncated to 6 chars
  lines = uppercasedLines;
  const outLines = [];
  const blockStack = [];
  let angleDepth = 0;
  let inBlockComment = false;
  /**
   * Applies all regex-based replacements and macro argument expansions iteratively.
   */
  function performReplacements(text, macroArgs) {
    let current = text;
    // Apply macro argument replacements first (only once to avoid recursion)
    for (const arg of macroArgs) {
      current = current.split(`<${arg}>`).join(`\\${arg}`);
      // Use negative lookbehind to avoid replacing inside already-replaced \...
      const argRegex = new RegExp(`(?<!\\\\)\\b${arg}\\b`, "g");
      current = current.replace(argRegex, `\\${arg}`);
    }
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 10) {
      let start = current;
      current = current.replace(/\^O([0-7]+)/g, "0o$1");
      current = current.replace(
        /(^|[^A-Za-z0-9_.])\.(\=|[^A-Za-z0-9_.]|$)/g,
        "$1*$2",
      );
      current = current.replace(/%([A-Za-z0-9_]+)/g, "@$1");
      // current = current.replace(/^\s*\$([A-Za-z0-9_]+):/, "_$1:");
      current = current.replace(/\bLDAI\s+(.*)/, "LDA #$1");
      current = current.replace(/\bLDXI\s+(.*)/, "LDX #$1");
      current = current.replace(/\bLDYI\s+(.*)/, "LDY #$1");
      current = current.replace(/\bADCI\s+(.*)/, "ADC #$1");
      current = current.replace(/\bSBCI\s+(.*)/, "SBC #$1");
      current = current.replace(/\bCMPI\s+(.*)/, "CMP #$1");
      current = current.replace(/\bCPXI\s+(.*)/, "CPX #$1");
      current = current.replace(/\bCPYI\s+(.*)/, "CPY #$1");
      current = current.replace(/\bANDI\s+(.*)/, "AND #$1");
      current = current.replace(/\bORAI\s+(.*)/, "ORA #$1");
      current = current.replace(/\bEORI\s+(.*)/, "EOR #$1");
      current = current.replace(/\bASL\s+A\b/, "ASL A");
      current = current.replace(/\bLSR\s+A\b/, "LSR A");
      current = current.replace(/\bROL\s+A\b/, "ROL A");
      current = current.replace(/\bROR\s+A\b/, "ROR A");
      current = current.replace(/\bLDADY\s+(.*)/, "LDA ($1),Y");
      current = current.replace(/\bSTADY\s+(.*)/, "STA ($1),Y");
      current = current.replace(/\bCMPDY\s+(.*)/, "CMP ($1),Y");
      current = current.replace(/\bSBCDY\s+(.*)/, "SBC ($1),Y");
      current = current.replace(/^\s*TITLE\s+(.*)/, '.title "$1"');
      current = current.replace(/^\s*SUBTTL\s+(.*)/, '.subttl "$1"');
      current = current.replace(/^(\s*)PAGE/, "$1.page");
      current = current.replace(/^(\s*)ORG\s+(.*)/, "$1.org $2");
      current = current.replace(/\bBLOCK\s+(.*)/, ".fill $1");
      current = current.replace(/^(\s*)EXP\s+(.*)/, "$1.word $2");
      current = current.replace(/^(\s*)SEARCH\s+(.*)/, '$1.include "$2.asm"');
      current = current.replace(/([\\@A-Za-z0-9_\$]+)\s*==\s*(.*)/, "$1 = $2");
      current = current.replace(
        /\bPRINTX\s*([^\sA-Za-z0-9])(.*)\\1/g,
        '.print "$2"',
      );
      current = current.replace(/^\s*PRINTX\s+([^\/"\s>][^>]*)/, '.print "$1"');
      // Directives with optional spaces
      current = current.replace(/\bDC\s*"(.*?)"/g, '.textc "$1"');
      current = current.replace(/\bDT\s*"(.*?)"/g, '.text "$1"');
      current = current.replace(/\bDC\s*\((.*)\)/g, '.textc "$1"');
      current = current.replace(/\bDT\s*\((.*)\)/g, '.text "$1"');
      current = current.replace(/\bADR\s*\((.*?)\)/g, ".word $1");
      // XWD 0o1000,number -> .byte <low byte of number>
      // XWD is a PDP-10 "skip 2 words" macro; on 6502 we just emit the low byte
      current = current.replace(/\bXWD\s+0o1000\s*,\s*(\d+)/g, (match, num) => {
        const n = parseInt(num, 10);
        return `.byte ${n & 0xff}`;
      });
      current = current.replace(
        /\bXWD\s+0o1000\s*,\s*0o([0-7]+)/g,
        (match, octal) => {
          const n = parseInt(octal, 8);
          return `.byte ${n & 0xff}`;
        },
      );
      current = current.replace(
        /\bXWD\s+0o1000\s*,\s*\$([A-Fa-f0-9]+)/g,
        (match, hex) => {
          const n = parseInt(hex, 16);
          return `.byte ${n & 0xff}`;
        },
      );
      changed = current !== start;
      iterations++;
    }
    return current;
  }
  /**
   * Finalizes a segment of code, extracting labels and applying the .byte rule.
   */
  function finalizeAndPush(text, macroArgs) {
    let current = text;
    // 1. Iteratively extract labels from the segment
    while (true) {
      const labelMatch = current.match(/^(\s*)([\@A-Za-z0-9_\$]+)::?(.*)/);
      if (!labelMatch) break;
      const indent = labelMatch[1] ?? "";
      const labelName = labelMatch[2] ?? "";
      const rest = labelMatch[3] ?? "";
      const labelLine = performReplacements(
        indent + labelName + ":",
        macroArgs,
      ).trimEnd();
      outLines.push(labelLine);
      current = indent + rest;
      if (!current.trim()) return;
    }
    // 2. Final replacements for the remaining instruction/data
    let final = performReplacements(current, macroArgs).trimEnd();
    if (!final && !text.includes(";")) return;
    // 3. Standalone string literal -> .byte (single char) or .text (multi-char)
    const stringMatch = final.match(/^(\s*)"(.*?)"(\s*(?:;.*)?)$/);
    if (stringMatch) {
      const indent = stringMatch[1] ?? "";
      const str = stringMatch[2] ?? "";
      const comment = stringMatch[3] ?? "";
      if (str.length === 1) {
        // Single character: emit as .byte with ASCII code
        const code = str.charCodeAt(0);
        outLines.push(`${indent}.byte ${code}${comment}`);
      } else {
        // Multi-character: emit as .text
        outLines.push(`${indent}.text "${str}"${comment}`);
      }
      return;
    }
    // 4. Standalone number or list of numbers -> .byte
    const numPart = "(?:0o[0-7]+|[0-9]+|\\$[A-Fa-f0-9]+)";
    const numRegex = new RegExp(
      `^(\\s*)(${numPart}(?:\\s*,\\s*${numPart})*)(\\s*(?:;.*)?)$`,
    );
    if (numRegex.test(final)) {
      final = final.replace(numRegex, "$1.byte $2$3");
    }
    outLines.push(final);
  }
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    let line = lines[lineIdx];
    if (!line.trim()) {
      outLines.push("");
      continue;
    }
    if (!inBlockComment && line.includes("COMMEN")) {
      // COMMENT * becomes COMMEN * after truncation to 6 chars
      inBlockComment = true;
      outLines.push(line.replace(/COMMEN\s*\*/, "*").trimEnd());
      const afterCommen = line.split(/COMMEN\s*\*/)[1];
      if (afterCommen?.includes("*")) inBlockComment = false;
      continue;
    }
    if (inBlockComment) {
      outLines.push("* " + line.trimEnd());
      if (line.includes("*")) inBlockComment = false;
      continue;
    }
    let processing = true;
    while (processing) {
      const lastBlock = blockStack[blockStack.length - 1];
      const currentArgs =
        lastBlock && lastBlock.type === "macro" ? lastBlock.args : [];
      // 1. Extract Labels (at start of line)
      const labelMatch = line.match(/^(\s*)([\@A-Za-z0-9_\$]+)::?(.*)/);
      if (labelMatch) {
        finalizeAndPush(
          (labelMatch[1] ?? "") + (labelMatch[2] ?? "") + ":",
          currentArgs,
        );
        line = (labelMatch[1] ?? "") + (labelMatch[3] ?? "");
        if (!line.trim()) break;
        continue;
      }
      // 2. Check for Block Starters
      let match;
      if (
        (match = line.match(
          /^(\s*)DEFINE\s+([A-Za-z0-9_\$]+)(?:\s*\((.*)\))?\s*,?\s*<(.*)/,
        ))
      ) {
        const args = (match[3] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s);
        finalizeAndPush(
          `${match[1]}.macro ${match[2]}${args.length > 0 ? ", " + args.join(", ") : ""}`,
          currentArgs,
        );
        blockStack.push({ type: "macro", args, startDepth: angleDepth });
        angleDepth++;
        line = (match[1] ?? "") + (match[4] ?? "");
        continue;
      } else if (
        (match = line.match(/^(\s*)(IFE|IFN|IF1|IF2)\s+(.*?),?\s*<(.*)/))
      ) {
        const cond = performReplacements(match[3] ?? "", currentArgs);
        let outCond = match[2] === "IFE" ? `(${cond}) == 0` : `(${cond}) != 0`;
        const minus = cond.match(/^([A-Za-z0-9_\$]+)\s*-\s*([A-Za-z0-9_\$]+)$/);
        if (minus && minus[1] && minus[2])
          outCond =
            match[2] === "IFE"
              ? `${minus[1]} == ${minus[2]}`
              : `${minus[1]} != ${minus[2]}`;
        if (match[2] === "IF1" || match[2] === "IF2") outCond = "1";
        finalizeAndPush(`${match[1]}.if ${outCond}`, currentArgs);
        blockStack.push({ type: "if", args: [], startDepth: angleDepth });
        angleDepth++;
        line = (match[1] ?? "") + (match[4] ?? "");
        continue;
      } else if ((match = line.match(/^(\s*)(IFE|IFN|IF1|IF2)\s*,?\s*<(.*)/))) {
        finalizeAndPush(`${match[1]}.if 1`, currentArgs);
        blockStack.push({ type: "if", args: [], startDepth: angleDepth });
        angleDepth++;
        line = (match[1] ?? "") + (match[3] ?? "");
        continue;
      } else if ((match = line.match(/^(\s*)REPEAT\s+(.*?),?\s*<(.*)/))) {
        const count = performReplacements(match[2] ?? "", currentArgs);
        finalizeAndPush(`${match[1]}.repeat ${count}`, currentArgs);
        blockStack.push({ type: "repeat", args: [], startDepth: angleDepth });
        angleDepth++;
        line = (match[1] ?? "") + (match[3] ?? "");
        continue;
      }
      // 3. Instruction/Data scan
      let outLine = "";
      let i = 0;
      while (i < line.length) {
        const c = line[i];
        if (c === "<") {
          outLine += "(";
          angleDepth++;
          i++;
          continue;
        }
        if (c === ">") {
          angleDepth--;
          const last = blockStack[blockStack.length - 1];
          if (last && angleDepth === last.startDepth) {
            blockStack.pop();
            if (outLine.trim()) finalizeAndPush(outLine, currentArgs);
            const indent = outLine.match(/^\s*/)?.[0] || "";
            outLine = indent;
            const ender =
              last.type === "macro"
                ? ".endmacro"
                : last.type === "if"
                  ? ".endif"
                  : ".endrepeat";
            finalizeAndPush(indent + ender, currentArgs);
          } else {
            outLine += ")";
          }
          i++;
          continue;
        }
        outLine += c;
        i++;
      }
      if (outLine.trim() || outLine.includes(";")) {
        if (/^\s*(SALL|RADIX)/.test(outLine))
          outLines.push(";" + outLine.trimEnd());
        else finalizeAndPush(outLine, currentArgs);
      }
      processing = false;
    }
  }
  return outLines.join("\n");
}
// CLI Execution (ES Module compatible)
// @ts-ignore
const isMainModule =
  typeof process !== "undefined" &&
  process.argv &&
  process.argv[1] &&
  // @ts-ignore
  (import.meta.url === new URL(`file://${process.argv[1]}`).href ||
    // @ts-ignore
    parse(process.argv[1]).name ===
      parse(new URL(import.meta.url).pathname).name);
if (isMainModule) {
  // @ts-ignore
  const args = process.argv.slice(2);
  if (args.length < 2) {
    // @ts-ignore
    const myPath = process.argv[1] || "convert.js";
    console.error(`Usage: node ${myPath} <input.asm> <output.asm>`);
    // @ts-ignore
    process.exit(1);
  }
  const inputFile = args[0];
  const outputFile = args[1];
  if (!inputFile || !outputFile) {
    console.error("Invalid arguments.");
    // @ts-ignore
    process.exit(1);
  }
  try {
    const content = fs.readFileSync(inputFile, "utf-8");
    const converted = convertMacro10ToK65(content);
    fs.writeFileSync(outputFile, converted + "\n", "utf-8");
    console.log(`Successfully converted '${inputFile}' to '${outputFile}'`);
  } catch (err) {
    console.error("Error processing files:", err);
    // @ts-ignore
    process.exit(1);
  }
}
//# sourceMappingURL=convert.js.map
