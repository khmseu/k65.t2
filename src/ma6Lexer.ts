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

export const OrgDirective = createToken({
  name: "OrgDirective",
  pattern: /\.org/i,
});
export const EquDirective = createToken({
  name: "EquDirective",
  pattern: /\.equ/i,
});
export const SetDirective = createToken({
  name: "SetDirective",
  pattern: /\.set/i,
});
export const IncludeDirective = createToken({
  name: "IncludeDirective",
  pattern: /\.include/i,
});
export const AlignDirective = createToken({
  name: "AlignDirective",
  pattern: /\.align/i,
});
export const MacroDirective = createToken({
  name: "MacroDirective",
  pattern: /\.macro/i,
});
export const EndMacroDirective = createToken({
  name: "EndMacroDirective",
  pattern: /\.endmacro/i,
});
export const RepeatDirective = createToken({
  name: "RepeatDirective",
  pattern: /\.repeat/i,
});
export const EndRepeatDirective = createToken({
  name: "EndRepeatDirective",
  pattern: /\.endrepeat/i,
});
export const IfDirective = createToken({
  name: "IfDirective",
  pattern: /\.if/i,
});
export const ElseIfDirective = createToken({
  name: "ElseIfDirective",
  pattern: /\.elseif/i,
});
export const ElseDirective = createToken({
  name: "ElseDirective",
  pattern: /\.else/i,
});
export const EndIfDirective = createToken({
  name: "EndIfDirective",
  pattern: /\.endif/i,
});
export const ByteDirective = createToken({
  name: "ByteDirective",
  pattern: /\.byte/i,
});
export const WordDirective = createToken({
  name: "WordDirective",
  pattern: /\.word/i,
});
export const TextDirective = createToken({
  name: "TextDirective",
  pattern: /\.text/i,
});
export const FillDirective = createToken({
  name: "FillDirective",
  pattern: /\.fill/i,
});
export const ListDirective = createToken({
  name: "ListDirective",
  pattern: /\.list/i,
});
export const NoListDirective = createToken({
  name: "NoListDirective",
  pattern: /\.nolist/i,
});
export const PageDirective = createToken({
  name: "PageDirective",
  pattern: /\.page/i,
});
export const EjectDirective = createToken({
  name: "EjectDirective",
  pattern: /\.eject/i,
});
export const TitleDirective = createToken({
  name: "TitleDirective",
  pattern: /\.title/i,
});
export const SubttlDirective = createToken({
  name: "SubttlDirective",
  pattern: /\.subttl/i,
});
export const PageSizeDirective = createToken({
  name: "PageSizeDirective",
  pattern: /\.pagesize/i,
});
export const BytesPerLineDirective = createToken({
  name: "BytesPerLineDirective",
  pattern: /\.bytesperline/i,
});
export const PrintDirective = createToken({
  name: "PrintDirective",
  pattern: /\.print/i,
});

export const EQ = createToken({ name: "EQ", pattern: "==" });
export const NE = createToken({ name: "NE", pattern: /!=|<>/ });
export const LE = createToken({ name: "LE", pattern: "<=" });
export const GE = createToken({ name: "GE", pattern: ">=" });
export const LT = createToken({ name: "LT", pattern: "<" });
export const GT = createToken({ name: "GT", pattern: ">" });
export const ASSIGN = createToken({ name: "ASSIGN", pattern: "=" });
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
export const AND_OP = createToken({ name: "AND_OP", pattern: "&" });
export const OR_OP = createToken({ name: "OR_OP", pattern: "|" });
export const XOR_OP = createToken({ name: "XOR_OP", pattern: "^" });
export const BITNOT = createToken({ name: "BITNOT", pattern: "~" });
export const LNOT = createToken({ name: "LNOT", pattern: "!" });
export const LPAREN = createToken({ name: "LPAREN", pattern: "(" });
export const RPAREN = createToken({ name: "RPAREN", pattern: ")" });
export const COMMA = createToken({ name: "COMMA", pattern: "," });
export const COLON = createToken({ name: "COLON", pattern: ":" });
export const REG_A = createToken({ name: "REG_A", pattern: /A\b/i });
export const REG_X = createToken({ name: "REG_X", pattern: /X\b/i });
export const REG_Y = createToken({ name: "REG_Y", pattern: /Y\b/i });

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
export const CHAR = createToken({
  name: "CHAR",
  pattern: (text, startOffset) => {
    const result: RERWP = /'([^'\\]|\\.)*'/.exec(text.substring(startOffset));
    if (result && result[1]) result.payload = unescapeBasic(result[1]);
    return result;
  },
  start_chars_hint: ["'"],
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
  start_chars_hint: ["0", "$"],
  line_breaks: false,
});
export const OCTNUM = createToken({
  name: "OCTNUM",
  pattern: (text, startOffset) => {
    const result: RERWP = /0o([0-7]+)/.exec(text.substring(startOffset));
    if (result && result[1]) result.payload = parseInt(result[1], 8);
    return result;
  },
  start_chars_hint: ["0"],
  line_breaks: false,
});
export const BINNUM = createToken({
  name: "BINNUM",
  pattern: (text, startOffset) => {
    const result: RERWP = /(?:0b|%)([01]+)/.exec(text.substring(startOffset));
    if (result && result[1]) result.payload = parseInt(result[1], 2);
    return result;
  },
  start_chars_hint: ["%", "0"],
  line_breaks: false,
});
export const DECNUM = createToken({
  name: "DECNUM",
  pattern: (text, startOffset) => {
    const result: RERWP = /[0-9]+/.exec(text.substring(startOffset));
    if (result) result.payload = parseInt(result[0], 10);
    return result;
  },
  start_chars_hint: [...Array.from({ length: 10 }, (_, i) => i + 0x30)],
  line_breaks: false,
});
export const IDENT = createToken({
  name: "IDENT",
  pattern: /@?[a-zA-Z_][a-zA-Z0-9_]*/,
});

// ---------------------------------------------------------------------------

export const Qstring = createToken({
  name: "Qstring",
  pattern: (text, startOffset) => {
    const result: RERWP = /"([^"]*)"/.exec(text.substring(startOffset));
    if (result && result[1]) result.payload = result[1];
    return result;
  },
  start_chars_hint: ['"'],
  line_breaks: false,
});

export const Words = createToken({
  name: "Words",
  pattern: /(?![\s"]).*\S/,
  start_chars_hint: [
    0x21,
    ...Array.from({ length: 0x7e - 0x23 + 1 }, (_, i) => i + 0x23),
  ],
});

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

  OrgDirective,
  EquDirective,
  SetDirective,
  IncludeDirective,
  AlignDirective,
  MacroDirective,
  EndMacroDirective,
  RepeatDirective,
  EndRepeatDirective,
  IfDirective,
  ElseIfDirective,
  ElseDirective,
  EndIfDirective,
  ByteDirective,
  WordDirective,
  TextDirective,
  FillDirective,
  ListDirective,
  NoListDirective,
  PageDirective,
  EjectDirective,
  TitleDirective,
  SubttlDirective,
  PageSizeDirective,
  BytesPerLineDirective,
  PrintDirective,

  EQ,
  NE,
  LE,
  GE,
  LT,
  GT,
  ASSIGN,
  PLUS,
  MINUS,
  STAR,
  DIV,
  MOD,
  AND_OP,
  OR_OP,
  XOR_OP,
  BITNOT,
  LNOT,
  LPAREN,
  RPAREN,
  COMMA,
  COLON,

  REG_A,
  REG_X,
  REG_Y,

  STRING,
  CHAR,
  HEXNUM,
  OCTNUM,
  BINNUM,
  DECNUM,
  IDENT,

  Qstring,
  Unimplemented,
  WS,
  // last
  Words,
];

// ============================================================================
// LEXER
// ============================================================================

export const ma6Lexer = new Lexer(allTokens, { ensureOptimizations: true });
