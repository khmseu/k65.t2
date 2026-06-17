#!/usr/bin/env node
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

// Run nearleyc to generate parser
console.log("Running nearleyc...");
execSync("nearleyc src/ma6.ne -o src/generated/ma6-parser-generated.ts", {
  stdio: "inherit",
});

// Post-process: Convert to ESM
console.log("Post-processing generated parser...");
const generatedFile = "src/generated/ma6-parser-generated.ts";
let content = readFileSync(generatedFile, "utf8");

// nearleyc embeds the @{% import lexer %} preamble INSIDE the generated IIFE.
// After collapsing the token-matcher ternaries below, the only remaining
// reference to `lexer` is the grammar's `Lexer:` property -- which the parser
// wrapper overrides at runtime by passing its own (whitespace-filtering)
// lexer. So we drop both the embedded import and the `Lexer:` property here,
// keeping the generated module free of any cross-project source dependency.
content = content.replace(
  /^[ \t]*import\s+[^\n;]+?from\s+["'][^"']+["'];[ \t]*\n/gm,
  "",
);
console.log("✓ Removed embedded lexer import");

// nearleyc emits token matchers as `(lexer.has("X") ? {type: "X"} : X)`. The
// `: X` fallback references a bare identifier that does not exist in module
// scope (it assumes a global token constant), which fails TypeScript's
// type-check. Since the lexer always defines these tokens, collapse each
// ternary to the plain `{type: "X"}` matcher.
content = content.replace(
  /\(lexer\.has\("([A-Za-z_][A-Za-z0-9_]*)"\)\s*\?\s*\{type:\s*"\1"\}\s*:\s*[A-Za-z_][A-Za-z0-9_]*\)/g,
  '{type: "$1"}',
);
console.log("✓ Collapsed token matcher ternaries");

// Drop the grammar's `Lexer:` property -- the wrapper supplies its own lexer
// to the Parser at runtime, so this reference to the now-removed import would
// otherwise be a dangling symbol.
content = content.replace(/^[ \t]*Lexer:\s*lexer,[ \t]*\n/m, "");
console.log("✓ Removed grammar Lexer property");

// Restructure IIFE to make grammar accessible at module level FIRST (before other replacements)
// This ensures we work with the original structure
// Change: (function () { var grammar = {...}; ... })();
// To:     var grammar; (function () { grammar = {...}; ... })();
content = content.replace(
  /\(function \(\) \{\s*function id/,
  `import type { CompiledRules } from "nearley";
var grammar: CompiledRules;
(function () {
  function id`,
);
content = content.replace(/^(\s*)var grammar = \{/m, "$1grammar = {");

console.log("✓ Restructured grammar to module level");

// Convert token variable references to string references
// Replace bare identifiers in the ParserRules array with quoted versions
const rulesStart = content.indexOf("ParserRules: [");
const rulesEnd = content.indexOf(", ParserStart:");
console.log(`ParserRules found: start=${rulesStart}, end=${rulesEnd}`);
// Convert token variable references to string references
// ONLY within "symbols": [...] JSON arrays
// This preserves postprocess callbacks and other identifiers
content = content.replace(/"symbols":\s*\[([^\]]*)\]/g, (match) => {
  // Within the symbols array, quote bare identifiers (but not those already quoted)
  // Match bare identifiers not preceded/followed by quotes or { }
  let quoted = match.replace(
    /(\[|,\s*)([a-zA-Z_][a-zA-Z_0-9]*)(?=[\s,\]])/g,
    (m, prefix, id) => {
      // Don't quote if it's a keyword or JSON literal
      if (["null", "true", "false", "undefined"].includes(id)) {
        return m;
      }
      // Quote it
      return `${prefix}"${id}"`;
    },
  );
  return quoted;
});

console.log("✓ Converted token references in symbols arrays");

// Convert CommonJS export to ESM:
// 1. Remove the CommonJS if/else block
// 2. Add export statement at end
const commonJsBlock = `if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();`;

if (content.includes(commonJsBlock)) {
  content = content.replace(commonJsBlock, "})();\n\nexport default grammar;");
  console.log("✓ Converted to ESM export");
} else {
  console.log("⚠ Could not find CommonJS export block to replace");
}

writeFileSync(generatedFile, content);
console.log("✓ Generated parser updated");
