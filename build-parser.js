#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

// Run nearleyc to generate parser
console.log('Running nearleyc...');
execSync('nearleyc src/ma6.ne -o src/generated/ma6-parser-generated.ts', { stdio: 'inherit' });

// Post-process: Add @ts-nocheck and convert to ESM
console.log('Post-processing generated parser...');
const generatedFile = 'src/generated/ma6-parser-generated.ts';
let content = readFileSync(generatedFile, 'utf8');

// Add @ts-nocheck directive at the very top
if (!content.startsWith('// @ts-nocheck')) {
    content = `// @ts-nocheck\n${content}`;
    console.log('✓ Added @ts-nocheck directive');
}

// Restructure IIFE to make grammar accessible at module level FIRST (before other replacements)
// This ensures we work with the original structure
// Change: (function () { var grammar = {...}; ... })();
// To:     var grammar; (function () { grammar = {...}; ... })();
content = content.replace(
    /\(function \(\) \{\s*function id/,
    'var grammar;\n(function () {\n  function id'
);
content = content.replace(
    /^(\s*)var grammar = \{/m,
    '$1grammar = {'
);

console.log('✓ Restructured grammar to module level');

// Convert token variable references to string references
// Replace bare identifiers in the ParserRules array with quoted versions
const rulesStart = content.indexOf('ParserRules: [');
const rulesEnd = content.indexOf(', ParserStart:');
console.log(`ParserRules found: start=${rulesStart}, end=${rulesEnd}`);
// Convert token variable references to string references
// ONLY within "symbols": [...] JSON arrays
// This preserves postprocess callbacks and other identifiers
content = content.replace(/"symbols":\s*\[([^\]]*)\]/g, (match) => {
    // Within the symbols array, quote bare identifiers (but not those already quoted)
    // Match bare identifiers not preceded/followed by quotes or { }
    let quoted = match.replace(/(\[|,\s*)([a-zA-Z_][a-zA-Z_0-9]*)(?=[\s,\]])/g, (m, prefix, id) => {
        // Don't quote if it's a keyword or JSON literal
        if (['null', 'true', 'false', 'undefined'].includes(id)) {
            return m;
        }
        // Quote it
        return `${prefix}"${id}"`;
    });
    return quoted;
});

console.log('✓ Converted token references in symbols arrays');

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
    content = content.replace(commonJsBlock, '})();\n\nexport default grammar;');
    console.log('✓ Converted to ESM export');
} else {
    console.log('⚠ Could not find CommonJS export block to replace');
}

writeFileSync(generatedFile, content);
console.log('✓ Generated parser updated');




