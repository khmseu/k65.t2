import { notEqual } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { exit } from "node:process";
import { fileURLToPath } from "node:url";
import {
  createDtsFromParser,
  generateSyntaxDiagrams,
  parseAssemblyLine,
} from "./grammar/ma6-chevrotain.js";

const debug = false;
function flatten(result: any): any {
  if (Array.isArray(result)) return flattenArray(result);
  else return flattenObject(result);
}
function flattenObject(result: any): any {
  if (result === null || typeof result !== "object") {
    return result;
  }
  const flattened: any = {};
  for (const key in result) {
    if (key === "kind" || key == "skip") continue; // Skip 'kind' and 'skip' properties
    const value = flatten(result[key]);
    if (value === null) {
      // Skip null values
    } else if (Array.isArray(value)) {
      flattened[key] = flattenArray(value);
    } else if (typeof value !== "object" || key === "args") {
      flattened[key] = value;
      if (debug) console.log(`Set ${key} to ${JSON.stringify(value)}`);
    } else {
      Object.assign(flattened, value);
      if (debug) console.log(`Merged ${JSON.stringify(value)} into flattened`);
    }
    if ("0" in flattened)
      throw new Error(
        `0 in ${JSON.stringify({ key })}
\t=> ${JSON.stringify({ result: result[key] })}
\t-> ${JSON.stringify(value)}
\t${JSON.stringify({ result })}
\t${JSON.stringify({ flattened })}`,
      );
  }
  return flattened;
}
function flattenArray(result: any[]): any {
  return result.map(flatten);
}

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
    const flattened = flatten(result.ast);
    console.log(JSON.stringify({ line, result, flattened }, null, 2), ",");
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
