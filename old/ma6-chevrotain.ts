import type {
  CstNode,
  ILexingError,
  IRecognitionException,
  IToken,
} from "chevrotain";
import { createSyntaxDiagramsCode, generateCstDts } from "chevrotain";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ma6Parser } from "./Ma6Parser.js";
import type {
  Additive_exprCstChildren,
  And_exprCstChildren,
  CodelineCstChildren,
  ContentCstChildren,
  DirectiveCstChildren,
  Equality_exprCstChildren,
  ExprCstChildren,
  ICstNodeVisitor,
  IncludeCstChildren,
  InstructionCstChildren,
  LabelCstChildren,
  LineCstChildren,
  Multiplicative_exprCstChildren,
  NqstringCstChildren,
  NumberCstChildren,
  OpcodeCstChildren,
  Or_exprCstChildren,
  OrgCstChildren,
  Primary_exprCstChildren,
  Relational_exprCstChildren,
  SubttlCstChildren,
  TitleCstChildren,
  Unary_exprCstChildren,
  Xor_exprCstChildren,
} from "./ma6-cst.js";
import { ma6Lexer } from "./ma6Lexer.js";

// ============================================================================
// PARSER FACTORY & PARSE FUNCTION
// ============================================================================

const parserInstance = new Ma6Parser();

export function createDtsFromParser() {
  const dts = generateCstDts(parserInstance.getGAstProductions());
  const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
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
  ast: CstNode;
  errs: (ILexingError | IRecognitionException)[];
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

type SimpleToken = {
  image: string;
  tokenType: string;
  payload?: string | any;
};
const BaseCstVisitor = parserInstance.getBaseCstVisitorConstructor<
  SimpleToken[],
  void
>();

class ShortVisitor
  extends BaseCstVisitor
  implements ICstNodeVisitor<SimpleToken[], void>
{
  maybeVisit<T extends CstNode>(
    children: T[] | undefined,
    param: SimpleToken[],
  ) {
    if (children && children.length > 0) {
      this.visit(children, param);
    }
  }
  found(tokens: IToken[] | undefined, param: SimpleToken[]) {
    if (tokens) {
      for (const t of tokens) {
        const ot: SimpleToken = {
          image: t.image,
          payload: t.payload,
          tokenType: t.tokenType.name,
        };
        param.push(ot);
      }
    }
  }
  line(children: LineCstChildren, param: SimpleToken[]) {
    this.found(children.linecomment, param);
    this.maybeVisit(children.instruction, param);
  }
  instruction(children: InstructionCstChildren, param: SimpleToken[]) {
    this.maybeVisit(children.codeline, param);
    this.found(children.Comment, param);
  }
  codeline(children: CodelineCstChildren, param: SimpleToken[]) {
    this.maybeVisit(children.label, param);
    this.maybeVisit(children.content, param);
  }
  label(children: LabelCstChildren, param: SimpleToken[]) {
    this.found(children.Identifier, param);
    this.found(children.Colon, param);
  }
  content(children: ContentCstChildren, param: SimpleToken[]) {
    this.maybeVisit(children.opcode, param);
    this.maybeVisit(children.directive, param);
  }
  opcode(children: OpcodeCstChildren, param: SimpleToken[]) {
    this.found(children.Unimplemented, param);
  }
  directive(children: DirectiveCstChildren, param: SimpleToken[]) {
    this.maybeVisit(children.title, param);
    this.maybeVisit(children.include, param);
    this.maybeVisit(children.org, param);
    this.maybeVisit(children.subttl, param);
  }
  title(children: TitleCstChildren, param: SimpleToken[]) {
    this.found(children.TitleDirective, param);
    this.maybeVisit(children.nqstring, param);
  }
  include(children: IncludeCstChildren, param: SimpleToken[]) {
    this.found(children.IncludeDirective, param);
    this.maybeVisit(children.nqstring, param);
  }
  org(children: OrgCstChildren, param: SimpleToken[]) {
    this.found(children.OrgDirective, param);
    this.maybeVisit(children.expr, param);
  }
  subttl(children: SubttlCstChildren, param: SimpleToken[]) {
    this.found(children.SubttlDirective, param);
    this.maybeVisit(children.nqstring, param);
  }
  nqstring(children: NqstringCstChildren, param: SimpleToken[]) {
    this.found(children.Qstring, param);
    this.found(children.Words, param);
  }
  expr(children: ExprCstChildren, param: SimpleToken[]) {
    this.maybeVisit(children.or_expr, param);
  }
  or_expr(children: Or_exprCstChildren, param: SimpleToken[]) {
    this.maybeVisit(children.xor_expr, param);
    this.found(children.OR_OP, param);
  }
  xor_expr(children: Xor_exprCstChildren, param: SimpleToken[]) {
    this.maybeVisit(children.and_expr, param);
    this.found(children.XOR_OP, param);
  }
  and_expr(children: And_exprCstChildren, param: SimpleToken[]) {
    this.maybeVisit(children.equality_expr, param);
    this.found(children.AND_OP, param);
  }
  equality_expr(children: Equality_exprCstChildren, param: SimpleToken[]) {
    this.maybeVisit(children.relational_expr, param);
    this.found(children.EQ, param);
    this.found(children.ASSIGN, param);
    this.found(children.NE, param);
  }
  relational_expr(children: Relational_exprCstChildren, param: SimpleToken[]) {
    this.maybeVisit(children.additive_expr, param);
    this.found(children.LT, param);
    this.found(children.GT, param);
    this.found(children.LE, param);
    this.found(children.GE, param);
  }
  additive_expr(children: Additive_exprCstChildren, param: SimpleToken[]) {
    this.maybeVisit(children.multiplicative_expr, param);
    this.found(children.PLUS, param);
    this.found(children.MINUS, param);
  }
  multiplicative_expr(
    children: Multiplicative_exprCstChildren,
    param: SimpleToken[],
  ) {
    this.maybeVisit(children.unary_expr, param);
    this.found(children.STAR, param);
    this.found(children.DIV, param);
    this.found(children.MOD, param);
  }
  unary_expr(children: Unary_exprCstChildren, param: SimpleToken[]) {
    this.maybeVisit(children.primary_expr, param);
    this.found(children.PLUS, param);
    this.found(children.MINUS, param);
    this.found(children.BITNOT, param);
    this.found(children.LNOT, param);
    this.found(children.LT, param);
    this.found(children.GT, param);
    this.maybeVisit(children.unary_expr, param);
  }
  primary_expr(children: Primary_exprCstChildren, param: SimpleToken[]) {
    this.maybeVisit(children.number, param);
    this.found(children.STRING, param);
    this.found(children.IDENT, param);
    this.found(children.STAR, param);
    this.found(children.LPAREN, param);
    this.maybeVisit(children.expr, param);
    this.found(children.RPAREN, param);
  }
  number(children: NumberCstChildren, param: SimpleToken[]) {
    this.found(children.HEXNUM, param);
    this.found(children.DECNUM, param);
    this.found(children.OCTNUM, param);
    this.found(children.BINNUM, param);
  }
}

const short_visitor = new ShortVisitor();

export function in_short(cst: CstNode) {
  const tokens: SimpleToken[] = [];
  short_visitor.visit(cst, tokens);

  return tokens;
}
