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



