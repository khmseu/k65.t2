import { CstParser } from "chevrotain";
import {
  allTokens,
  AND_OP,
  ASSIGN,
  BINNUM,
  BITNOT,
  Colon,
  Comment,
  DECNUM,
  DIV,
  EQ,
  GE,
  GT,
  HEXNUM,
  IDENT,
  Identifier,
  IncludeDirective,
  LE,
  linecomment,
  LNOT,
  LPAREN,
  LT,
  MINUS,
  MOD,
  NE,
  OCTNUM,
  OR_OP,
  OrgDirective,
  PLUS,
  Qstring,
  RPAREN,
  STAR,
  STRING,
  SubttlDirective,
  TitleDirective,
  Unimplemented,
  Words,
  XOR_OP,
} from "./ma6Lexer.js";

// ============================================================================
// PARSER
// ============================================================================

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
      { ALT: () => this.SUBRULE(this.subttl) },
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

  public subttl = this.RULE("subttl", () => {
    this.CONSUME(SubttlDirective);
    this.SUBRULE(this.nqstring);
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
