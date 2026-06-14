# Nearley Grammar Translation Guide

This directory contains a translation of the 6502 assembly language parser from Chevrotain to Nearley.js.

## Files

- **ma6.ne** - Nearley grammar definition (BNF-style rules)
- **ma6-lexer-moo.ts** - Moo lexer configuration for tokenization
- **ma6-parser-wrapper.ts** - Wrapper API for parse operations

## Setup

### 1. Install Dependencies

```bash
npm install nearley moo
npm install --save-dev @types/moo
```

### 2. Compile Grammar ✅ (Already Done)

The grammar has been compiled to `src/ma6-parser-generated.ts` (13KB).

To recompile if you modify `src/ma6.ne`:

```bash
npx nearleyc src/ma6.ne -o src/ma6-parser-generated.ts
```

This creates `ma6-parser-generated.ts` which contains the compiled Earley parser.

**Key Fix**: The grammar now correctly uses Moo token references with `%` prefix (e.g., `%STRING`, `%HEXNUM`, `%IDENT`) instead of trying to define tokens in grammar syntax.

### 3. Generate Type Definitions (Optional)

For better TypeScript support, generate railroad diagrams and type info:

```bash
npx nearley-railroad src/ma6.ne -o docs/ma6-railroad.html
```

## Usage

### Basic Parsing

```typescript
import { parseAssemblyLine, parseAssemblyFile } from "./ma6-parser-wrapper";

// Parse single line
const result = parseAssemblyLine("LDA #$FF");
console.log(result.ast); // Parsed AST
console.log(result.errors); // Any parse errors

// Parse file content
const lines = parseAssemblyFile(fileContent);
lines.forEach((result, idx) => {
  if (result.errors.length > 0) {
    console.error(`Line ${result.line}: ${result.errors.join(", ")}`);
  }
});
```

### Advanced: Direct Parser Access

```typescript
import { parser, lexer } from "./ma6-parser-wrapper";

lexer.reset();
lexer.setText(input);
const results = parser.feed(lexer);

if (results.length > 0) {
  console.log(results[0]); // First parse result
}
```

## Grammar Structure

The grammar supports:

### Directives (24+ types)

- Data/storage: `.byte`, `.word`, `.text`, `.fill`
- Org/equate: `.org`, `.equ`, `.set`
- Control flow: `.if`, `.else`, `.endif`
- Macros: `.macro`, `.endmacro`, `.repeat`, `.endrepeat`
- Formatting: `.align`, `.page`, `.list`, `.title`, etc.
- Include: `.include`

### Addressing Modes

- Immediate: `LDA #$FF`
- Indirect: `LDA ($80)`
- Indirect X: `LDA ($80,X)`
- Indirect Y: `LDA ($80),Y`
- Indexed X: `LDA $8000,X`
- Indexed Y: `LDA $8000,Y`
- Absolute: `LDA $8000`

### Operators (with precedence)

- Bitwise: `|`, `^`, `&`, `~`
- Comparison: `==`, `!=`, `<`, `>`, `<=`, `>=`
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Unary: `+x`, `-x`, `~x`, `!x`

### Literals

- Decimal: `42`
- Hexadecimal: `$FF` or `0x12AB`
- Octal: `0o77`
- Binary: `%11001100` or `0b11001100`
- Character: `'A'` or `'\'`
- String: `"hello"`

## Differences from Chevrotain Version

| Aspect             | Chevrotain                  | Nearley                             |
| ------------------ | --------------------------- | ----------------------------------- |
| **Rule format**    | Method calls in class       | BNF-style rules                     |
| **Alternation**    | `this.OR([...])`            | `\|` operator                       |
| **Repetition**     | `this.MANY(...)`            | `*` and `:*` operators              |
| **Token matching** | Explicit pattern methods    | Regex patterns                      |
| **Tokenizer**      | Built-in lexer              | External (Moo) lexer                |
| **Error handling** | Recovery enabled by default | Earley algorithm handles ambiguity  |
| **Performance**    | LR parser                   | Earley algorithm (linear for LL(k)) |

## Advantages of Nearley

- **Simpler grammar definition** - BNF is more declarative than method calls
- **Smaller output** - Nearley produces compact compiled parsers
- **Ambiguity handling** - Earley algorithm returns all valid parses
- **Railroad diagrams** - Auto-generate visual documentation
- **No build step for parser itself** - Grammar can be used directly

## Advantages of Chevrotain (retained in original)

- **Better error recovery** - Original has recovery enabled
- **CST generation** - Original produces full parse trees
- **Type safety** - Original uses TypeScript classes

## Next Steps

1. **Implement opcodes**: Expand `operation` rule with 6502 mnemonics
2. **Add semantic actions**: Enhance grammar with post-processing functions
3. **Build code generator**: Create visitor to transform AST to bytecode
4. **Add macro expansion**: Implement macro substitution pass
5. **Conditional assembly**: Evaluate `.if/.else/.endif` directives

## Testing

```bash
# Parse a test file
npm run test -- test/m6502.converted.asm

# Generate random test cases
nearley-unparse -n 10 src/ma6-parser-generated.js
```

## References

- [Nearley Documentation](https://nearley.js.org/)
- [Moo Lexer](https://github.com/no-context/moo)
- [BNF Notation](https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_form)
- [Earley Algorithm](https://en.wikipedia.org/wiki/Earley_parser)
