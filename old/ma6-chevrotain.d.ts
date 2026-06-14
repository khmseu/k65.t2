import type { CstNode, ILexingError, IRecognitionException } from "chevrotain";
export declare function createDtsFromParser(): void;
export declare function generateSyntaxDiagrams(path: string): void;
export declare function parseAssemblyLine(input: string): {
    ast: CstNode;
    errs: (ILexingError | IRecognitionException)[];
};
type SimpleToken = {
    image: string;
    tokenType: string;
    payload?: string | any;
};
export declare function in_short(cst: CstNode): SimpleToken[];
export {};
//# sourceMappingURL=ma6-chevrotain.d.ts.map