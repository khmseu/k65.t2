import { createToken, Lexer } from "chevrotain";

// ============================================================================
// TOKENS (Lexer)
// ============================================================================

interface RegExpExecArrayWithPayload extends RegExpExecArray {
  payload?: string | number;
}
type RERWP = RegExpExecArrayWithPayload | null;

export const Comment = createToken({
  name: "Comment",
  pattern: (text, startOffset) =>
    startOffset === 0 ? null : /;.*/.exec(text.substring(startOffset)),
  start_chars_hint: [";"],
  line_breaks: false,
});

export const linecomment = createToken({
  name: "linecomment",
  pattern: (text, startOffset) =>
    startOffset !== 0 ? null : /[\*;].*/.exec(text.substring(startOffset)),
  start_chars_hint: ["*", ";"],
  line_breaks: false,
});

export const TitleDirective = createToken({
  name: "TitleDirective",
  pattern: /\.title/i,
});

export const IncludeDirective = createToken({
  name: "IncludeDirective",
  pattern: /\.include/i,
});

export const OrgDirective = createToken({
  name: "OrgDirective",
  pattern: /\.org/i,
});

export const Colon = createToken({
  name: "Colon",
  pattern: ":",
});

export const Qstring = createToken({
  name: "Qstring",
  pattern: /"[^"]*"/,
});

export const Identifier = createToken({
  name: "Identifier",
  pattern: /@?[a-zA-Z_][a-zA-Z0-9_]*/,
});

export const Words = createToken({
  name: "Words",
  pattern: /(?![\s"]).*\S/,
  start_chars_hint: [
    0x21,
    ...Array.from({ length: 0x7e - 0x23 + 1 }, (_, i) => i + 0x23),
  ],
});

export const OR_OP = createToken({ name: "OR_OP", pattern: "|" });
export const XOR_OP = createToken({ name: "XOR_OP", pattern: "^" });
export const AND_OP = createToken({ name: "AND_OP", pattern: "&" });
export const EQ = createToken({ name: "EQ", pattern: "==" });
export const ASSIGN = createToken({ name: "ASSIGN", pattern: "=" });
export const NE = createToken({ name: "NE", pattern: "!=" });
export const LT = createToken({ name: "LT", pattern: "<" });
export const GT = createToken({ name: "GT", pattern: ">" });
export const LE = createToken({ name: "LE", pattern: "<=" });
export const GE = createToken({ name: "GE", pattern: ">=" });
export const PLUS = createToken({ name: "PLUS", pattern: "+" });
export const MINUS = createToken({ name: "MINUS", pattern: "-" });
export const STAR = createToken({
  name: "STAR",
  pattern: (text, startOffset) =>
    startOffset === 0 ? null : /\*/.exec(text.substring(startOffset)),
  start_chars_hint: ["*"],
  line_breaks: false,
});
export const DIV = createToken({ name: "DIV", pattern: "/" });
export const MOD = createToken({ name: "MOD", pattern: "%" });
export const BITNOT = createToken({ name: "BITNOT", pattern: "~" });
export const LNOT = createToken({ name: "LNOT", pattern: "!" });
export const LPAREN = createToken({ name: "LPAREN", pattern: "(" });
export const RPAREN = createToken({ name: "RPAREN", pattern: ")" });
function unescapeBasic(str: string): string {
  const map = {
    "0": "\0",
    a: "\a",
    b: "\b",
    t: "\t",
    n: "\n",
    v: "\v",
    f: "\f",
    r: "\r",
    "\\": "\\",
  };
  return str.replace(
    /\\([0abtnvfr\\])/g,
    (_, char: keyof typeof map) => map[char],
  );
}

export const STRING = createToken({
  name: "STRING",
  pattern: (text, startOffset) => {
    const result: RERWP = /"([^"\\]|\\.)*"/.exec(text.substring(startOffset));
    if (result && result[1]) result.payload = unescapeBasic(result[1]);
    return result;
  },
  start_chars_hint: ['"'],
  line_breaks: false,
});
export const IDENT = createToken({
  name: "IDENT",
  pattern: (text, startOffset) =>
    /@?[a-zA-Z_][a-zA-Z0-9_]*/.exec(text.substring(startOffset)),
  start_chars_hint: [
    0x40,
    ...Array.from({ length: 26 }, (_, i) => i + 0x41),
    0x5f,
    ...Array.from({ length: 26 }, (_, i) => i + 0x61),
  ],
  line_breaks: false,
});
export const DECNUM = createToken({
  name: "DECNUM",
  pattern: (text, startOffset) => {
    const result: RERWP = /[0-9]+/.exec(text.substring(startOffset));
    if (result) result.payload = parseInt(result[0], 10);
    return result;
  },
  start_chars_hint: [],
  line_breaks: false,
});
export const HEXNUM = createToken({
  name: "HEXNUM",
  pattern: (text, startOffset) => {
    const result: RERWP = /(?:0x|\$)([0-9a-fA-F]+)/.exec(
      text.substring(startOffset),
    );
    if (result && result[1]) result.payload = parseInt(result[1], 16);
    return result;
  },
  start_chars_hint: [],
  line_breaks: false,
});
export const OCTNUM = createToken({
  name: "OCTNUM",
  pattern: (text, startOffset) => {
    const result: RERWP = /0o([0-7]+)/.exec(text.substring(startOffset));
    if (result && result[1]) result.payload = parseInt(result[1], 8);
    return result;
  },
  start_chars_hint: [],
  line_breaks: false,
});
export const BINNUM = createToken({
  name: "BINNUM",
  pattern: (text, startOffset) => {
    const result: RERWP = /%([01]+)/.exec(text.substring(startOffset));
    if (result && result[1]) result.payload = parseInt(result[1], 2);
    return result;
  },
  start_chars_hint: [],
  line_breaks: false,
});

export const Unimplemented = createToken({
  name: "Unimplemented",
  pattern: /##################################/,
});

export const WS = createToken({
  name: "WS",
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

export const allTokens = [
  Comment,
  linecomment,
  TitleDirective,
  IncludeDirective,
  OrgDirective,
  Colon,
  Qstring,
  Identifier,
  Words,
  OR_OP,
  XOR_OP,
  AND_OP,
  EQ,
  ASSIGN,
  NE,
  LT,
  GT,
  LE,
  GE,
  PLUS,
  MINUS,
  STAR,
  DIV,
  MOD,
  BITNOT,
  LNOT,
  LPAREN,
  RPAREN,
  STRING,
  IDENT,
  DECNUM,
  HEXNUM,
  OCTNUM,
  BINNUM,
  Unimplemented,
  WS,
];

// ============================================================================
// LEXER
// ============================================================================

export const ma6Lexer = new Lexer(allTokens, { ensureOptimizations: true });
