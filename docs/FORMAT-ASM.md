# Assembly Source Formatter (format-asm)

A standalone CLI tool for formatting 6502 assembly source code with aligned fixed-width columns.

## Features

- **Auto-detected column widths**: Scans input file to determine optimal label, operation, arguments, and comment column widths
- **Config file support**: Optional JSON configuration to override auto-detected widths
- **Blank line collapsing**: Consolidates consecutive blank lines to single blank line
- **Expression normalization**: Normalizes expressions with spaces around operators (e.g., `ADDR + 1` → `(ADDR + 1)`)
- **Comment preservation**: Moves inline comments to aligned comment column
- **AST-based reconstruction**: Reconstructs operands from parsed AST, ensuring consistent formatting

## Usage

### Basic usage (auto-detect column widths):
```bash
npm run format input.asm [output.asm]
```

Without output file, writes to stdout.

### With custom configuration:
```bash
npm run format input.asm output.asm --config format-asm.config.json
```

## Configuration File Format

`format-asm.config.json` example:
```json
{
  "columnWidths": {
    "label": 9,
    "operation": 8,
    "arguments": 32,
    "comment": 50
  },
  "collapseBlankLines": true,
  "normalizeExpressions": true
}
```

### Column Width Guidelines

- **label**: Width for label column (default auto-detected)
- **operation**: Width for mnemonic/directive column (default auto-detected)
- **arguments**: Width for operand/arguments column (default auto-detected)
- **comment**: Width for comment column (default auto-detected)

Set to 0 for auto-detection of that column.

### Options

- **collapseBlankLines**: `true` (default) consolidates consecutive blank lines; `false` preserves original spacing
- **normalizeExpressions**: `true` (default) normalizes expressions; `false` preserves original form

## Output Format

Lines are formatted as: `label | operation | arguments | comment`

Example:
```
SETUP       LDA        #$00                        ; Initialize accumulator
            STA        COUNTER                     ; Store to counter
            RTS                                     ; Return
```

## Implementation

- **Parser**: Nearley grammar + Moo lexer (existing k65.t2 parser)
- **Reconstruction**: AST-based reconstructors for expressions and operands
- **Pipeline**: Parse → Format → Collapse blank lines → Measure widths → Render → Output

## Error Handling

- Parser errors on individual lines don't stop processing; error messages printed to stderr
- Lines with parse errors are output as-is without formatting
- Tool continues processing remaining lines

## Example Configuration

See [format-asm.config.json](format-asm.config.json) for a sample configuration with custom column widths.
