/**
 * Core types and interfaces for the multi-pass assembler
 */

// ============================================================================
// SYMBOL TABLE
// ============================================================================

export type SymbolType = "label" | "constant" | "macro";

export interface Symbol {
  name: string;
  type: SymbolType;
  address?: number; // for labels
  value?: number | string; // for constants/expressions
  macroBody?: string[]; // for macros: line indices
  macroParams?: string[]; // for macros: parameter names
}

export class SymbolTable {
  private symbols: Map<string, Symbol> = new Map();

  set(name: string, symbol: Symbol): void {
    this.symbols.set(name.toUpperCase(), symbol);
  }

  get(name: string): Symbol | undefined {
    return this.symbols.get(name.toUpperCase());
  }

  has(name: string): boolean {
    return this.symbols.has(name.toUpperCase());
  }

  all(): Symbol[] {
    return Array.from(this.symbols.values());
  }

  clear(): void {
    this.symbols.clear();
  }

  clone(): SymbolTable {
    const cloned = new SymbolTable();
    for (const [key, value] of this.symbols) {
      cloned.symbols.set(key, { ...value });
    }
    return cloned;
  }
}

// ============================================================================
// MEMOIZATION FOR EXPRESSION VALUES
// ============================================================================

export interface ExpressionMemo {
  lineNum: number; // source line number (1-based)
  type: "if" | "repeat"; // directive type
  expression: string; // original expression text
  value: number; // evaluated value
  file: string; // source file path
}

export class ExpressionMemoStore {
  private memos: Map<string, ExpressionMemo> = new Map();

  private key(file: string, lineNum: number): string {
    return `${file}:${lineNum}`;
  }

  set(file: string, lineNum: number, memo: ExpressionMemo): void {
    this.memos.set(this.key(file, lineNum), memo);
  }

  get(file: string, lineNum: number): ExpressionMemo | undefined {
    return this.memos.get(this.key(file, lineNum));
  }

  compare(other: ExpressionMemoStore): { changed: boolean; details: string[] } {
    const details: string[] = [];
    let changed = false;

    for (const [key, memo] of this.memos) {
      const otherMemo = other.memos.get(key);
      if (!otherMemo) {
        details.push(`Missing memo in new pass: ${key}`);
        changed = true;
      } else if (otherMemo.value !== memo.value) {
        details.push(
          `${key}: ${memo.type} value changed from ${memo.value} to ${otherMemo.value}`,
        );
        changed = true;
      }
    }

    for (const key of other.memos.keys()) {
      if (!this.memos.has(key)) {
        details.push(`New memo in second pass: ${key}`);
        changed = true;
      }
    }

    return { changed, details };
  }

  clone(): ExpressionMemoStore {
    const cloned = new ExpressionMemoStore();
    for (const [key, memo] of this.memos) {
      cloned.memos.set(key, { ...memo });
    }
    return cloned;
  }
}

// ============================================================================
// MACRO REGISTRY & BLOCKS
// ============================================================================

export interface MacroDefinition {
  name: string;
  params: string[];
  bodyLines: number[]; // indices into source lines array
  bodyText: string[]; // actual body line text (for expansion at call sites)
  file: string;
}

export interface BlockBoundary {
  type: "macro" | "if" | "repeat";
  startLine: number; // index into source
  endLine: number;
  name?: string; // for macros
  nesting?: number;
}

// ============================================================================
// ASSEMBLY OUTPUT
// ============================================================================

export interface ProcessorState {
  symbolTable: SymbolTable;
  memos: ExpressionMemoStore;
  pc: number; // program counter
  errors: AssemblyError[];
  warnings: AssemblyError[];
  generated: GeneratedLine[];
  macros: MacroDefinition[]; // macros registered during the current pass
  listingEvents: ListingEvent[]; // listing-control directives, in source order
}

export interface AssemblyError {
  file: string;
  line: number;
  message: string;
  type: "error" | "warning";
}

export interface GeneratedLine {
  sourceFile: string;
  sourceLine: number; // 1-based
  address: number; // assembled PC
  bytes: number[]; // machine code bytes
  sourceText: string; // original assembly line
}

/**
 * A listing-control directive captured during assembly. `after` records how
 * many generated code lines had been emitted when the directive was seen, so
 * the listing formatter can interleave control actions with code in source
 * order. Text-bearing events (title/subttl/print) carry `text`; sizing events
 * (pagesize/bytesperline) carry `value`.
 */
export interface ListingEvent {
  type:
    | "title"
    | "subttl"
    | "page"
    | "pagesize"
    | "bytesperline"
    | "list"
    | "nolist"
    | "print";
  after: number;
  text?: string;
  value?: number;
}

export interface AssemblyResult {
  binary: number[]; // complete binary image
  listing: GeneratedLine[]; // hex listing with addresses
  symbolTable: Symbol[];
  errors: AssemblyError[];
  warnings: AssemblyError[];
  passes: number; // number of passes performed
  listingEvents: ListingEvent[]; // listing-control directives, in source order
}

// ============================================================================
// PARSED LINE CONTENT
// ============================================================================

export type DirectiveType =
  | "org"
  | "equ"
  | "set"
  | "if"
  | "elseif"
  | "else"
  | "endif"
  | "repeat"
  | "endrepeat"
  | "macro"
  | "endmacro"
  | "include"
  | "byte"
  | "word"
  | "text"
  | "textc"
  | "fill"
  | "align"
  | "list"
  | "nolist"
  | "page"
  | "eject"
  | "title"
  | "subttl"
  | "pagesize"
  | "bytesperline"
  | "print";

// ============================================================================
// PARSER AST NODES (produced by ma6.ne, consumed by the assembler)
// ============================================================================

/** Expression AST node, as emitted by ma6.ne. */
export type ExprNode =
  | { t: "num"; v: number }
  | { t: "sym"; name: string }
  | { t: "pc" }
  | { t: "bin"; op: string; l: ExprNode; r: ExprNode }
  | { t: "un"; op: string; e: ExprNode };

/** Addressing-mode operand attached to an instruction (parser's view). */
export interface OperandNode {
  mode:
    | "accumulator"
    | "immediate"
    | "indirect"
    | "indirectX"
    | "indirectY"
    | "indexedX"
    | "indexedY"
    | "absolute";
  expr: ExprNode | null;
}

/** One item of a .text / .textc list: a string literal or an expression. */
export type TextItem = { t: "str"; v: string } | { t: "expr"; v: ExprNode };

/** A directive statement node. */
export interface DirectiveNode {
  kind: "directive";
  name: string;
  expr?: ExprNode;
  fill?: ExprNode | null;
  file?: string;
  text?: string;
  macroName?: string;
  params?: string[];
  args?: ExprNode[];
  items?: TextItem[];
}

/** A parsed statement: an assignment, a directive, or an instruction. */
export type StmtNode =
  | { kind: "assign"; name: string; value: ExprNode }
  | { kind: "instruction"; mnemonic: string; arg: OperandNode | null }
  | DirectiveNode;

/** A fully parsed line: optional label plus optional statement. */
export interface LineAst {
  label: string | null;
  stmt: StmtNode | null;
}

export interface ParsedLine {
  type:
    | "empty"
    | "comment"
    | "label"
    | "directive"
    | "operation"
    | "data"
    | "error";
  directive?: DirectiveType;
  label?: string;
  /** Single expression AST (.org, .if, .repeat, .equ, .set, .pagesize, ...). */
  expr?: ExprNode;
  /** Fill value AST (.fill / .align second operand). */
  fill?: ExprNode | null;
  /** Data operand ASTs (.byte / .word). */
  data?: ExprNode[];
  /** Text items (.text / .textc). */
  text?: TextItem[];
  /** Filename / literal text payload (.include / .title / .subttl / .print). */
  file?: string;
  operation?: string; // mnemonic
  /** Instruction operand AST (mode + expression). */
  operand?: OperandNode | null;
  /** Macro definition parameter names (.macro). */
  params?: string[];
  /** Raw positional operand text — used ONLY for textual macro expansion. */
  args?: string[];
  /** Parse-error message (type === "error"). */
  error?: string;
  raw: string;
}

// ============================================================================
// 6502 INSTRUCTION ENCODING
// ============================================================================

export type AddressingMode =
  | "implied"
  | "accumulator"
  | "immediate"
  | "zeropage"
  | "zeropageX"
  | "zeropageY"
  | "absolute"
  | "absoluteX"
  | "absoluteY"
  | "indirect"
  | "indirectX"
  | "indirectY"
  | "relative";

export interface OpcodeEntry {
  mnemonic: string;
  opcode: number;
  mode: AddressingMode;
  bytes: number; // 1, 2, or 3
}

export interface InstructionEncoding {
  mnemonic: string;
  bytes: number[];
  addressMode: AddressingMode;
}
