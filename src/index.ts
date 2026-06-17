import { assembleFile, printAssemblyResult } from "./assembler.js";
import { exit } from "node:process";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: npx ts-node src/index.ts <filename>");
  process.exit(1);
}

const filename = args[0];
if (!filename) {
  console.error("Filename must be provided");
  process.exit(1);
}

try {
  const result = assembleFile(filename);

  // Print summary and output
  console.log(printAssemblyResult(result));

  // Exit with error code if there are errors
  if (result.errors.length > 0) {
    exit(1);
  }
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`Fatal error: ${msg}`);
  exit(1);
}
