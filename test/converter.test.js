import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { convertMacro10ToK65 } from './convert.js';
describe('MACRO-10 to K65 Converter', () => {
    it('should convert basic assembly syntax', () => {
        const input = `LABEL1:
  LDA #$00
  STA $80`;
        const output = convertMacro10ToK65(input);
        const lines = output.split('\n');
        assert(lines[0].includes('LABEL1:'), 'Should preserve label');
        assert(lines[1].includes('LDA #$00'), 'Should preserve LDA instruction');
        assert(lines[2].includes('STA $80'), 'Should preserve STA instruction');
    });
    it('should preserve blank lines', () => {
        const input = `LABEL1:
  LDA #$00

  STA $80`;
        const output = convertMacro10ToK65(input);
        const lines = output.split('\n');
        // Line 3 should be blank
        assert(lines[2] === '', `Line 3 should be blank, got: ${lines[2]}`);
    });
    it('should preserve comments', () => {
        const input = `; This is a comment
LABEL1:`;
        const output = convertMacro10ToK65(input);
        const lines = output.split('\n');
        // Line 1 should be the comment
        assert(lines[0].includes('; This is a comment'), `Comment line should be preserved, got: ${lines[0]}`);
    });
});
//# sourceMappingURL=converter.test.js.map