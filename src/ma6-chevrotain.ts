import {
  CstParser,
  Lexer,
  createSyntaxDiagramsCode,
  createToken,
  generateCstDts,
} from "chevrotain";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

// ============================================================================
// PARSER
// ============================================================================

const allTokens = [
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

export class Ma6Parser extends CstParser {
  constructor() {
    super(allTokens, {
      recoveryEnabled: true,
      // nodeLocationTracking: "full",
    });
    this.performSelfAnalysis();
  }

  public line = this.RULE("line", () => {
    this.OR([
      { ALT: () => this.CONSUME(linecomment) },
      { ALT: () => this.SUBRULE(this.instruction) },
    ]);
  });

  public instruction = this.RULE("instruction", () => {
    this.OPTION(() => {
      this.SUBRULE(this.codeline);
    });
    this.OPTION1(() => {
      this.CONSUME(Comment);
    });
  });

  public codeline = this.RULE("codeline", () => {
    this.OPTION(() => {
      this.SUBRULE(this.label);
    });
    this.OPTION1(() => {
      this.SUBRULE(this.content);
    });
  });

  public label = this.RULE("label", () => {
    this.CONSUME(Identifier);
    this.OPTION(() => {
      this.CONSUME(Colon);
    });
  });

  public content = this.RULE("content", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.opcode) },
      { ALT: () => this.SUBRULE(this.directive) },
    ]);
  });

  public opcode = this.RULE("opcode", () => {
    this.CONSUME(Unimplemented);
  });

  public directive = this.RULE("directive", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.title) },
      { ALT: () => this.SUBRULE(this.include) },
      { ALT: () => this.SUBRULE(this.org) },
    ]);
  });

  public title = this.RULE("title", () => {
    this.CONSUME(TitleDirective);
    this.SUBRULE(this.nqstring);
  });

  public include = this.RULE("include", () => {
    this.CONSUME(IncludeDirective);
    this.SUBRULE(this.nqstring);
  });

  public org = this.RULE("org", () => {
    this.CONSUME(OrgDirective);
    this.SUBRULE(this.expr);
  });

  public nqstring = this.RULE("nqstring", () => {
    this.OR([
      { ALT: () => this.CONSUME(Qstring) },
      { ALT: () => this.CONSUME(Words) },
    ]);
  });

  public expr = this.RULE("expr", () => {
    this.SUBRULE(this.or_expr);
  });

  public or_expr = this.RULE("or_expr", () => {
    this.SUBRULE(this.xor_expr);
    this.MANY(() => {
      this.CONSUME(OR_OP);
      this.SUBRULE2(this.xor_expr);
    });
  });

  public xor_expr = this.RULE("xor_expr", () => {
    this.SUBRULE(this.and_expr);
    this.MANY(() => {
      this.CONSUME(XOR_OP);
      this.SUBRULE2(this.and_expr);
    });
  });

  public and_expr = this.RULE("and_expr", () => {
    this.SUBRULE(this.equality_expr);
    this.MANY(() => {
      this.CONSUME(AND_OP);
      this.SUBRULE2(this.equality_expr);
    });
  });

  public equality_expr = this.RULE("equality_expr", () => {
    this.SUBRULE(this.relational_expr);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(EQ) },
        { ALT: () => this.CONSUME(ASSIGN) },
        { ALT: () => this.CONSUME(NE) },
      ]);
      this.SUBRULE2(this.relational_expr);
    });
  });

  public relational_expr = this.RULE("relational_expr", () => {
    this.SUBRULE(this.additive_expr);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(LT) },
        { ALT: () => this.CONSUME(GT) },
        { ALT: () => this.CONSUME(LE) },
        { ALT: () => this.CONSUME(GE) },
      ]);
      this.SUBRULE2(this.additive_expr);
    });
  });

  public additive_expr = this.RULE("additive_expr", () => {
    this.SUBRULE(this.multiplicative_expr);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(PLUS) },
        { ALT: () => this.CONSUME(MINUS) },
      ]);
      this.SUBRULE2(this.multiplicative_expr);
    });
  });

  public multiplicative_expr = this.RULE("multiplicative_expr", () => {
    this.SUBRULE(this.unary_expr);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(STAR) },
        { ALT: () => this.CONSUME(DIV) },
        { ALT: () => this.CONSUME(MOD) },
      ]);
      this.SUBRULE2(this.unary_expr);
    });
  });

  public unary_expr = this.RULE("unary_expr", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.primary_expr) },
      {
        ALT: () => {
          this.OR1([
            { ALT: () => this.CONSUME(PLUS) },
            { ALT: () => this.CONSUME(MINUS) },
            { ALT: () => this.CONSUME(BITNOT) },
            { ALT: () => this.CONSUME(LNOT) },
            { ALT: () => this.CONSUME(LT) },
            { ALT: () => this.CONSUME(GT) },
          ]);
          this.SUBRULE(this.unary_expr);
        },
      },
    ]);
  });
  public primary_expr = this.RULE("primary_expr", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.number) },
      { ALT: () => this.CONSUME(STRING) },
      { ALT: () => this.CONSUME(IDENT) },
      { ALT: () => this.CONSUME(STAR) },
      {
        ALT: () => {
          this.CONSUME(LPAREN);
          this.SUBRULE(this.expr);
          this.CONSUME(RPAREN);
        },
      },
    ]);
  });

  public number = this.RULE("number", () => {
    this.OR([
      { ALT: () => this.CONSUME(HEXNUM) },
      { ALT: () => this.CONSUME(DECNUM) },
      { ALT: () => this.CONSUME(OCTNUM) },
      { ALT: () => this.CONSUME(BINNUM) },
    ]);
  });
}

// ============================================================================
// LEXER
// ============================================================================

export const ma6Lexer = new Lexer(allTokens, { ensureOptimizations: true });

// ============================================================================
// PARSER FACTORY & PARSE FUNCTION
// ============================================================================

const parserInstance = new Ma6Parser();

export function createDtsFromParser() {
  const dts = generateCstDts(parserInstance.getGAstProductions());
  const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "./");
  writeFileSync(outPath + "/ma6-cst.d.ts", dts);
}

export function generateSyntaxDiagrams(path: string) {
  // extract the serialized grammar.
  const serializedGrammar = parserInstance.getSerializedGastProductions();

  // create the HTML Text
  const htmlText = createSyntaxDiagramsCode(serializedGrammar);

  // Write the HTML file to disk
  const outPath = resolve(dirname(path), "./");
  writeFileSync(outPath + "/generated_diagrams.html", htmlText);
}

export function parseAssemblyLine(input: string): {
  ast: any;
  errs: any[];
} {
  const lexResult = ma6Lexer.tokenize(input);
  parserInstance.input = lexResult.tokens;

  const ast = parserInstance.line();
  const errs = [...lexResult.errors, ...parserInstance.errors];

  return {
    ast,
    errs,
  };
}
