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
export declare function convertMacro10ToK65(content: string): string;
//# sourceMappingURL=convert.d.ts.map
