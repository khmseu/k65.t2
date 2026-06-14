import { createSyntaxDiagramsCode, generateCstDts } from "chevrotain";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ma6Parser } from "./Ma6Parser.js";
import { ma6Lexer } from "./ma6Lexer.js";

// ============================================================================
// PARSER FACTORY & PARSE FUNCTION
// ============================================================================

const parserInstance = new Ma6Parser();

export function createDtsFromParser() {
  const dts = generateCstDts(parserInstance.getGAstProductions());
  const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "./");
  writeFileSync(outPath + "/ma6-cst.d.ts", dts);
}

export function generateSyntaxDiagrams(path: string) {
  // extract the serialized grammar.
  const serializedGrammar = parserInstance.getSerializedGastProductions();

  // create the HTML Text
  const htmlText = createSyntaxDiagramsCode(serializedGrammar);

  // Write the HTML file to disk
  const outPath = resolve(dirname(path), "./");
  writeFileSync(outPath + "/generated_diagrams.html", htmlText);
}

export function parseAssemblyLine(input: string): {
  ast: any;
  errs: any[];
} {
  const lexResult = ma6Lexer.tokenize(input);
  parserInstance.input = lexResult.tokens;

  const ast = parserInstance.line();
  const errs = [...lexResult.errors, ...parserInstance.errors];

  return {
    ast,
    errs,
  };
}
