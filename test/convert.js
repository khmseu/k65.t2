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
  // TITLE / SUBTTL / PRINTX / COMMENT carry free-form text, not symbols, so the
  // 6-character symbol truncation must not touch their operand (it was cutting
  // words like "COMMAND" -> "COMMAN" and "PRECISION" -> "PRECIS").
  if (/^\s*(?:TITLE|SUBTTL|SUBTITLE|PRINTX|COMMENT)\b/i.test(line)) {
    return line;
  }
  let result = "";
  let inString = false;
  let stringChar = "";
  let current = "";
  // Keywords whose operand is free-form text (a title, subtitle or message),
  // not symbols. When one is seen we must stop normalizing the remainder of its
  // text so words like COMMODORE / PRECISION are not truncated to 6 chars. The
  // text runs to end of line, or to the `>` that closes an enclosing
  // IFx <...> conditional (e.g. `IFE REALIO-3,<PRINTX COMMODORE>`).
  const isFreeTextKeyword = (w) =>
    /^(?:TITLE|SUBTTL|SUBTITLE|PRINTX|COMMENT)$/i.test(w);
  // A token that directly follows a `^` and looks like O/D/B + digits is a
  // MACRO-10 radix literal (`^O176547`, `^D10`, `^B1010`), NOT a symbol, so it
  // must never be truncated to 6 chars (that was dropping the final octal digit
  // of 6-digit values like ^O176547 -> O17654).
  const isRadixLiteral = (tok) =>
    result.endsWith("^") && /^[ODB][0-9]+$/i.test(tok);
  // Emit the accumulated token, normalizing it only when it is a real symbol.
  const flush = () => {
    if (
      current &&
      /^[A-Za-z_%@]/.test(current[0]) &&
      !isRadixLiteral(current)
    ) {
      result += normalizeSymbol(current);
    } else {
      result += current;
    }
  };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      result += ch;
      if (ch === stringChar && line[i - 1] !== "\\") inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "/") {
      // Flush any accumulated symbol before entering a string
      flush();
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
      // A free-text keyword: emit it, then copy its text verbatim up to the
      // enclosing `>` (or end of line) without symbol normalization.
      if (current && isFreeTextKeyword(current)) {
        result += current;
        current = "";
        const gt = line.indexOf(">", i);
        if (gt === -1) {
          result += line.slice(i);
          return result;
        }
        result += line.slice(i, gt);
        i = gt - 1;
        continue;
      }
      // Only normalize if it looks like a symbol (not empty, and valid)
      flush();
      result += ch;
      current = "";
    }
  }
  // Final symbol
  flush();
  return result;
}
/**
 * The 6502 instruction mnemonics. Used to tell a real instruction apart from a
 * bare value (an equate reference or constant expression) that MACRO-10 would
 * emit as data.
 */
const MNEMONICS_6502 = new Set([
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
  "INC",
  "DEC",
  "INX",
  "DEX",
  "INY",
  "DEY",
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
]);
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
  // Pass 1: Uppercase and normalize. This must be aware of MACRO-10 COMMENT
  // blocks (`COMMENT <delim> ... <delim>`): their body is free text, not code,
  // and crucially the closing delimiter line must survive intact. Symbol
  // normalization rewrites a lone `%` to `@`, which would corrupt a `%`
  // delimiter so the block never closes and the rest of the file gets swallowed
  // as a comment. So pass COMMENT lines (opener, body, and closer) through
  // verbatim and only normalize real code lines.
  const uppercasedLines = [];
  let p1InComment = false;
  let p1Delim = "";
  for (const line of lines) {
    if (p1InComment) {
      uppercasedLines.push(line);
      if (line.includes(p1Delim)) p1InComment = false;
      continue;
    }
    if (line.trim().startsWith(";") || line.trim().startsWith("*")) {
      uppercasedLines.push(line);
      continue;
    }
    const commentOpen = line.match(/^(\s*)COMMENT?\b\s*(\S)(.*)$/i);
    if (commentOpen) {
      const delim = commentOpen[2];
      const rest = commentOpen[3] ?? "";
      uppercasedLines.push(line);
      if (!rest.includes(delim)) {
        p1InComment = true;
        p1Delim = delim;
      }
      continue;
    }
    uppercasedLines.push(normalizeSymbolsInLine(uppercaseNonComment(line)));
  }
  // Pass 2: No alias generation - symbols are truncated to 6 chars
  lines = uppercasedLines;
  const outLines = [];
  // Collect every macro name defined via DEFINE so a bare macro call (no args)
  // is not mistaken for a bare data value and rewritten to .byte.
  const definedMacros = new Set();
  for (const l of lines) {
    const m = l.match(/^\s*DEFINE\s+([A-Za-z0-9_\$]+)/);
    if (m) definedMacros.add(normalizeSymbol(m[1]).toUpperCase());
  }
  const blockStack = [];
  let angleDepth = 0;
  let inBlockComment = false;
  let blockCommentDelim = "";
  // Current MACRO-10 radix for UNPREFIXED numbers. MACRO-10 interprets a bare
  // number (no `^O`/`^D`/`^B` prefix) in the radix set by the most recent RADIX
  // directive; the RADIX argument itself is always decimal. The source sets
  // `RADIX 10` up front and switches to `RADIX 8` only inside the math package,
  // so we default to 10 (a no-op for bare numbers) and emit `0o` prefixes for
  // bare numbers only while radix 8 is in effect.
  let currentRadix = 10;
  /**
   * Rename a macro parameter whose name collides with a 6502 register (A, X, Y).
   * The assembler treats A/X/Y as reserved register names, so a macro parameter
   * cannot be declared with one of those names. The rename is a pure function so
   * both the .macro declaration and the body \PARAM references derive the same
   * emitted name; all other (non-reserved) parameter names pass through
   * unchanged.
   */
  function renameParam(name) {
    return /^[AXY]$/i.test(name) ? `${name}1` : name;
  }
  /**
   * Applies all regex-based replacements and macro argument expansions iteratively.
   */
  function performReplacements(text, macroArgs) {
    let current = text;
    // Apply macro argument replacements first (only once to avoid recursion).
    // The body still uses the original parameter name; substitution emits a
    // backslash reference to the (possibly renamed) parameter.
    for (const arg of macroArgs) {
      const ref = renameParam(arg);
      current = current.split(`<${arg}>`).join(`\\${ref}`);
      // Use negative lookbehind to avoid replacing inside already-replaced \...
      const argRegex = new RegExp(`(?<!\\\\)\\b${arg}\\b`, "g");
      current = current.replace(argRegex, `\\${ref}`);
    }
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 10) {
      let start = current;
      // Bare-number radix handling: while RADIX 8 is in effect, an UNPREFIXED
      // number is octal, so emit a `0o` prefix. Only numbers whose digits are
      // all valid octal (0-7) are converted: MACRO-10 falls back to decimal for
      // a bare number that contains a digit too large for the radix (e.g. `8`
      // or `9` under radix 8), so those are left unprefixed. This runs before
      // the `^O`/`^D`/`^B` conversions below so explicitly-prefixed numbers
      // (whose digits are preceded by the prefix letter) are left untouched,
      // and only the code portion (before any `;` comment) is rewritten so
      // comment text such as "24 BITS" is preserved.
      if (currentRadix === 8) {
        const semi = current.indexOf(";");
        const code = semi >= 0 ? current.slice(0, semi) : current;
        const rest = semi >= 0 ? current.slice(semi) : "";
        current =
          code.replace(/(?<![\w.$@^\\])[0-7]+\b/g, (d) => `0o${d}`) + rest;
      }
      current = current.replace(/\^O([0-7]+)/g, "0o$1");
      // MACRO-10 radix prefixes: ^D = decimal, ^B = binary
      current = current.replace(/\^D([0-9]+)/g, "$1");
      current = current.replace(/\^B([01]+)/g, "0b$1");
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
      current = current.replace(/\bLDADY\s+([^;\s]+)(.*)/, "LDA ($1),Y$2");
      current = current.replace(/\bSTADY\s+([^;\s]+)(.*)/, "STA ($1),Y$2");
      current = current.replace(/\bCMPDY\s+([^;\s]+)(.*)/, "CMP ($1),Y$2");
      current = current.replace(/\bSBCDY\s+([^;\s]+)(.*)/, "SBC ($1),Y$2");
      current = current.replace(/\bADCDY\s+([^;\s]+)(.*)/, "ADC ($1),Y$2");
      current = current.replace(/\bJMPD\s+([^;\s]+)(.*)/, "JMP ($1)$2");
      // TITLE / SUBTTL / PRINTX carry free-form text. The assembler's .title /
      // .subttl / .print take the rest of the line verbatim (no quoting), so
      // embedded quotes such as THE "LIST" COMMAND survive unescaped.
      current = current.replace(/^\s*TITLE\s+(.*)/, ".title $1");
      current = current.replace(/^\s*SUBTTL\s+(.*)/, ".subttl $1");
      current = current.replace(/^(\s*)PAGE/, "$1.page");
      current = current.replace(/^(\s*)ORG\s+(.*)/, "$1.org $2");
      // MACRO-10 listing, cross-reference and housekeeping directives (XLIST,
      // .XCREF, .CREF, PURGE, IFNDEF, END) have no k65.t2 equivalent, so emit
      // them as comments: the original intent is preserved but they are inert.
      // END is anchored so it never matches a label (e.g. `END:`) or an
      // identifier that merely starts with END (e.g. `ENDCHR`).
      current = current.replace(
        /^(\s*)(\.?XLIST|\.?XCREF|\.?CREF|PURGE\b|IFNDEF\b|END(?=\s|$))(.*)$/,
        "$1; $2$3",
      );
      current = current.replace(/\bBLOCK\s+(.*)/, ".fill $1");
      current = current.replace(/^(\s*)EXP\s+(.*)/, "$1.word $2");
      // SEARCH pulls in a MACRO-10 library; we ship a hand-written k65.t2
      // equivalent named "<name>.lib.asm" so it is clearly a support library
      // rather than another translated source file.
      current = current.replace(
        /^(\s*)SEARCH\s+(.*)/,
        '$1.include "$2.lib.asm"',
      );
      current = current.replace(/([\\@A-Za-z0-9_\$]+)\s*==\s*(.*)/, "$1 = $2");
      current = current.replace(
        /\bPRINTX\s*([^\sA-Za-z0-9])(.*)\\1/g,
        ".print $2",
      );
      current = current.replace(/^\s*PRINTX\s+([^\/"\s>][^>]*)/, ".print $1");
      // Directives with optional spaces.
      // String-literal form carries text:        DC"FOO"  -> .textc "FOO"
      // Parenthesized form carries an expression/
      // macro-parameter reference (e.g. DC(\A)):  DC(\A)   -> .textc \A
      current = current.replace(/\bDC\s*"(.*?)"/g, '.textc "$1"');
      current = current.replace(/\bDT\s*"(.*?)"/g, '.text "$1"');
      current = current.replace(/\bDC\s*\((.*)\)/g, ".textc $1");
      current = current.replace(/\bDT\s*\((.*)\)/g, ".text $1");
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
    // Strip a trailing comma left over from the PDP-10 accumulator separator
    // (e.g. `ASL A,` or `LDA RESLST,Y,`). No 6502 statement ends in a comma, so
    // a comma immediately before the end of line or a comment is junk.
    final = final.replace(/,(\s*)(;.*)?$/, "$1$2").trimEnd();
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
      outLines.push(final);
      return;
    }
    // 5. Standalone bare value (an equate reference or constant expression) ->
    //    .byte. MACRO-10 emits a lone expression as data. We only do this when
    //    the line is a single operator/identifier/number expression (no operand
    //    whitespace) whose leading word is neither a 6502 mnemonic, a directive
    //    (.xxx), nor a defined macro call.
    const bareMatch = final.match(/^(\s*)(\S.*?)(\s*(?:;.*)?)$/);
    if (bareMatch) {
      const indent = bareMatch[1] ?? "";
      const expr = bareMatch[2] ?? "";
      const comment = bareMatch[3] ?? "";
      const firstWord = (expr.match(/^[@A-Za-z_$][A-Za-z0-9_$]*/) ?? [
        "",
      ])[0].toUpperCase();
      const exprNoStrings = expr.replace(/"(?:[^"\\]|\\.)*"/g, "");
      const isExpression =
        /^[-+*/&|^<>()~%@A-Za-z0-9_$. \t"]+$/.test(expr) &&
        !/\s/.test(exprNoStrings);
      if (
        isExpression &&
        !expr.startsWith(".") &&
        !MNEMONICS_6502.has(firstWord) &&
        !definedMacros.has(firstWord)
      ) {
        outLines.push(`${indent}.byte ${expr}${comment}`);
        return;
      }
    }
    outLines.push(final);
  }
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    let line = lines[lineIdx];
    if (!line.trim()) {
      outLines.push("");
      continue;
    }
    if (!inBlockComment) {
      // MACRO-10 COMMENT directive: COMMENT <delim> ... <delim>
      // The delimiter is the first non-blank character after COMMENT and the
      // comment body runs (possibly across many lines) until that same
      // delimiter recurs. The delimiter is arbitrary (e.g. *, %, /).
      const commentStart = line.match(/^(\s*)COMMENT?\b\s*(\S)(.*)$/i);
      if (commentStart) {
        const indent = commentStart[1] ?? "";
        blockCommentDelim = commentStart[2];
        const rest = commentStart[3] ?? "";
        const endIdx = rest.indexOf(blockCommentDelim);
        if (endIdx !== -1) {
          // Comment opens and closes on the same line
          outLines.push((indent + "; " + rest.slice(0, endIdx)).trimEnd());
        } else {
          inBlockComment = true;
          outLines.push((indent + "; " + rest).trimEnd());
        }
        continue;
      }
    }
    if (inBlockComment) {
      const endIdx = line.indexOf(blockCommentDelim);
      if (endIdx !== -1) {
        outLines.push(("; " + line.slice(0, endIdx)).trimEnd());
        inBlockComment = false;
      } else {
        outLines.push(("; " + line).trimEnd());
      }
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
        const declaredArgs = args.map(renameParam);
        finalizeAndPush(
          `${match[1]}.macro ${match[2]}${declaredArgs.length > 0 ? ", " + declaredArgs.join(", ") : ""}`,
          currentArgs,
        );
        blockStack.push({ type: "macro", args, startDepth: angleDepth });
        angleDepth++;
        line = (match[1] ?? "") + (match[4] ?? "");
        continue;
      } else if (
        (match = line.match(/^(\s*)(IFE|IFN|IF1|IF2)\b\s*(.*)$/)) &&
        (match[3] ?? "").includes("<")
      ) {
        const indent = match[1] ?? "";
        const kind = match[2];
        const rest = match[3] ?? "";
        // Split condition from body, respecting nested <...> groups inside the
        // condition expression. The body is introduced by a top-level "<";
        // an optional top-level comma separates condition from body.
        let depth = 0;
        let commaIdx = -1;
        let firstLt = -1;
        let bodyOpenIdx = -1;
        for (let k = 0; k < rest.length; k++) {
          const ch = rest[k];
          if (ch === "<") {
            if (depth === 0) {
              if (firstLt < 0) firstLt = k;
              if (commaIdx >= 0) {
                bodyOpenIdx = k;
                break;
              }
            }
            depth++;
          } else if (ch === ">") {
            depth--;
          } else if (ch === "," && depth === 0 && commaIdx < 0) {
            commaIdx = k;
          }
        }
        if (bodyOpenIdx < 0) bodyOpenIdx = firstLt;
        const condRaw = commaIdx >= 0 ? rest.slice(0, commaIdx) : "";
        // Convert angle-bracket grouping in the condition to parentheses and
        // MACRO-10 inclusive-OR `!` to `|` (the only `!` in a condition is the
        // bitwise-OR operator; the `!=` we emit below is generated afterwards).
        const cond = performReplacements(
          condRaw
            .replace(/</g, "(")
            .replace(/>/g, ")")
            .replace(/!/g, "|")
            .trim(),
          currentArgs,
        );
        let outCond = "";
        if (kind === "IF1" || kind === "IF2" || !cond) {
          outCond = "1";
        } else {
          outCond = kind === "IFE" ? `(${cond}) == 0` : `(${cond}) != 0`;
          const minus = cond.match(/^([A-Za-z0-9_$]+)\s*-\s*([A-Za-z0-9_$]+)$/);
          if (minus && minus[1] && minus[2])
            outCond =
              kind === "IFE"
                ? `${minus[1]} == ${minus[2]}`
                : `${minus[1]} != ${minus[2]}`;
        }
        finalizeAndPush(`${indent}.if ${outCond}`, currentArgs);
        blockStack.push({ type: "if", args: [], startDepth: angleDepth });
        angleDepth++;
        // Remaining body content follows the body-opening "<".
        line = indent + rest.slice(bodyOpenIdx + 1);
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
        if (/^\s*(SALL|RADIX)/.test(outLine)) {
          // RADIX changes how subsequent unprefixed numbers are interpreted.
          // The argument is always decimal. We keep emitting the directive as a
          // comment (the assembler has no radix mode) but track the value so
          // performReplacements can prefix bare octal numbers.
          const radixMatch = outLine.match(/^\s*RADIX\s+([0-9]+)/);
          if (radixMatch) currentRadix = parseInt(radixMatch[1], 10);
          outLines.push(";" + outLine.trimEnd());
        } else finalizeAndPush(outLine, currentArgs);
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
