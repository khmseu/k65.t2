/**
 * 6502 Microprocessor Opcode Table
 * Complete instruction set with addressing modes and byte counts
 * Reference: https://www.pagetable.com/?p=410
 */

import type { OpcodeEntry } from "./assembler-types.js";

export const OPCODES: OpcodeEntry[] = [
  // ADC (Add with Carry)
  { mnemonic: "ADC", mode: "immediate", opcode: 0x69, bytes: 2 },
  { mnemonic: "ADC", mode: "zeropage", opcode: 0x65, bytes: 2 },
  { mnemonic: "ADC", mode: "zeropageX", opcode: 0x75, bytes: 2 },
  { mnemonic: "ADC", mode: "absolute", opcode: 0x6d, bytes: 3 },
  { mnemonic: "ADC", mode: "absoluteX", opcode: 0x7d, bytes: 3 },
  { mnemonic: "ADC", mode: "absoluteY", opcode: 0x79, bytes: 3 },
  { mnemonic: "ADC", mode: "indirectX", opcode: 0x61, bytes: 2 },
  { mnemonic: "ADC", mode: "indirectY", opcode: 0x71, bytes: 2 },

  // AND (Logical AND)
  { mnemonic: "AND", mode: "immediate", opcode: 0x29, bytes: 2 },
  { mnemonic: "AND", mode: "zeropage", opcode: 0x25, bytes: 2 },
  { mnemonic: "AND", mode: "zeropageX", opcode: 0x35, bytes: 2 },
  { mnemonic: "AND", mode: "absolute", opcode: 0x2d, bytes: 3 },
  { mnemonic: "AND", mode: "absoluteX", opcode: 0x3d, bytes: 3 },
  { mnemonic: "AND", mode: "absoluteY", opcode: 0x39, bytes: 3 },
  { mnemonic: "AND", mode: "indirectX", opcode: 0x21, bytes: 2 },
  { mnemonic: "AND", mode: "indirectY", opcode: 0x31, bytes: 2 },

  // ASL (Arithmetic Shift Left)
  { mnemonic: "ASL", mode: "accumulator", opcode: 0x0a, bytes: 1 },
  { mnemonic: "ASL", mode: "zeropage", opcode: 0x06, bytes: 2 },
  { mnemonic: "ASL", mode: "zeropageX", opcode: 0x16, bytes: 2 },
  { mnemonic: "ASL", mode: "absolute", opcode: 0x0e, bytes: 3 },
  { mnemonic: "ASL", mode: "absoluteX", opcode: 0x1e, bytes: 3 },

  // BCC (Branch if Carry Clear)
  { mnemonic: "BCC", mode: "relative", opcode: 0x90, bytes: 2 },

  // BCS (Branch if Carry Set)
  { mnemonic: "BCS", mode: "relative", opcode: 0xb0, bytes: 2 },

  // BEQ (Branch if Equal)
  { mnemonic: "BEQ", mode: "relative", opcode: 0xf0, bytes: 2 },

  // BIT (Bit Test)
  { mnemonic: "BIT", mode: "zeropage", opcode: 0x24, bytes: 2 },
  { mnemonic: "BIT", mode: "absolute", opcode: 0x2c, bytes: 3 },

  // BMI (Branch if Minus)
  { mnemonic: "BMI", mode: "relative", opcode: 0x30, bytes: 2 },

  // BNE (Branch if Not Equal)
  { mnemonic: "BNE", mode: "relative", opcode: 0xd0, bytes: 2 },

  // BPL (Branch if Plus)
  { mnemonic: "BPL", mode: "relative", opcode: 0x10, bytes: 2 },

  // BRK (Break)
  { mnemonic: "BRK", mode: "implied", opcode: 0x00, bytes: 1 },

  // BVC (Branch if Overflow Clear)
  { mnemonic: "BVC", mode: "relative", opcode: 0x50, bytes: 2 },

  // BVS (Branch if Overflow Set)
  { mnemonic: "BVS", mode: "relative", opcode: 0x70, bytes: 2 },

  // CLC (Clear Carry)
  { mnemonic: "CLC", mode: "implied", opcode: 0x18, bytes: 1 },

  // CLD (Clear Decimal)
  { mnemonic: "CLD", mode: "implied", opcode: 0xd8, bytes: 1 },

  // CLI (Clear Interrupt Disable)
  { mnemonic: "CLI", mode: "implied", opcode: 0x58, bytes: 1 },

  // CLV (Clear Overflow)
  { mnemonic: "CLV", mode: "implied", opcode: 0xb8, bytes: 1 },

  // CMP (Compare)
  { mnemonic: "CMP", mode: "immediate", opcode: 0xc9, bytes: 2 },
  { mnemonic: "CMP", mode: "zeropage", opcode: 0xc5, bytes: 2 },
  { mnemonic: "CMP", mode: "zeropageX", opcode: 0xd5, bytes: 2 },
  { mnemonic: "CMP", mode: "absolute", opcode: 0xcd, bytes: 3 },
  { mnemonic: "CMP", mode: "absoluteX", opcode: 0xdd, bytes: 3 },
  { mnemonic: "CMP", mode: "absoluteY", opcode: 0xd9, bytes: 3 },
  { mnemonic: "CMP", mode: "indirectX", opcode: 0xc1, bytes: 2 },
  { mnemonic: "CMP", mode: "indirectY", opcode: 0xd1, bytes: 2 },

  // CPX (Compare X)
  { mnemonic: "CPX", mode: "immediate", opcode: 0xe0, bytes: 2 },
  { mnemonic: "CPX", mode: "zeropage", opcode: 0xe4, bytes: 2 },
  { mnemonic: "CPX", mode: "absolute", opcode: 0xec, bytes: 3 },

  // CPY (Compare Y)
  { mnemonic: "CPY", mode: "immediate", opcode: 0xc0, bytes: 2 },
  { mnemonic: "CPY", mode: "zeropage", opcode: 0xc4, bytes: 2 },
  { mnemonic: "CPY", mode: "absolute", opcode: 0xcc, bytes: 3 },

  // DEC (Decrement)
  { mnemonic: "DEC", mode: "zeropage", opcode: 0xc6, bytes: 2 },
  { mnemonic: "DEC", mode: "zeropageX", opcode: 0xd6, bytes: 2 },
  { mnemonic: "DEC", mode: "absolute", opcode: 0xce, bytes: 3 },
  { mnemonic: "DEC", mode: "absoluteX", opcode: 0xde, bytes: 3 },

  // DEX (Decrement X)
  { mnemonic: "DEX", mode: "implied", opcode: 0xca, bytes: 1 },

  // DEY (Decrement Y)
  { mnemonic: "DEY", mode: "implied", opcode: 0x88, bytes: 1 },

  // EOR (Exclusive OR)
  { mnemonic: "EOR", mode: "immediate", opcode: 0x49, bytes: 2 },
  { mnemonic: "EOR", mode: "zeropage", opcode: 0x45, bytes: 2 },
  { mnemonic: "EOR", mode: "zeropageX", opcode: 0x55, bytes: 2 },
  { mnemonic: "EOR", mode: "absolute", opcode: 0x4d, bytes: 3 },
  { mnemonic: "EOR", mode: "absoluteX", opcode: 0x5d, bytes: 3 },
  { mnemonic: "EOR", mode: "absoluteY", opcode: 0x59, bytes: 3 },
  { mnemonic: "EOR", mode: "indirectX", opcode: 0x41, bytes: 2 },
  { mnemonic: "EOR", mode: "indirectY", opcode: 0x51, bytes: 2 },

  // INC (Increment)
  { mnemonic: "INC", mode: "zeropage", opcode: 0xe6, bytes: 2 },
  { mnemonic: "INC", mode: "zeropageX", opcode: 0xf6, bytes: 2 },
  { mnemonic: "INC", mode: "absolute", opcode: 0xee, bytes: 3 },
  { mnemonic: "INC", mode: "absoluteX", opcode: 0xfe, bytes: 3 },

  // INX (Increment X)
  { mnemonic: "INX", mode: "implied", opcode: 0xe8, bytes: 1 },

  // INY (Increment Y)
  { mnemonic: "INY", mode: "implied", opcode: 0xc8, bytes: 1 },

  // JMP (Jump)
  { mnemonic: "JMP", mode: "absolute", opcode: 0x4c, bytes: 3 },
  { mnemonic: "JMP", mode: "indirect", opcode: 0x6c, bytes: 3 },

  // JSR (Jump to Subroutine)
  { mnemonic: "JSR", mode: "absolute", opcode: 0x20, bytes: 3 },

  // LDA (Load Accumulator)
  { mnemonic: "LDA", mode: "immediate", opcode: 0xa9, bytes: 2 },
  { mnemonic: "LDA", mode: "zeropage", opcode: 0xa5, bytes: 2 },
  { mnemonic: "LDA", mode: "zeropageX", opcode: 0xb5, bytes: 2 },
  { mnemonic: "LDA", mode: "absolute", opcode: 0xad, bytes: 3 },
  { mnemonic: "LDA", mode: "absoluteX", opcode: 0xbd, bytes: 3 },
  { mnemonic: "LDA", mode: "absoluteY", opcode: 0xb9, bytes: 3 },
  { mnemonic: "LDA", mode: "indirectX", opcode: 0xa1, bytes: 2 },
  { mnemonic: "LDA", mode: "indirectY", opcode: 0xb1, bytes: 2 },

  // LDX (Load X)
  { mnemonic: "LDX", mode: "immediate", opcode: 0xa2, bytes: 2 },
  { mnemonic: "LDX", mode: "zeropage", opcode: 0xa6, bytes: 2 },
  { mnemonic: "LDX", mode: "zeropageY", opcode: 0xb6, bytes: 2 },
  { mnemonic: "LDX", mode: "absolute", opcode: 0xae, bytes: 3 },
  { mnemonic: "LDX", mode: "absoluteY", opcode: 0xbe, bytes: 3 },

  // LDY (Load Y)
  { mnemonic: "LDY", mode: "immediate", opcode: 0xa0, bytes: 2 },
  { mnemonic: "LDY", mode: "zeropage", opcode: 0xa4, bytes: 2 },
  { mnemonic: "LDY", mode: "zeropageX", opcode: 0xb4, bytes: 2 },
  { mnemonic: "LDY", mode: "absolute", opcode: 0xac, bytes: 3 },
  { mnemonic: "LDY", mode: "absoluteX", opcode: 0xbc, bytes: 3 },

  // LSR (Logical Shift Right)
  { mnemonic: "LSR", mode: "accumulator", opcode: 0x4a, bytes: 1 },
  { mnemonic: "LSR", mode: "zeropage", opcode: 0x46, bytes: 2 },
  { mnemonic: "LSR", mode: "zeropageX", opcode: 0x56, bytes: 2 },
  { mnemonic: "LSR", mode: "absolute", opcode: 0x4e, bytes: 3 },
  { mnemonic: "LSR", mode: "absoluteX", opcode: 0x5e, bytes: 3 },

  // NOP (No Operation)
  { mnemonic: "NOP", mode: "implied", opcode: 0xea, bytes: 1 },

  // ORA (Logical OR)
  { mnemonic: "ORA", mode: "immediate", opcode: 0x09, bytes: 2 },
  { mnemonic: "ORA", mode: "zeropage", opcode: 0x05, bytes: 2 },
  { mnemonic: "ORA", mode: "zeropageX", opcode: 0x15, bytes: 2 },
  { mnemonic: "ORA", mode: "absolute", opcode: 0x0d, bytes: 3 },
  { mnemonic: "ORA", mode: "absoluteX", opcode: 0x1d, bytes: 3 },
  { mnemonic: "ORA", mode: "absoluteY", opcode: 0x19, bytes: 3 },
  { mnemonic: "ORA", mode: "indirectX", opcode: 0x01, bytes: 2 },
  { mnemonic: "ORA", mode: "indirectY", opcode: 0x11, bytes: 2 },

  // PHA (Push Accumulator)
  { mnemonic: "PHA", mode: "implied", opcode: 0x48, bytes: 1 },

  // PHP (Push Processor Status)
  { mnemonic: "PHP", mode: "implied", opcode: 0x08, bytes: 1 },

  // PLA (Pull Accumulator)
  { mnemonic: "PLA", mode: "implied", opcode: 0x68, bytes: 1 },

  // PLP (Pull Processor Status)
  { mnemonic: "PLP", mode: "implied", opcode: 0x28, bytes: 1 },

  // ROL (Rotate Left)
  { mnemonic: "ROL", mode: "accumulator", opcode: 0x2a, bytes: 1 },
  { mnemonic: "ROL", mode: "zeropage", opcode: 0x26, bytes: 2 },
  { mnemonic: "ROL", mode: "zeropageX", opcode: 0x36, bytes: 2 },
  { mnemonic: "ROL", mode: "absolute", opcode: 0x2e, bytes: 3 },
  { mnemonic: "ROL", mode: "absoluteX", opcode: 0x3e, bytes: 3 },

  // ROR (Rotate Right)
  { mnemonic: "ROR", mode: "accumulator", opcode: 0x6a, bytes: 1 },
  { mnemonic: "ROR", mode: "zeropage", opcode: 0x66, bytes: 2 },
  { mnemonic: "ROR", mode: "zeropageX", opcode: 0x76, bytes: 2 },
  { mnemonic: "ROR", mode: "absolute", opcode: 0x6e, bytes: 3 },
  { mnemonic: "ROR", mode: "absoluteX", opcode: 0x7e, bytes: 3 },

  // RTI (Return from Interrupt)
  { mnemonic: "RTI", mode: "implied", opcode: 0x40, bytes: 1 },

  // RTS (Return from Subroutine)
  { mnemonic: "RTS", mode: "implied", opcode: 0x60, bytes: 1 },

  // SBC (Subtract with Carry)
  { mnemonic: "SBC", mode: "immediate", opcode: 0xe9, bytes: 2 },
  { mnemonic: "SBC", mode: "zeropage", opcode: 0xe5, bytes: 2 },
  { mnemonic: "SBC", mode: "zeropageX", opcode: 0xf5, bytes: 2 },
  { mnemonic: "SBC", mode: "absolute", opcode: 0xed, bytes: 3 },
  { mnemonic: "SBC", mode: "absoluteX", opcode: 0xfd, bytes: 3 },
  { mnemonic: "SBC", mode: "absoluteY", opcode: 0xf9, bytes: 3 },
  { mnemonic: "SBC", mode: "indirectX", opcode: 0xe1, bytes: 2 },
  { mnemonic: "SBC", mode: "indirectY", opcode: 0xf1, bytes: 2 },

  // SEC (Set Carry)
  { mnemonic: "SEC", mode: "implied", opcode: 0x38, bytes: 1 },

  // SED (Set Decimal)
  { mnemonic: "SED", mode: "implied", opcode: 0xf8, bytes: 1 },

  // SEI (Set Interrupt Disable)
  { mnemonic: "SEI", mode: "implied", opcode: 0x78, bytes: 1 },

  // STA (Store Accumulator)
  { mnemonic: "STA", mode: "zeropage", opcode: 0x85, bytes: 2 },
  { mnemonic: "STA", mode: "zeropageX", opcode: 0x95, bytes: 2 },
  { mnemonic: "STA", mode: "absolute", opcode: 0x8d, bytes: 3 },
  { mnemonic: "STA", mode: "absoluteX", opcode: 0x9d, bytes: 3 },
  { mnemonic: "STA", mode: "absoluteY", opcode: 0x99, bytes: 3 },
  { mnemonic: "STA", mode: "indirectX", opcode: 0x81, bytes: 2 },
  { mnemonic: "STA", mode: "indirectY", opcode: 0x91, bytes: 2 },

  // STX (Store X)
  { mnemonic: "STX", mode: "zeropage", opcode: 0x86, bytes: 2 },
  { mnemonic: "STX", mode: "zeropageY", opcode: 0x96, bytes: 2 },
  { mnemonic: "STX", mode: "absolute", opcode: 0x8e, bytes: 3 },

  // STY (Store Y)
  { mnemonic: "STY", mode: "zeropage", opcode: 0x84, bytes: 2 },
  { mnemonic: "STY", mode: "zeropageX", opcode: 0x94, bytes: 2 },
  { mnemonic: "STY", mode: "absolute", opcode: 0x8c, bytes: 3 },

  // TAX (Transfer Accumulator to X)
  { mnemonic: "TAX", mode: "implied", opcode: 0xaa, bytes: 1 },

  // TAY (Transfer Accumulator to Y)
  { mnemonic: "TAY", mode: "implied", opcode: 0xa8, bytes: 1 },

  // TSX (Transfer Stack Pointer to X)
  { mnemonic: "TSX", mode: "implied", opcode: 0xba, bytes: 1 },

  // TXA (Transfer X to Accumulator)
  { mnemonic: "TXA", mode: "implied", opcode: 0x8a, bytes: 1 },

  // TXS (Transfer X to Stack Pointer)
  { mnemonic: "TXS", mode: "implied", opcode: 0x9a, bytes: 1 },

  // TYA (Transfer Y to Accumulator)
  { mnemonic: "TYA", mode: "implied", opcode: 0x98, bytes: 1 },
];

/**
 * Build a lookup table: mnemonic + mode -> opcode entry
 */
export function findOpcode(
  mnemonic: string,
  mode: string,
): OpcodeEntry | undefined {
  const upperMnemonic = mnemonic.toUpperCase();
  return OPCODES.find(
    (op) => op.mnemonic === upperMnemonic && op.mode === mode,
  );
}

/**
 * Get all opcodes for a given mnemonic (across addressing modes)
 */
export function getOpcodesByMnemonic(mnemonic: string): OpcodeEntry[] {
  const upperMnemonic = mnemonic.toUpperCase();
  return OPCODES.filter((op) => op.mnemonic === upperMnemonic);
}
