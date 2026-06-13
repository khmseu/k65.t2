import { exit } from "node:process";
import { notEqual } from "node:assert/strict";
import { parse } from "./grammar/ma6.js";
import { readFileSync } from "node:fs";

function flatten(result: any): any {
  if (result === null || typeof result !== "object") {
    return result;
  }
  if (Array.isArray(result)) {
    return result.map(flatten);
  }
  const flattened: any = {};
  for (const key in result) {
    if (key === "kind" || key == "skip") continue; // Skip 'kind' and 'skip' properties
    const value = flatten(result[key]);
    if (value === null) {
      // Skip null values
    } else if (typeof value !== "object" || key === "args") {
      flattened[key] = value;
    } else {
      Object.assign(flattened, value);
    }
  }
  return flattened;
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: npx ts-node src/index.ts <filename>");
  process.exit(1);
}

const filename = args[0];
notEqual(filename, undefined, "Filename must be provided");
if (filename !== undefined) {
  const content = readFileSync(filename, "utf-8");
  const lines = content.split("\n");

  console.log("[");
  let errs = 0;
  for (const line of lines) {
    const result = parse(line);
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
