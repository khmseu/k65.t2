import { notEqual } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { exit } from "node:process";
import { fileURLToPath } from "node:url";
import {
  createDtsFromParser,
  generateSyntaxDiagrams,
  parseAssemblyLine,
} from "./ma6-chevrotain.js";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: npx ts-node src/index.ts <filename>");
  process.exit(1);
}

const filename = args[0];
notEqual(filename, undefined, "Filename must be provided");
if (filename !== undefined) {
  generateSyntaxDiagrams(fileURLToPath(import.meta.url));
  createDtsFromParser();
  const content = readFileSync(filename, "utf-8");
  const lines = content.split("\n");

  console.log("[");
  let errs = 0;
  for (const line of lines) {
    const result = parseAssemblyLine(line);
    console.log(JSON.stringify({ line, result }, null, 2), ",");
    if (result.errs.length > 0) {
      errs++;
      if (errs > 10) {
        console.log('"eof errs"]');
        exit(1);
      }
    }
  }
  console.log('"eof OK"]');
}
