# Ma6 Parser: PEG vs Chevrotain

This document explains the conversion from PEG-based parser to Chevrotain-based parser.

## Overview

### PEG Approach (Original)

- **File**: `src/grammar/ma6.peg`
- **Generated**: `src/grammar/ma6.ts` (auto-generated, 615 lines)
- **Tool**: tspeg (PEG to TypeScript compiler)
- **Strengths**:
  - Concise, declarative grammar syntax
  - Expression-oriented rules
  - Built-in error recovery infrastructure
  - Automatic position tracking

### Chevrotain Approach (New)

- **File**: `src/grammar/ma6-chevrotain.ts` (hand-written, ~250 lines)
- **Library**: chevrotain (parser generation framework)
- **Strengths**:
  - Explicit lexer/parser separation (industry standard)
  - Better IDE support and type checking
  - Clearer control flow in parsing logic
  - More flexible error recovery
  - Wider adoption in enterprise tools
  - Easier to debug and maintain

## Key Differences

### 1. Token Definition

**PEG**: Inline regex patterns in rules

```tspeg
linecomment := lc='[*;].*'
```

**Chevrotain**: Explicit token definitions

```typescript
export const Comment = createToken({
  name: "Comment",
  pattern: /;.*/,
  line_breaks: false,
});
```

### 2. Parser Structure

**PEG**: Single grammar file with all rules

**Chevrotain**: Separate concerns:

- Lexer: Tokenization phase
- Parser: Syntax analysis phase

### 3. Rule Definition

**PEG**: Expression-based

```tspeg
content := { opcode | directive }
```

**Chevrotain**: Method-based with explicit combinators

```typescript
public content = this.RULE("content", () => {
  this.OR([
    { ALT: () => this.SUBRULE(this.opcode) },
    { ALT: () => this.SUBRULE(this.directive) },
  ]);
});
```

### 4. Grammar Operators

| Concept      | PEG                      | Chevrotain                     |
| ------------ | ------------------------ | ------------------------------ |
| Sequence     | `a b c`                  | Sequential calls               |
| Choice       | `a \| b \| c`            | `this.OR([...])`               |
| Optional     | `a?`                     | `this.OPTION(() => ...)`       |
| One or more  | `a+`                     | `this.AT_LEAST_ONE(() => ...)` |
| Zero or more | `a*`                     | `this.MANY(() => ...)`         |
| Token match  | `'literal'` or `pattern` | `this.CONSUME(Token)`          |

## Usage

### With PEG (Original)

```typescript
import { parse } from "./grammar/ma6.js";

const result = parse(line);
console.log(result.ast, result.errs);
```

### With Chevrotain (New)

```typescript
import { parseAssemblyLine } from "./grammar/ma6-chevrotain.js";

const result = parseAssemblyLine(line);
console.log(result.ast, result.errs);
```

## Advantages of Chevrotain

1. **Better Tooling**: Full IDE support, type checking, refactoring
2. **Explicit Lexing**: Separate token definitions prevent ambiguities
3. **Performance**: Chevrotain parsers are generally faster for large inputs
4. **Debugging**: Easier to step through and understand parsing logic
5. **Standards-Aligned**: Follows yacc/bison tradition familiar to compiler engineers
6. **Error Recovery**: Fine-grained control over error handling strategies
7. **CST Generation**: Built-in Concrete Syntax Tree generation for transformations

## Comparison Notes

- **Grammar Clarity**: PEG is more compact, Chevrotain more explicit
- **Type Safety**: Chevrotain has better TypeScript integration
- **Flexibility**: Chevrotain allows semantic actions inline with parsing
- **Learning Curve**: Chevrotain steeper initially but more familiar to compiler-trained developers
- **File Maintenance**: PEG requires regeneration, Chevrotain is direct source code

## Migration Path

Both parsers coexist:

- Use PEG approach for rapid experimentation
- Use Chevrotain for production deployment
- Compare outputs to validate equivalence

Both expect the same CST structure for downstream processing.
