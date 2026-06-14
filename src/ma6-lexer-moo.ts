/**
 * 6502 Assembly Language Lexer for Nearley
 * Uses Moo (https://github.com/no-context/moo) for tokenization
 * Companion to ma6.ne grammar
 */

import moo from "moo";

export const lexer = moo.compile({
  // Comments must be skipped/handled specially
  linecomment: {
    match: /^[\*;].*/,
    lineBreaks: false,
  },
  comment: {
    match: /;.*/,
    lineBreaks: false,
  },

  // Directives (must come before generic identifiers)
  OrgDirective: /\.org/i,
  EquDirective: /\.equ/i,
  SetDirective: /\.set/i,
  IncludeDirective: /\.include/i,
  AlignDirective: /\.align/i,
  MacroDirective: /\.macro/i,
  EndMacroDirective: /\.endmacro/i,
  RepeatDirective: /\.repeat/i,
  EndRepeatDirective: /\.endrepeat/i,
  IfDirective: /\.if/i,
  ElseIfDirective: /\.elseif/i,
  ElseDirective: /\.else/i,
  EndIfDirective: /\.endif/i,
  ByteDirective: /\.byte/i,
  WordDirective: /\.word/i,
  TextDirective: /\.text/i,
  FillDirective: /\.fill/i,
  ListDirective: /\.list/i,
  NoListDirective: /\.nolist/i,
  PageDirective: /\.page/i,
  EjectDirective: /\.eject/i,
  TitleDirective: /\.title/i,
  SubttlDirective: /\.subttl/i,
  PageSizeDirective: /\.pagesize/i,
  BytesPerLineDirective: /\.bytesperline/i,
  PrintDirective: /\.print/i,

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
  MOD: /%/,
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

  // Registers (word boundary required)
  REG_A: { match: /A\b/i, fast: true },
  REG_X: { match: /X\b/i, fast: true },
  REG_Y: { match: /Y\b/i, fast: true },

  // String and character literals
  STRING: {
    match: /"(?:[^"\\]|\\.)*"/,
    value: (s) => s.slice(1, -1).replace(/\\(.)/g, "$1"),
  },
  CHAR: {
    match: /'(?:[^'\\]|\\.)*'/,
    value: (s) => s.slice(1, -1).replace(/\\(.)/g, "$1"),
  },

  // Numeric literals (in order of precedence)
  HEXNUM: {
    match: /(?:0x|\$)[0-9a-fA-F]+/,
    value: (s) => parseInt(s.replace(/^0x/, "").replace(/^\$/, ""), 16),
  },
  OCTNUM: {
    match: /0o[0-7]+/,
    value: (s) => parseInt(s.slice(2), 8),
  },
  BINNUM: {
    match: /(?:0b|%)[01]+/,
    value: (s) => parseInt(s.replace(/^0b/, "").replace(/^%/, ""), 2),
  },
  DECNUM: {
    match: /[0-9]+/,
    value: (s) => parseInt(s, 10),
  },

  // Identifiers (including @ prefix for local labels)
  IDENT: {
    match: /@?[a-zA-Z_][a-zA-Z0-9_]*/,
  },

  // Quoted strings (unescaped)
  Qstring: {
    match: /"[^"]*"/,
    value: (s) => s.slice(1, -1),
  },

  // Catch-all for unquoted words
  Words: /(?![\s"].*)\S+/,

  // Whitespace (skipped)
  WS: {
    match: /\s+/,
    lineBreaks: true,
  },

  // Error token (should not match)
  Unimplemented: /##################################/,
});

// Export lexer for use with Nearley
export default lexer;
