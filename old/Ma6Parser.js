import { CstParser } from "chevrotain";
import { AlignDirective as ALIGN, allTokens, AND_OP, ASSIGN, BINNUM, BITNOT, ByteDirective as BYTE, BytesPerLineDirective as BYTESPERLINE, CHAR, COLON, COMMA, Comment, DECNUM, DIV, EjectDirective as EJECT, ElseDirective as ELSE, ElseIfDirective as ELSEIF, EndIfDirective as ENDIF, EndMacroDirective as ENDMACRO, EndRepeatDirective as ENDREPEAT, EQ, EquDirective as EQU, ESCAPE, FillDirective as FILL, GE, GT, HASH, HEXNUM, IDENT, IfDirective as IF, IncludeDirective, LE, linecomment, ListDirective as LIST, LNOT, LPAREN, LT, MacroDirective as MACRO, MINUS, MOD, NE, NoListDirective as NOLIST, OCTNUM, OR_OP, OrgDirective as ORG, PageDirective as PAGE, PageSizeDirective as PAGESIZE, PLUS, PrintDirective as PRINT, Qstring, REG_A, REG_X, REG_Y, RepeatDirective as REPEAT, RPAREN, SetDirective as SET, STAR, STRING, SubttlDirective as SUBTTL, TextDirective as TEXT, TitleDirective as TITLE, Unimplemented, WordDirective as WORD, Words, XOR_OP, } from "./ma6Lexer.js";
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
    line = this.RULE("line", () => {
        this.OR([
            { ALT: () => this.CONSUME(linecomment) },
            {
                ALT: () => {
                    this.OPTION(() => {
                        this.SUBRULE(this.code_line);
                    });
                    this.OPTION1(() => {
                        this.CONSUME(Comment);
                    });
                },
            },
        ]);
    });
    code_line = this.RULE("code_line", () => {
        this.OPTION(() => {
            this.CONSUME(IDENT);
            this.OPTION1(() => {
                this.CONSUME(COLON);
            });
        });
        this.OPTION2(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.directive) },
                { ALT: () => this.SUBRULE(this.assignment) },
                {
                    ALT: () => {
                        this.SUBRULE(this.operation);
                        this.MANY(() => {
                            this.SUBRULE(this.arg_list);
                        });
                    },
                },
            ]);
        });
    });
    directive = this.RULE("directive", () => {
        this.OR([
            {
                ALT: () => {
                    this.OR1([
                        { ALT: () => this.CONSUME(ORG) },
                        { ALT: () => this.CONSUME(EQU) },
                        { ALT: () => this.CONSUME(SET) },
                        { ALT: () => this.CONSUME(REPEAT) },
                        { ALT: () => this.CONSUME(IF) },
                        { ALT: () => this.CONSUME(ELSEIF) },
                    ]);
                    this.SUBRULE(this.expr);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(IncludeDirective);
                    this.SUBRULE(this.nqstring);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(ALIGN);
                    this.SUBRULE1(this.expr);
                    this.OPTION(() => {
                        this.CONSUME(COMMA);
                        this.SUBRULE2(this.expr);
                    });
                },
            },
            {
                ALT: () => {
                    this.CONSUME(MACRO);
                    this.CONSUME(IDENT);
                    this.OPTION1(() => {
                        this.CONSUME1(COMMA);
                        this.SUBRULE(this.macro_args);
                    });
                },
            },
            {
                ALT: () => {
                    this.CONSUME(ENDMACRO);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(ENDREPEAT);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(ELSE);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(ENDIF);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(BYTE);
                    this.SUBRULE(this.arg_list);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(WORD);
                    this.SUBRULE1(this.arg_list);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(TEXT);
                    this.SUBRULE(this.text_list);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(FILL);
                    this.SUBRULE3(this.expr);
                    this.OPTION2(() => {
                        this.CONSUME2(COMMA);
                        this.SUBRULE4(this.expr);
                    });
                },
            },
            {
                ALT: () => {
                    this.CONSUME(LIST);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(NOLIST);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(PAGE);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(EJECT);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(TITLE);
                    this.SUBRULE1(this.nqstring);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(SUBTTL);
                    this.SUBRULE2(this.nqstring);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(PAGESIZE);
                    this.SUBRULE5(this.expr);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(BYTESPERLINE);
                    this.SUBRULE6(this.expr);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(PRINT);
                    this.SUBRULE3(this.nqstring);
                },
            },
        ]);
    });
    macro_args = this.RULE("macro_args", () => {
        this.CONSUME(IDENT);
        this.MANY(() => {
            this.CONSUME(COMMA);
            this.CONSUME2(IDENT);
        });
    });
    assignment = this.RULE("assignment", () => {
        this.CONSUME(IDENT);
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(ASSIGN);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(SET);
                },
            },
        ]);
        this.SUBRULE(this.expr);
    });
    arg_list = this.RULE("arg_list", () => {
        this.SUBRULE(this.arg);
        this.MANY(() => {
            this.CONSUME(COMMA);
            this.SUBRULE2(this.arg);
        });
    });
    arg = this.RULE("arg", () => {
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(REG_A);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(HASH);
                    this.SUBRULE(this.expr);
                },
            },
            {
                ALT: () => {
                    this.SUBRULE1(this.expr);
                },
            },
            {
                ALT: () => {
                    this.CONSUME(LPAREN);
                    this.SUBRULE2(this.expr);
                    this.CONSUME(RPAREN);
                },
            },
            {
                ALT: () => {
                    this.CONSUME1(LPAREN);
                    this.SUBRULE3(this.expr);
                    this.CONSUME1(COMMA);
                    this.CONSUME(REG_X);
                    this.CONSUME1(RPAREN);
                },
            },
            {
                ALT: () => {
                    this.CONSUME2(LPAREN);
                    this.SUBRULE4(this.expr);
                    this.CONSUME2(COMMA);
                    this.CONSUME(REG_Y);
                    this.CONSUME2(RPAREN);
                },
            },
            {
                ALT: () => {
                    this.CONSUME3(LPAREN);
                    this.SUBRULE5(this.expr);
                    this.CONSUME3(RPAREN);
                    this.CONSUME3(COMMA);
                    this.CONSUME2(REG_X);
                },
            },
            {
                ALT: () => {
                    this.CONSUME4(LPAREN);
                    this.SUBRULE6(this.expr);
                    this.CONSUME4(RPAREN);
                    this.CONSUME(COMMA);
                    this.CONSUME2(REG_Y);
                },
            },
        ]);
    });
    text_list = this.RULE("text_list", () => {
        this.SUBRULE(this.text_string);
        this.MANY(() => {
            this.CONSUME(COMMA);
            this.SUBRULE2(this.text_string);
        });
    });
    text_string = this.RULE("text_string", () => {
        this.OR([
            { ALT: () => this.CONSUME(STRING) },
            { ALT: () => this.SUBRULE(this.expr) },
        ]);
    });
    expr = this.RULE("expr", () => {
        this.SUBRULE(this.or_expr);
    });
    or_expr = this.RULE("or_expr", () => {
        this.SUBRULE(this.xor_expr);
        this.MANY(() => {
            this.CONSUME(OR_OP);
            this.SUBRULE2(this.xor_expr);
        });
    });
    xor_expr = this.RULE("xor_expr", () => {
        this.SUBRULE(this.and_expr);
        this.MANY(() => {
            this.CONSUME(XOR_OP);
            this.SUBRULE2(this.and_expr);
        });
    });
    and_expr = this.RULE("and_expr", () => {
        this.SUBRULE(this.equality_expr);
        this.MANY(() => {
            this.CONSUME(AND_OP);
            this.SUBRULE2(this.equality_expr);
        });
    });
    equality_expr = this.RULE("equality_expr", () => {
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
    relational_expr = this.RULE("relational_expr", () => {
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
    additive_expr = this.RULE("additive_expr", () => {
        this.SUBRULE(this.multiplicative_expr);
        this.MANY(() => {
            this.OR([
                { ALT: () => this.CONSUME(PLUS) },
                { ALT: () => this.CONSUME(MINUS) },
            ]);
            this.SUBRULE2(this.multiplicative_expr);
        });
    });
    multiplicative_expr = this.RULE("multiplicative_expr", () => {
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
    unary_expr = this.RULE("unary_expr", () => {
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
    primary_expr = this.RULE("primary_expr", () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.number) },
            { ALT: () => this.CONSUME(CHAR) },
            { ALT: () => this.CONSUME(IDENT) },
            {
                ALT: () => {
                    this.CONSUME(ESCAPE);
                    this.CONSUME1(IDENT);
                },
            },
            { ALT: () => this.CONSUME(STAR) },
            {
                ALT: () => {
                    this.CONSUME3(LPAREN);
                    this.SUBRULE3(this.expr);
                    this.CONSUME3(RPAREN);
                },
            },
        ]);
    });
    number = this.RULE("number", () => {
        this.OR([
            { ALT: () => this.CONSUME(DECNUM) },
            { ALT: () => this.CONSUME(HEXNUM) },
            { ALT: () => this.CONSUME(OCTNUM) },
            { ALT: () => this.CONSUME(BINNUM) },
        ]);
    });
    operation = this.RULE("opcode", () => {
        this.CONSUME(Unimplemented);
    });
    nqstring = this.RULE("nqstring", () => {
        this.OR([
            { ALT: () => this.CONSUME(Qstring) },
            { ALT: () => this.CONSUME(Words) },
        ]);
    });
}
//# sourceMappingURL=Ma6Parser.js.map