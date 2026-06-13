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

export const Comment = createToken({
  name: "Comment",
  pattern: (text, startOffset) => {
    // Fail immediately if we are past the very first character of the string
    if (startOffset !== 0) {
      return null;
    }

    // Perform standard regex or string check (e.g., looking for the word "START")
    const match = /;.*/.exec(text.substring(startOffset));
    return match;
  },
  start_chars_hint: [";"],
  line_breaks: false,
});

export const K_linecomment = createToken({
  name: "K_linecomment",
  pattern: (text, startOffset) => {
    // Fail immediately if we are past the very first character of the string
    if (startOffset !== 0) {
      return null;
    }

    // Perform standard regex or string check (e.g., looking for the word "START")
    const match = /[\*\?].*/.exec(text.substring(startOffset));
    return match;
  },
  start_chars_hint: ["*", "?"],
  line_breaks: false,
});

export const TitleDirective = createToken({
  name: "TitleDirective",
  pattern: /\.title/i,
  longer_alt: undefined,
});

export const IncludeDirective = createToken({
  name: "IncludeDirective",
  pattern: /\.include/i,
  longer_alt: undefined,
});

export const OrgDirective = createToken({
  name: "OrgDirective",
  pattern: /\.org/i,
  longer_alt: undefined,
});

export const Colon = createToken({
  name: "Colon",
  pattern: /:/,
});

export const QuotedString = createToken({
  name: "QuotedString",
  pattern: /"[^"]*"/,
});

export const Identifier = createToken({
  name: "Identifier",
  pattern: /@?[a-zA-Z_][a-zA-Z0-9_]*/,
});

export const HexNumber = createToken({
  name: "HexNumber",
  pattern: /\$[0-9a-fA-F]+/,
});

export const DecNumber = createToken({
  name: "DecNumber",
  pattern: /[0-9]+/,
});

export const UnquotedWord = createToken({
  name: "UnquotedWord",
  pattern: /[^\s";#]+/,
});

export const Whitespace = createToken({
  name: "Whitespace",
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

// ============================================================================
// PARSER
// ============================================================================

export class Ma6Parser extends CstParser {
  constructor() {
    super(
      [
        Comment,
        K_linecomment,
        TitleDirective,
        IncludeDirective,
        OrgDirective,
        Colon,
        QuotedString,
        Identifier,
        HexNumber,
        DecNumber,
        UnquotedWord,
        Whitespace,
      ],
      {
        recoveryEnabled: true,
        // nodeLocationTracking: "full",
      },
    );
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
    this.CONSUME(Identifier);
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
      { ALT: () => this.SUBRULE(this.qstring) },
      { ALT: () => this.SUBRULE(this.words) },
    ]);
  });

  public qstring = this.RULE("qstring", () => {
    this.CONSUME(QuotedString);
  });

  public words = this.RULE("words", () => {
    this.AT_LEAST_ONE(() => {
      this.CONSUME(UnquotedWord);
    });
  });

  public expr = this.RULE("expr", () => {
    this.OR([
      { ALT: () => this.CONSUME(HexNumber) },
      { ALT: () => this.CONSUME(DecNumber) },
      { ALT: () => this.CONSUME(Identifier) },
    ]);
  });
}

// ============================================================================
// LEXER
// ============================================================================

export const ma6Lexer = new Lexer([
  Comment,
  K_linecomment,
  TitleDirective,
  IncludeDirective,
  OrgDirective,
  Colon,
  QuotedString,
  Identifier,
  HexNumber,
  DecNumber,
  UnquotedWord,
  Whitespace,
]);

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
