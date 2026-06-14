# 6502 Assembly Language Parser (Nearley Grammar)
# Translated from Chevrotain lexer/parser (ma6Lexer.ts, Ma6Parser.ts)
# Uses Moo tokens defined in ma6-lexer-moo.ts

# ============================================================================
# GRAMMAR RULES (Operator Precedence: Low to High)
# ============================================================================

# Entry point
line ->
    %linecomment {% id %}
  | code_line {% d => ({ type: 'line', content: d[0] }) %}

code_line ->
    %IDENT _ ":" _ content:? _ %Comment:?
      {% d => ({ type: 'code_line', label: d[0].value, content: d[4], comment: d[6] }) %}
  | content
      {% d => ({ type: 'code_line', content: d[0] }) %}

content ->
    directive
  | assignment
  | operation _ arg_list:* 
      {% d => ({ type: 'operation', op: d[0], args: d[2] }) %}

# ============================================================================
# DIRECTIVES
# ============================================================================

directive ->
    (%OrgDirective | %EquDirective | %SetDirective | %RepeatDirective | %IfDirective | %ElseIfDirective) _ expr
      {% d => ({ type: d[0][0].type.toLowerCase(), expr: d[2] }) %}
  | %IncludeDirective _ nqstring
      {% d => ({ type: 'include', file: d[2] }) %}
  | %AlignDirective _ expr (_ "," _ expr):?
      {% d => ({ type: 'align', align: d[2], fill: d[3] ? d[3][3] : null }) %}
  | %MacroDirective _ %IDENT (_ "," _ macro_args):?
      {% d => ({ type: 'macro', name: d[2].value, args: d[3] ? d[3][3] : [] }) %}
  | %EndMacroDirective
      {% d => ({ type: 'endmacro' }) %}
  | %EndRepeatDirective
      {% d => ({ type: 'endrepeat' }) %}
  | %ElseDirective
      {% d => ({ type: 'else' }) %}
  | %EndIfDirective
      {% d => ({ type: 'endif' }) %}
  | %ByteDirective _ arg_list
      {% d => ({ type: 'byte', args: d[2] }) %}
  | %WordDirective _ arg_list
      {% d => ({ type: 'word', args: d[2] }) %}
  | %TextDirective _ text_list
      {% d => ({ type: 'text', items: d[2] }) %}
  | %FillDirective _ expr (_ "," _ expr):?
      {% d => ({ type: 'fill', count: d[2], fill: d[3] ? d[3][3] : null }) %}
  | %ListDirective
      {% d => ({ type: 'list' }) %}
  | %NoListDirective
      {% d => ({ type: 'nolist' }) %}
  | %PageDirective
      {% d => ({ type: 'page' }) %}
  | %EjectDirective
      {% d => ({ type: 'eject' }) %}
  | %TitleDirective _ nqstring
      {% d => ({ type: 'title', text: d[2] }) %}
  | %SubttlDirective _ nqstring
      {% d => ({ type: 'subttl', text: d[2] }) %}
  | %PageSizeDirective _ expr
      {% d => ({ type: 'pagesize', size: d[2] }) %}
  | %BytesPerLineDirective _ expr
      {% d => ({ type: 'bytesperline', count: d[2] }) %}
  | %PrintDirective _ nqstring
      {% d => ({ type: 'print', text: d[2] }) %}

macro_args ->
    %IDENT (_ "," _ %IDENT):*
      {% d => [d[0].value, ...(d[1] || []).map(x => x[3].value)] %}

assignment ->
    %IDENT _ (%ASSIGN | %SetDirective) _ expr
      {% d => ({ type: 'assignment', name: d[0].value, value: d[4] }) %}

# ============================================================================
# OPERANDS & ADDRESSING MODES
# ============================================================================

arg_list ->
    arg (_ "," _ arg):*
      {% d => [d[0], ...(d[1] || []).map(x => x[3])] %}

arg ->
    %REG_A
      {% d => ({ type: 'reg', value: 'A' }) %}
  | %HASH _ expr
      {% d => ({ type: 'immediate', expr: d[2] }) %}
  | %LPAREN _ expr _ %RPAREN _ %COMMA _ %REG_X
      {% d => ({ type: 'indirect_x', expr: d[2] }) %}
  | %LPAREN _ expr _ %RPAREN _ %COMMA _ %REG_Y
      {% d => ({ type: 'indirect_y', expr: d[2] }) %}
  | %LPAREN _ expr _ %COMMA _ %REG_X _ %RPAREN
      {% d => ({ type: 'indexed_x', expr: d[2] }) %}
  | %LPAREN _ expr _ %COMMA _ %REG_Y _ %RPAREN
      {% d => ({ type: 'indexed_y', expr: d[2] }) %}
  | %LPAREN _ expr _ %RPAREN
      {% d => ({ type: 'indirect', expr: d[2] }) %}
  | expr
      {% d => ({ type: 'absolute', expr: d[0] }) %}

text_list ->
    text_string (_ %COMMA _ text_string):*
      {% d => [d[0], ...(d[1] || []).map(x => x[3])] %}

text_string ->
    %STRING
      {% d => d[0].value %}
  | expr
      {% d => ({ type: 'expr', value: d[0] }) %}

# ============================================================================
# EXPRESSION HIERARCHY (Left-Associative, Lowest to Highest Precedence)
# ============================================================================

expr -> or_expr

or_expr ->
    xor_expr
      {% d => d[0] %}
  | or_expr _ %OR_OP _ xor_expr
      {% d => ({ type: 'or', left: d[0], right: d[4] }) %}

xor_expr ->
    and_expr
      {% d => d[0] %}
  | xor_expr _ %XOR_OP _ and_expr
      {% d => ({ type: 'xor', left: d[0], right: d[4] }) %}

and_expr ->
    equality_expr
      {% d => d[0] %}
  | and_expr _ %AND_OP _ equality_expr
      {% d => ({ type: 'and', left: d[0], right: d[4] }) %}

equality_expr ->
    relational_expr
      {% d => d[0] %}
  | equality_expr _ (%EQ | %ASSIGN | %NE) _ relational_expr
      {% d => ({ type: 'eq', left: d[0], op: d[2][0].type, right: d[4] }) %}

relational_expr ->
    additive_expr
      {% d => d[0] %}
  | relational_expr _ (%LT | %GT | %LE | %GE) _ additive_expr
      {% d => ({ type: d[2][0].type.toLowerCase(), left: d[0], right: d[4] }) %}

additive_expr ->
    multiplicative_expr
      {% d => d[0] %}
  | additive_expr _ (%PLUS | %MINUS) _ multiplicative_expr
      {% d => ({ type: d[2][0].type.toLowerCase(), left: d[0], right: d[4] }) %}

multiplicative_expr ->
    unary_expr
      {% d => d[0] %}
  | multiplicative_expr _ (%STAR | %DIV | %MOD) _ unary_expr
      {% d => ({ type: d[2][0].type.toLowerCase(), left: d[0], right: d[4] }) %}

unary_expr ->
    primary_expr
      {% d => d[0] %}
  | (%PLUS | %MINUS | %BITNOT | %LNOT | %LT | %GT) _ unary_expr
      {% d => ({ type: d[0][0].type.toLowerCase(), expr: d[2] }) %}

primary_expr ->
    number
      {% d => d[0] %}
  | %CHAR
      {% d => ({ type: 'char', value: d[0].value }) %}
  | %IDENT
      {% d => ({ type: 'ident', value: d[0].value }) %}
  | %ESCAPE _ %IDENT
      {% d => ({ type: 'escaped_ident', value: d[2].value }) %}
  | %STAR
      {% d => ({ type: 'current_location' }) %}
  | %LPAREN _ expr _ %RPAREN
      {% d => d[2] %}

number ->
    %DECNUM
      {% d => ({ type: 'number', base: 10, value: d[0].value }) %}
  | %HEXNUM
      {% d => ({ type: 'number', base: 16, value: d[0].value }) %}
  | %OCTNUM
      {% d => ({ type: 'number', base: 8, value: d[0].value }) %}
  | %BINNUM
      {% d => ({ type: 'number', base: 2, value: d[0].value }) %}

# ============================================================================
# STRING UTILITIES
# ============================================================================

nqstring ->
    %Qstring
      {% d => d[0].value %}
  | %Words
      {% d => d[0].value %}

operation -> null
  # Placeholder for CPU operations (opcodes)
  # To be expanded with: ADC, AND, ASL, BCC, BCS, BEQ, BIT, BMI, BNE, BPL, BRK,
  #                      BVC, BVS, CLC, CLD, CLI, CLV, CMP, CPX, CPY, DEC, DEX,
  #                      DEY, EOR, INC, INX, INY, JMP, JSR, LDA, LDX, LDY, LSR,
  #                      NOP, ORA, PHA, PHP, PLA, PLP, ROL, ROR, RTI, RTS, SBC,
  #                      SEC, SED, SEI, STA, STX, STY, TAX, TAY, TSX, TXA, TXS, TYA

_ -> %WS:?
