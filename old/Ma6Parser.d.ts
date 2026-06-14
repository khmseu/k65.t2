import { CstParser } from "chevrotain";
export declare class Ma6Parser extends CstParser {
    constructor();
    line: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    code_line: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    directive: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    macro_args: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    assignment: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    arg_list: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    arg: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    text_list: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    text_string: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    expr: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    or_expr: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    xor_expr: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    and_expr: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    equality_expr: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    relational_expr: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    additive_expr: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    multiplicative_expr: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    unary_expr: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    primary_expr: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    number: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    operation: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
    nqstring: import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>;
}
//# sourceMappingURL=Ma6Parser.d.ts.map