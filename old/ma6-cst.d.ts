import type { CstNode, ICstVisitor, IToken } from "chevrotain";

export interface LineCstNode extends CstNode {
  name: "line";
  children: LineCstChildren;
}

export type LineCstChildren = {
  linecomment?: IToken[];
  instruction?: InstructionCstNode[];
};

export interface InstructionCstNode extends CstNode {
  name: "instruction";
  children: InstructionCstChildren;
}

export type InstructionCstChildren = {
  codeline?: CodelineCstNode[];
  Comment?: IToken[];
};

export interface CodelineCstNode extends CstNode {
  name: "codeline";
  children: CodelineCstChildren;
}

export type CodelineCstChildren = {
  label?: LabelCstNode[];
  content?: ContentCstNode[];
};

export interface LabelCstNode extends CstNode {
  name: "label";
  children: LabelCstChildren;
}

export type LabelCstChildren = {
  Identifier: IToken[];
  Colon?: IToken[];
};

export interface ContentCstNode extends CstNode {
  name: "content";
  children: ContentCstChildren;
}

export type ContentCstChildren = {
  opcode?: OpcodeCstNode[];
  directive?: DirectiveCstNode[];
};

export interface OpcodeCstNode extends CstNode {
  name: "opcode";
  children: OpcodeCstChildren;
}

export type OpcodeCstChildren = {
  Unimplemented: IToken[];
};

export interface DirectiveCstNode extends CstNode {
  name: "directive";
  children: DirectiveCstChildren;
}

export type DirectiveCstChildren = {
  title?: TitleCstNode[];
  include?: IncludeCstNode[];
  org?: OrgCstNode[];
  subttl?: SubttlCstNode[];
};

export interface TitleCstNode extends CstNode {
  name: "title";
  children: TitleCstChildren;
}

export type TitleCstChildren = {
  TitleDirective: IToken[];
  nqstring: NqstringCstNode[];
};

export interface IncludeCstNode extends CstNode {
  name: "include";
  children: IncludeCstChildren;
}

export type IncludeCstChildren = {
  IncludeDirective: IToken[];
  nqstring: NqstringCstNode[];
};

export interface OrgCstNode extends CstNode {
  name: "org";
  children: OrgCstChildren;
}

export type OrgCstChildren = {
  OrgDirective: IToken[];
  expr: ExprCstNode[];
};

export interface SubttlCstNode extends CstNode {
  name: "subttl";
  children: SubttlCstChildren;
}

export type SubttlCstChildren = {
  SubttlDirective: IToken[];
  nqstring: NqstringCstNode[];
};

export interface NqstringCstNode extends CstNode {
  name: "nqstring";
  children: NqstringCstChildren;
}

export type NqstringCstChildren = {
  Qstring?: IToken[];
  Words?: IToken[];
};

export interface ExprCstNode extends CstNode {
  name: "expr";
  children: ExprCstChildren;
}

export type ExprCstChildren = {
  or_expr: Or_exprCstNode[];
};

export interface Or_exprCstNode extends CstNode {
  name: "or_expr";
  children: Or_exprCstChildren;
}

export type Or_exprCstChildren = {
  xor_expr: Xor_exprCstNode[];
  OR_OP?: IToken[];
};

export interface Xor_exprCstNode extends CstNode {
  name: "xor_expr";
  children: Xor_exprCstChildren;
}

export type Xor_exprCstChildren = {
  and_expr: And_exprCstNode[];
  XOR_OP?: IToken[];
};

export interface And_exprCstNode extends CstNode {
  name: "and_expr";
  children: And_exprCstChildren;
}

export type And_exprCstChildren = {
  equality_expr: Equality_exprCstNode[];
  AND_OP?: IToken[];
};

export interface Equality_exprCstNode extends CstNode {
  name: "equality_expr";
  children: Equality_exprCstChildren;
}

export type Equality_exprCstChildren = {
  relational_expr: Relational_exprCstNode[];
  EQ?: IToken[];
  ASSIGN?: IToken[];
  NE?: IToken[];
};

export interface Relational_exprCstNode extends CstNode {
  name: "relational_expr";
  children: Relational_exprCstChildren;
}

export type Relational_exprCstChildren = {
  additive_expr: Additive_exprCstNode[];
  LT?: IToken[];
  GT?: IToken[];
  LE?: IToken[];
  GE?: IToken[];
};

export interface Additive_exprCstNode extends CstNode {
  name: "additive_expr";
  children: Additive_exprCstChildren;
}

export type Additive_exprCstChildren = {
  multiplicative_expr: Multiplicative_exprCstNode[];
  PLUS?: IToken[];
  MINUS?: IToken[];
};

export interface Multiplicative_exprCstNode extends CstNode {
  name: "multiplicative_expr";
  children: Multiplicative_exprCstChildren;
}

export type Multiplicative_exprCstChildren = {
  unary_expr: Unary_exprCstNode[];
  STAR?: IToken[];
  DIV?: IToken[];
  MOD?: IToken[];
};

export interface Unary_exprCstNode extends CstNode {
  name: "unary_expr";
  children: Unary_exprCstChildren;
}

export type Unary_exprCstChildren = {
  primary_expr?: Primary_exprCstNode[];
  PLUS?: IToken[];
  MINUS?: IToken[];
  BITNOT?: IToken[];
  LNOT?: IToken[];
  LT?: IToken[];
  GT?: IToken[];
  unary_expr?: Unary_exprCstNode[];
};

export interface Primary_exprCstNode extends CstNode {
  name: "primary_expr";
  children: Primary_exprCstChildren;
}

export type Primary_exprCstChildren = {
  number?: NumberCstNode[];
  STRING?: IToken[];
  IDENT?: IToken[];
  STAR?: IToken[];
  LPAREN?: IToken[];
  expr?: ExprCstNode[];
  RPAREN?: IToken[];
};

export interface NumberCstNode extends CstNode {
  name: "number";
  children: NumberCstChildren;
}

export type NumberCstChildren = {
  HEXNUM?: IToken[];
  DECNUM?: IToken[];
  OCTNUM?: IToken[];
  BINNUM?: IToken[];
};

export interface ICstNodeVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  line(children: LineCstChildren, param?: IN): OUT;
  instruction(children: InstructionCstChildren, param?: IN): OUT;
  codeline(children: CodelineCstChildren, param?: IN): OUT;
  label(children: LabelCstChildren, param?: IN): OUT;
  content(children: ContentCstChildren, param?: IN): OUT;
  opcode(children: OpcodeCstChildren, param?: IN): OUT;
  directive(children: DirectiveCstChildren, param?: IN): OUT;
  title(children: TitleCstChildren, param?: IN): OUT;
  include(children: IncludeCstChildren, param?: IN): OUT;
  org(children: OrgCstChildren, param?: IN): OUT;
  subttl(children: SubttlCstChildren, param?: IN): OUT;
  nqstring(children: NqstringCstChildren, param?: IN): OUT;
  expr(children: ExprCstChildren, param?: IN): OUT;
  or_expr(children: Or_exprCstChildren, param?: IN): OUT;
  xor_expr(children: Xor_exprCstChildren, param?: IN): OUT;
  and_expr(children: And_exprCstChildren, param?: IN): OUT;
  equality_expr(children: Equality_exprCstChildren, param?: IN): OUT;
  relational_expr(children: Relational_exprCstChildren, param?: IN): OUT;
  additive_expr(children: Additive_exprCstChildren, param?: IN): OUT;
  multiplicative_expr(
    children: Multiplicative_exprCstChildren,
    param?: IN,
  ): OUT;
  unary_expr(children: Unary_exprCstChildren, param?: IN): OUT;
  primary_expr(children: Primary_exprCstChildren, param?: IN): OUT;
  number(children: NumberCstChildren, param?: IN): OUT;
}
