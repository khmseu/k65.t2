/**
 * 6502 Assembly Language Lexer for Nearley
 * Uses Moo (https://github.com/no-context/moo) for tokenization
 * Companion to ma6.ne grammar
 */

import moo from "moo";

// NOTE: Comments (`;` to end of line) and leading/inner whitespace are handled
// by the wrapper (ma6-parser-wrapper.ts): comments are stripped before lexing
// and WS tokens are filtered out before the token stream reaches the grammar.
// That keeps this lexer free of comment ambiguities (e.g. `*` is always the
// location counter / multiply operator here, never a comment marker).
export const lexer = moo.compile({
  // Directives (must come before generic identifiers)
  // Note: Moo requires non-capturing groups (?:...) instead of /i flag
  OrgDirective: /\.(?i:org)/,
  EquDirective: /\.(?i:equ)/,
  SetDirective: /\.(?i:set)/,
  IncludeDirective: /\.(?i:include)/,
  AlignDirective: /\.(?i:align)/,
  MacroDirective: /\.(?i:macro)/,
  EndMacroDirective: /\.(?i:endmacro)/,
  RepeatDirective: /\.(?i:repeat)/,
  EndRepeatDirective: /\.(?i:endrepeat)/,
  IfDirective: /\.(?i:if)/,
  ElseIfDirective: /\.(?i:elseif)/,
  ElseDirective: /\.(?i:else)/,
  EndIfDirective: /\.(?i:endif)/,
  ByteDirective: /\.(?i:byte)/,
  WordDirective: /\.(?i:word)/,
  // TextcDirective must precede TextDirective so `.textc` is not lexed as
  // `.text` followed by a stray `c`.
  TextcDirective: /\.(?i:textc)/,
  TextDirective: /\.(?i:text)/,
  FillDirective: /\.(?i:fill)/,
  ListDirective: /\.(?i:list)/,
  NoListDirective: /\.(?i:nolist)/,
  PageDirective: /\.(?i:page)/,
  EjectDirective: /\.(?i:eject)/,
  TitleDirective: /\.(?i:title)/,
  SubttlDirective: /\.(?i:subttl)/,
  PageSizeDirective: /\.(?i:pagesize)/,
  BytesPerLineDirective: /\.(?i:bytesperline)/,
  PrintDirective: /\.(?i:print)/,

  // Comparison operators (must come before single-char operators)
  EQ: /==/,
  NE: /!=|<>/,
  LE: /<=/,
  GE: />=/,

  // Single-character tokens
  LT: /</,
  GT: />/,
  ASSIGN: /=/,
  PLUS: /\+/,
  MINUS: /-/,
  STAR: /\*/,
  DIV: /\//,
  AND_OP: /&/,
  OR_OP: /\|/,
  XOR_OP: /\^/,
  BITNOT: /~/,
  LNOT: /!/,
  LPAREN: /\(/,
  RPAREN: /\)/,
  COMMA: /,/,
  COLON: /:/,
  ESCAPE: /\\/,
  HASH: /#/,

  // Registers (word boundary required so mnemonics like AND/TAX are not split).
  // Note: Moo doesn't support /i flag. Match both cases explicitly.
  REG_A: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /[Aa]\b/,
  },
  REG_X: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /[Xx]\b/,
  },
  REG_Y: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /[Yy]\b/,
  },

  // String and character literals
  STRING: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /"(?:[^"\\]|\\.)*"/,
    value: (s: string) => s.slice(1, -1).replace(/\\(.)/g, "$1"),
  },
  CHAR: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /'(?:[^'\\]|\\.)*'/,
    value: (s: string) => s.slice(1, -1).replace(/\\(.)/g, "$1"),
  },

  // Numeric literals (in order of precedence). BINNUM must precede MOD so a
  // `%` followed by binary digits is read as a binary literal, not modulo.
  HEXNUM: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /(?:0x|\$)[0-9a-fA-F]+/,
    value: (s: string) => parseInt(s.replace(/^0x/, "").replace(/^\$/, ""), 16),
  },
  OCTNUM: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /0o[0-7]+/,
    value: (s: string) => parseInt(s.slice(2), 8),
  },
  BINNUM: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /(?:0b|%)[01]+/,
    value: (s: string) => parseInt(s.replace(/^0b/, "").replace(/^%/, ""), 2),
  },
  MOD: /%/,
  DECNUM: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /[0-9]+/,
    value: (s: string) => parseInt(s, 10),
  },

  // Identifiers (including @ prefix for local labels)
  IDENT: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /@?[a-zA-Z_$][a-zA-Z0-9_$]*/,
  },

  // Whitespace (filtered out by the wrapper before parsing)
  WS: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /\s+/,
    lineBreaks: true,
  },
});

// Export lexer for use with Nearley
export default lexer;
