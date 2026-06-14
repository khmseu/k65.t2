/**
 * 6502 Assembly Language Lexer for Nearley
 * Uses Moo (https://github.com/no-context/moo) for tokenization
 * Companion to ma6.ne grammar
 */

import moo from "moo";

export const lexer = moo.compile({
  // Comments must be skipped/handled specially
  linecomment: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /^[\*;].*/,
    lineBreaks: false,
  },
  comment: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /;.*/,
    lineBreaks: false,
  },

  // Directives (must come before generic identifiers)
  // Note: Moo requires non-capturing groups (?:...) instead of /i flag
  OrgDirective: /\.(?:org|ORG|Org)/,
  EquDirective: /\.(?:equ|EQU|Equ)/,
  SetDirective: /\.(?:set|SET|Set)/,
  IncludeDirective: /\.(?:include|INCLUDE|Include)/,
  AlignDirective: /\.(?:align|ALIGN|Align)/,
  MacroDirective: /\.(?:macro|MACRO|Macro)/,
  EndMacroDirective: /\.(?:endmacro|ENDMACRO|Endmacro)/,
  RepeatDirective: /\.(?:repeat|REPEAT|Repeat)/,
  EndRepeatDirective: /\.(?:endrepeat|ENDREPEAT|Endrepeat)/,
  IfDirective: /\.(?:if|IF|If)/,
  ElseIfDirective: /\.(?:elseif|ELSEIF|Elseif)/,
  ElseDirective: /\.(?:else|ELSE|Else)/,
  EndIfDirective: /\.(?:endif|ENDIF|Endif)/,
  ByteDirective: /\.(?:byte|BYTE|Byte)/,
  WordDirective: /\.(?:word|WORD|Word)/,
  TextDirective: /\.(?:text|TEXT|Text)/,
  FillDirective: /\.(?:fill|FILL|Fill)/,
  ListDirective: /\.(?:list|LIST|List)/,
  NoListDirective: /\.(?:nolist|NOLIST|Nolist)/,
  PageDirective: /\.(?:page|PAGE|Page)/,
  EjectDirective: /\.(?:eject|EJECT|Eject)/,
  TitleDirective: /\.(?:title|TITLE|Title)/,
  SubttlDirective: /\.(?:subttl|SUBTTL|Subttl)/,
  PageSizeDirective: /\.(?:pagesize|PAGESIZE|Pagesize)/,
  BytesPerLineDirective: /\.(?:bytesperline|BYTESPERLINE|Bytesperline)/,
  PrintDirective: /\.(?:print|PRINT|Print)/,

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
  // Note: Moo doesn't support /i flag. Match both cases explicitly.
  REG_A: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /[Aa]\b/,
    fast: true,
  },
  REG_X: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /[Xx]\b/,
    fast: true,
  },
  REG_Y: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /[Yy]\b/,
    fast: true,
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

  // Numeric literals (in order of precedence)
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
  DECNUM: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /[0-9]+/,
    value: (s: string) => parseInt(s, 10),
  },

  // Identifiers (including @ prefix for local labels)
  IDENT: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /@?[a-zA-Z_][a-zA-Z0-9_]*/,
  },

  // Quoted strings (unescaped)
  Qstring: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /"[^"]*"/,
    value: (s: string) => s.slice(1, -1),
  },

  // Catch-all for unquoted words
  Words: /(?![\s"].*)\S+/,

  // Whitespace (skipped)
  WS: {
    // @ts-ignore: Moo type definitions conflict with RegExp
    match: /\s+/,
    lineBreaks: true,
  },

  // Error token (should not match)
  Unimplemented: /##################################/,
});

// Export lexer for use with Nearley
export default lexer;
