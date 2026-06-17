# 6502 Assembly Language Parser (Nearley Grammar)
#
# Scope: parse ONE physical source line into a structured AST. This is the
# "basic syntax recognition" layer only. Control-flow semantics
# (.if/.macro/.repeat block handling, macro expansion, multi-pass relaxation)
# are the assembler's job and live in src/line-processor.ts -- NOT here.
#
# Tokens are defined by the Moo lexer in src/ma6-lexer-moo.ts. The @lexer
# directive below binds them so %TOKEN references compile to {type:"TOKEN"}
# matchers (matched against token.type). The wrapper (ma6-parser-wrapper.ts)
# strips comments and filters out whitespace before feeding the line, so no
# rule here references %WS, and token references use the % prefix.

@{%
import lexer from "../ma6-lexer-moo.js";
%}
@lexer lexer

# ============================================================================
# LINE STRUCTURE
# ============================================================================
#
# A line is an optional label followed by an optional statement. The wrapper
# never feeds a fully-empty line, but "label only", "statement only" and
# "label statement" (e.g. "FOO: LDA #1") are all valid.

line ->
    label
      {% d => ({ label: d[0], stmt: null }) %}
  | statement
      {% d => ({ label: null, stmt: d[0] }) %}
  | label statement
      {% d => ({ label: d[0], stmt: d[1] }) %}

label ->
    %IDENT %COLON
      {% d => d[0].value %}

statement ->
    directive    {% id %}
  | assignment   {% id %}
  | instruction  {% id %}

# ============================================================================
# ASSIGNMENT:  NAME = EXPR   or   NAME .set EXPR
# ============================================================================

assignment ->
    %IDENT %ASSIGN expr
      {% d => ({ kind: "assign", name: d[0].value, value: d[2] }) %}
  | %IDENT %SetDirective expr
      {% d => ({ kind: "assign", name: d[0].value, value: d[2] }) %}

# ============================================================================
# INSTRUCTION:  MNEMONIC [operand]
# ============================================================================
#
# The operand carries its addressing-mode shape so the assembler does not have
# to re-derive it with regexes.

instruction ->
    %IDENT
      {% d => ({ kind: "instruction", mnemonic: d[0].value, arg: null }) %}
  | %IDENT operand
      {% d => ({ kind: "instruction", mnemonic: d[0].value, arg: d[1] }) %}

operand ->
    %REG_A
      {% () => ({ mode: "accumulator", expr: null }) %}
  | %HASH expr
      {% d => ({ mode: "immediate", expr: d[1] }) %}
  | %LPAREN expr %COMMA %REG_X %RPAREN
      {% d => ({ mode: "indirectX", expr: d[1] }) %}
  | %LPAREN expr %RPAREN %COMMA %REG_Y
      {% d => ({ mode: "indirectY", expr: d[1] }) %}
  | %LPAREN expr %RPAREN
      {% d => ({ mode: "indirect", expr: d[1] }) %}
  | expr %COMMA %REG_X
      {% d => ({ mode: "indexedX", expr: d[0] }) %}
  | expr %COMMA %REG_Y
      {% d => ({ mode: "indexedY", expr: d[0] }) %}
  | expr
      {% d => ({ mode: "absolute", expr: d[0] }) %}

# ============================================================================
# DIRECTIVES
# ============================================================================

directive ->
    %OrgDirective expr
      {% d => ({ kind: "directive", name: "org", expr: d[1] }) %}
  | %EquDirective expr
      {% d => ({ kind: "directive", name: "equ", expr: d[1] }) %}
  | %IfDirective expr
      {% d => ({ kind: "directive", name: "if", expr: d[1] }) %}
  | %ElseIfDirective expr
      {% d => ({ kind: "directive", name: "elseif", expr: d[1] }) %}
  | %RepeatDirective expr
      {% d => ({ kind: "directive", name: "repeat", expr: d[1] }) %}
  | %IncludeDirective %STRING
      {% d => ({ kind: "directive", name: "include", file: d[1].value }) %}
  | %AlignDirective expr alignFill
      {% d => ({ kind: "directive", name: "align", expr: d[1], fill: d[2] }) %}
  | %MacroDirective %IDENT macroParams
      {% d => ({ kind: "directive", name: "macro", macroName: d[1].value, params: d[2] }) %}
  | %EndMacroDirective
      {% () => ({ kind: "directive", name: "endmacro" }) %}
  | %EndRepeatDirective
      {% () => ({ kind: "directive", name: "endrepeat" }) %}
  | %ElseDirective
      {% () => ({ kind: "directive", name: "else" }) %}
  | %EndIfDirective
      {% () => ({ kind: "directive", name: "endif" }) %}
  | %ByteDirective dataList
      {% d => ({ kind: "directive", name: "byte", args: d[1] }) %}
  | %WordDirective dataList
      {% d => ({ kind: "directive", name: "word", args: d[1] }) %}
  | %TextDirective textList
      {% d => ({ kind: "directive", name: "text", items: d[1] }) %}
  | %TextcDirective textList
      {% d => ({ kind: "directive", name: "textc", items: d[1] }) %}
  | %FillDirective expr alignFill
      {% d => ({ kind: "directive", name: "fill", expr: d[1], fill: d[2] }) %}
  | %ListDirective
      {% () => ({ kind: "directive", name: "list" }) %}
  | %NoListDirective
      {% () => ({ kind: "directive", name: "nolist" }) %}
  | %PageDirective
      {% () => ({ kind: "directive", name: "page" }) %}
  | %EjectDirective
      {% () => ({ kind: "directive", name: "eject" }) %}
  | %TitleDirective freeText
      {% d => ({ kind: "directive", name: "title", text: d[1] }) %}
  | %SubttlDirective freeText
      {% d => ({ kind: "directive", name: "subttl", text: d[1] }) %}
  | %PageSizeDirective expr
      {% d => ({ kind: "directive", name: "pagesize", expr: d[1] }) %}
  | %BytesPerLineDirective expr
      {% d => ({ kind: "directive", name: "bytesperline", expr: d[1] }) %}
  | %PrintDirective freeText
      {% d => ({ kind: "directive", name: "print", text: d[1] }) %}

# Free-form text tail for .title / .subttl / .print. The lexer captures the rest
# of the line (after the directive keyword) as a single WORDS token; an empty
# tail is allowed.
freeText ->
    null
      {% () => "" %}
  | %WORDS
      {% d => String(d[0].value).trim() %}

# Optional ", EXPR" tail shared by .align / .fill
alignFill ->
    null
      {% () => null %}
  | %COMMA expr
      {% d => d[1] %}

macroParams ->
    null
      {% () => [] %}
  | %COMMA identList
      {% d => d[1] %}

identList ->
    %IDENT
      {% d => [d[0].value] %}
  | identList %COMMA %IDENT
      {% d => [...d[0], d[2].value] %}

dataList ->
    expr
      {% d => [d[0]] %}
  | dataList %COMMA expr
      {% d => [...d[0], d[2]] %}

textList ->
    textItem
      {% d => [d[0]] %}
  | textList %COMMA textItem
      {% d => [...d[0], d[2]] %}

textItem ->
    %STRING
      {% d => ({ t: "str", v: d[0].value }) %}
  | expr
      {% d => ({ t: "expr", v: d[0] }) %}

# ============================================================================
# EXPRESSIONS (lowest to highest precedence, left-associative)
# ============================================================================
#
# AST node shapes produced here:
#   { t: "num", v: <number> }            -- numeric literal (already decoded)
#   { t: "sym", name: <string> }         -- identifier reference
#   { t: "pc" }                          -- "*" current location counter
#   { t: "bin", op: <string>, l, r }     -- binary operator
#   { t: "un", op: <string>, e }         -- unary operator

expr -> orExpr {% id %}

# "|" is bitwise OR.
orExpr ->
    xorExpr
      {% id %}
  | orExpr %OR_OP xorExpr
      {% d => ({ t: "bin", op: "|", l: d[0], r: d[2] }) %}

xorExpr ->
    andExpr
      {% id %}
  | xorExpr %XOR_OP andExpr
      {% d => ({ t: "bin", op: "^", l: d[0], r: d[2] }) %}

andExpr ->
    eqExpr
      {% id %}
  | andExpr %AND_OP eqExpr
      {% d => ({ t: "bin", op: "&", l: d[0], r: d[2] }) %}

eqExpr ->
    relExpr
      {% id %}
  | eqExpr %EQ relExpr
      {% d => ({ t: "bin", op: "==", l: d[0], r: d[2] }) %}
  | eqExpr %ASSIGN relExpr
      {% d => ({ t: "bin", op: "==", l: d[0], r: d[2] }) %}
  | eqExpr %NE relExpr
      {% d => ({ t: "bin", op: "!=", l: d[0], r: d[2] }) %}

relExpr ->
    addExpr
      {% id %}
  | relExpr %LT addExpr
      {% d => ({ t: "bin", op: "<", l: d[0], r: d[2] }) %}
  | relExpr %GT addExpr
      {% d => ({ t: "bin", op: ">", l: d[0], r: d[2] }) %}
  | relExpr %LE addExpr
      {% d => ({ t: "bin", op: "<=", l: d[0], r: d[2] }) %}
  | relExpr %GE addExpr
      {% d => ({ t: "bin", op: ">=", l: d[0], r: d[2] }) %}

addExpr ->
    mulExpr
      {% id %}
  | addExpr %PLUS mulExpr
      {% d => ({ t: "bin", op: "+", l: d[0], r: d[2] }) %}
  | addExpr %MINUS mulExpr
      {% d => ({ t: "bin", op: "-", l: d[0], r: d[2] }) %}

mulExpr ->
    unaryExpr
      {% id %}
  | mulExpr %STAR unaryExpr
      {% d => ({ t: "bin", op: "*", l: d[0], r: d[2] }) %}
  | mulExpr %DIV unaryExpr
      {% d => ({ t: "bin", op: "/", l: d[0], r: d[2] }) %}
  | mulExpr %MOD unaryExpr
      {% d => ({ t: "bin", op: "%", l: d[0], r: d[2] }) %}

unaryExpr ->
    primary
      {% id %}
  | %PLUS unaryExpr
      {% d => d[1] %}
  | %MINUS unaryExpr
      {% d => ({ t: "un", op: "-", e: d[1] }) %}
  | %BITNOT unaryExpr
      {% d => ({ t: "un", op: "~", e: d[1] }) %}
  | %LNOT unaryExpr
      {% d => ({ t: "un", op: "!", e: d[1] }) %}
  | %LT unaryExpr
      {% d => ({ t: "un", op: "<", e: d[1] }) %}
  | %GT unaryExpr
      {% d => ({ t: "un", op: ">", e: d[1] }) %}

primary ->
    %DECNUM
      {% d => ({ t: "num", v: d[0].value }) %}
  | %HEXNUM
      {% d => ({ t: "num", v: d[0].value }) %}
  | %OCTNUM
      {% d => ({ t: "num", v: d[0].value }) %}
  | %BINNUM
      {% d => ({ t: "num", v: d[0].value }) %}
  | %CHAR
      {% d => ({ t: "num", v: String(d[0].value).charCodeAt(0) }) %}
  | %STRING
      {% d => ({ t: "num", v: String(d[0].value).charCodeAt(0) }) %}
  | %IDENT
      {% d => ({ t: "sym", name: d[0].value }) %}
  | %ESCAPE %IDENT
      {% d => ({ t: "sym", name: d[1].value }) %}
  | %STAR
      {% () => ({ t: "pc" }) %}
  | %LPAREN expr %RPAREN
      {% d => d[1] %}
