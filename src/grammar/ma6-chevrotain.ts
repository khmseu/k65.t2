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

export const K_Comment = createToken({
  name: "K_Comment",
  pattern: (text, startOffset) =>
    startOffset === 0 ? null : /;.*/.exec(text.substring(startOffset)),
  start_chars_hint: [";"],
  line_breaks: false,
});

export const K_linecomment = createToken({
  name: "K_linecomment",
  pattern: (text, startOffset) =>
    startOffset !== 0 ? null : /[\*;].*/.exec(text.substring(startOffset)),
  start_chars_hint: ["*", ";"],
  line_breaks: false,
});

export const K_TitleDirective = createToken({
  name: "K_TitleDirective",
  pattern: /\.title/i,
  longer_alt: undefined,
});

export const K_IncludeDirective = createToken({
  name: "K_IncludeDirective",
  pattern: /\.include/i,
  longer_alt: undefined,
});

export const K_OrgDirective = createToken({
  name: "K_OrgDirective",
  pattern: /\.org/i,
  longer_alt: undefined,
});

export const K_Colon = createToken({
  name: "K_Colon",
  pattern: ":",
});

export const K_Qstring = createToken({
  name: "K_Qstring",
  pattern: /"[^"]*"/,
});

export const K_Identifier = createToken({
  name: "K_Identifier",
  pattern: /@?[a-zA-Z_][a-zA-Z0-9_]*/,
});

export const K_Words = createToken({
  name: "K_Words",
  pattern: /(?![\s"]).*\S/,
  start_chars_hint: [
    0x21,
    ...Array.from({ length: 0x7e - 0x23 + 1 }, (_, i) => i + 0x23),
  ],
});

export const K_OR_OP = createToken({ name: "K_OR_OP", pattern: "|" });
export const K_XOR_OP = createToken({ name: "K_XOR_OP", pattern: "^" });
export const K_AND_OP = createToken({ name: "K_AND_OP", pattern: "&" });
export const K_EQ = createToken({ name: "K_EQ", pattern: "==" });
export const K_ASSIGN = createToken({ name: "K_ASSIGN", pattern: "=" });
export const K_NE = createToken({ name: "K_NE", pattern: "!=" });
export const K_LT = createToken({ name: "K_LT", pattern: "<" });
export const K_GT = createToken({ name: "K_GT", pattern: ">" });
export const K_LE = createToken({ name: "K_LE", pattern: "<=" });
export const K_GE = createToken({ name: "K_GE", pattern: ">=" });
export const K_PLUS = createToken({ name: "K_PLUS", pattern: "+" });
export const K_MINUS = createToken({ name: "K_MINUS", pattern: "-" });
export const K_STAR = createToken({
  name: "STAR",
  pattern: (text, startOffset) =>
    startOffset === 0 ? null : /\*/.exec(text.substring(startOffset)),
  start_chars_hint: ["*"],
  line_breaks: false,
});
export const K_DIV = createToken({ name: "K_DIV", pattern: "/" });
export const K_MOD = createToken({ name: "K_MOD", pattern: "%" });
export const K_BITNOT = createToken({ name: "K_BITNOT", pattern: "~" });
export const K_LNOT = createToken({ name: "K_LNOT", pattern: "!" });
export const K_LPAREN = createToken({ name: "K_LPAREN", pattern: "(" });
export const K_RPAREN = createToken({ name: "K_RPAREN", pattern: ")" });

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

export const K_STRING = createToken({
  name: "K_STRING",
  pattern: (text, startOffset) => {
    const result: RERWP = /"([^"\\]|\\.)*"/.exec(text.substring(startOffset));
    if (result && result[1]) result.payload = unescapeBasic(result[1]);
    return result;
  },
  start_chars_hint: ['"'],
  line_breaks: false,
});
export const K_IDENT = createToken({
  name: "K_IDENT",
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
export const K_DECNUM = createToken({
  name: "K_DECNUM",
  pattern: (text, startOffset) => {
    const result: RERWP = /[0-9]+/.exec(text.substring(startOffset));
    if (result) result.payload = parseInt(result[0], 10);
    return result;
  },
  start_chars_hint: [],
  line_breaks: false,
});
export const K_HEXNUM = createToken({
  name: "K_HEXNUM",
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
export const K_OCTNUM = createToken({
  name: "K_OCTNUM",
  pattern: (text, startOffset) => {
    const result: RERWP = /0o([0-7]+)/.exec(text.substring(startOffset));
    if (result && result[1]) result.payload = parseInt(result[1], 8);
    return result;
  },
  start_chars_hint: [],
  line_breaks: false,
});
export const K_BINNUM = createToken({
  name: "K_BINNUM",
  pattern: (text, startOffset) => {
    const result: RERWP = /%([01]+)/.exec(text.substring(startOffset));
    if (result && result[1]) result.payload = parseInt(result[1], 2);
    return result;
  },
  start_chars_hint: [],
  line_breaks: false,
});

export const K_Unimplemented = createToken({
  name: "K_Unimplemented",
  pattern: /##################################/,
});

export const K_WS = createToken({
  name: "K_WS",
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

// ============================================================================
// PARSER
// ============================================================================

const allTokens = [
  K_Comment,
  K_linecomment,
  K_TitleDirective,
  K_IncludeDirective,
  K_OrgDirective,
  K_Colon,
  K_Qstring,
  K_Identifier,
  K_Words,
  K_OR_OP,
  K_XOR_OP,
  K_AND_OP,
  K_EQ,
  K_ASSIGN,
  K_NE,
  K_LT,
  K_GT,
  K_LE,
  K_GE,
  K_PLUS,
  K_MINUS,
  K_STAR,
  K_DIV,
  K_MOD,
  K_BITNOT,
  K_LNOT,
  K_LPAREN,
  K_RPAREN,
  K_STRING,
  K_IDENT,
  K_DECNUM,
  K_HEXNUM,
  K_OCTNUM,
  K_BINNUM,
  K_Unimplemented,
  K_WS,
];

export class Ma6Parser extends CstParser {
  constructor() {
    super(allTokens, {
      recoveryEnabled: true,
      // nodeLocationTracking: "full",
    });
    this.performSelfAnalysis();
  }

  public k_line = this.RULE("k_line", () => {
    this.OR([
      { ALT: () => this.CONSUME(K_linecomment) },
      { ALT: () => this.SUBRULE(this.k_instruction) },
    ]);
  });

  public k_instruction = this.RULE("k_instruction", () => {
    this.OPTION(() => {
      this.SUBRULE(this.k_codeline);
    });
    this.OPTION1(() => {
      this.CONSUME(K_Comment);
    });
  });

  public k_codeline = this.RULE("k_codeline", () => {
    this.OPTION(() => {
      this.SUBRULE(this.k_label);
    });
    this.OPTION1(() => {
      this.SUBRULE(this.k_content);
    });
  });

  public k_label = this.RULE("k_label", () => {
    this.CONSUME(K_Identifier);
    this.OPTION(() => {
      this.CONSUME(K_Colon);
    });
  });

  public k_content = this.RULE("k_content", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.k_opcode) },
      { ALT: () => this.SUBRULE(this.k_directive) },
    ]);
  });

  public k_opcode = this.RULE("k_opcode", () => {
    this.CONSUME(K_Unimplemented);
  });

  public k_directive = this.RULE("k_directive", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.k_title) },
      { ALT: () => this.SUBRULE(this.k_include) },
      { ALT: () => this.SUBRULE(this.k_org) },
    ]);
  });

  public k_title = this.RULE("k_title", () => {
    this.CONSUME(K_TitleDirective);
    this.SUBRULE(this.k_nqstring);
  });

  public k_include = this.RULE("k_include", () => {
    this.CONSUME(K_IncludeDirective);
    this.SUBRULE(this.k_nqstring);
  });

  public k_org = this.RULE("k_org", () => {
    this.CONSUME(K_OrgDirective);
    this.SUBRULE(this.k_expr);
  });

  public k_nqstring = this.RULE("k_nqstring", () => {
    this.OR([
      { ALT: () => this.CONSUME(K_Qstring) },
      { ALT: () => this.CONSUME(K_Words) },
    ]);
  });

  public k_expr = this.RULE("k_expr", () => {
    this.SUBRULE(this.k_or_expr);
  });

  public k_or_expr = this.RULE("k_or_expr", () => {
    this.SUBRULE(this.k_xor_expr);
    this.MANY(() => {
      this.CONSUME(K_OR_OP);
      this.SUBRULE2(this.k_xor_expr);
    });
  });

  public k_xor_expr = this.RULE("k_xor_expr", () => {
    this.SUBRULE(this.k_and_expr);
    this.MANY(() => {
      this.CONSUME(K_XOR_OP);
      this.SUBRULE2(this.k_and_expr);
    });
  });

  public k_and_expr = this.RULE("k_and_expr", () => {
    this.SUBRULE(this.k_equality_expr);
    this.MANY(() => {
      this.CONSUME(K_AND_OP);
      this.SUBRULE2(this.k_equality_expr);
    });
  });

  public k_equality_expr = this.RULE("k_equality_expr", () => {
    this.SUBRULE(this.k_relational_expr);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(K_EQ) },
        { ALT: () => this.CONSUME(K_ASSIGN) },
        { ALT: () => this.CONSUME(K_NE) },
      ]);
      this.SUBRULE2(this.k_relational_expr);
    });
  });

  public k_relational_expr = this.RULE("k_relational_expr", () => {
    this.SUBRULE(this.k_additive_expr);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(K_LT) },
        { ALT: () => this.CONSUME(K_GT) },
        { ALT: () => this.CONSUME(K_LE) },
        { ALT: () => this.CONSUME(K_GE) },
      ]);
      this.SUBRULE2(this.k_additive_expr);
    });
  });

  public k_additive_expr = this.RULE("k_additive_expr", () => {
    this.SUBRULE(this.k_multiplicative_expr);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(K_PLUS) },
        { ALT: () => this.CONSUME(K_MINUS) },
      ]);
      this.SUBRULE2(this.k_multiplicative_expr);
    });
  });

  public k_multiplicative_expr = this.RULE("k_multiplicative_expr", () => {
    this.SUBRULE(this.k_unary_expr);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(K_STAR) },
        { ALT: () => this.CONSUME(K_DIV) },
        { ALT: () => this.CONSUME(K_MOD) },
      ]);
      this.SUBRULE2(this.k_unary_expr);
    });
  });

  public k_unary_expr = this.RULE("k_unary_expr", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.k_primary_expr) },
      {
        ALT: () => {
          this.OR1([
            { ALT: () => this.CONSUME(K_PLUS) },
            { ALT: () => this.CONSUME(K_MINUS) },
            { ALT: () => this.CONSUME(K_BITNOT) },
            { ALT: () => this.CONSUME(K_LNOT) },
            { ALT: () => this.CONSUME(K_LT) },
            { ALT: () => this.CONSUME(K_GT) },
          ]);
          this.SUBRULE(this.k_unary_expr);
        },
      },
    ]);
  });
  public k_primary_expr = this.RULE("k_primary_expr", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.k_number) },
      { ALT: () => this.CONSUME(K_STRING) },
      { ALT: () => this.CONSUME(K_IDENT) },
      { ALT: () => this.CONSUME(K_STAR) },
      {
        ALT: () => {
          this.CONSUME(K_LPAREN);
          this.SUBRULE(this.k_expr);
          this.CONSUME(K_RPAREN);
        },
      },
    ]);
  });

  public k_number = this.RULE("k_number", () => {
    this.OR([
      { ALT: () => this.CONSUME(K_HEXNUM) },
      { ALT: () => this.CONSUME(K_DECNUM) },
      { ALT: () => this.CONSUME(K_OCTNUM) },
      { ALT: () => this.CONSUME(K_BINNUM) },
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

  const ast = parserInstance.k_line();
  const errs = [...lexResult.errors, ...parserInstance.errors];

  return {
    ast,
    errs,
  };
}
