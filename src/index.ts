import { assembleFile, printAssemblyResult } from "./assembler.js";
import { formatListing, formatSymbolTable } from "./output-formatter.js";
import { writeFileSync } from "node:fs";
import { exit } from "node:process";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    "Usage: node dist/index.js <filename> [-o binary] [-l listing]",
  );
  process.exit(1);
}

// First non-flag argument is the source file; -o/-l override the binary and
// listing output paths (defaults derive from the source file's base name).
let filename: string | undefined;
let binaryPath: string | undefined;
let listingPath: string | undefined;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "-o") {
    binaryPath = args[++i];
  } else if (arg === "-l") {
    listingPath = args[++i];
  } else if (arg === "--") {
    continue;
  } else if (!filename) {
    filename = arg;
  }
}

if (!filename) {
  console.error("Filename must be provided");
  process.exit(1);
}

// Strip a single trailing extension to build default output names.
const base = filename.replace(/\.[^./]+$/, "");
binaryPath ??= `${base}.bin`;
listingPath ??= `${base}.lst`;

try {
  const result = assembleFile(filename);

  // Print summary and output
  console.log(printAssemblyResult(result));

  // Write the binary image to disk. Even with errors the image is the best
  // effort produced so far, but a failed assembly should not masquerade as a
  // valid object file, so the binary is only written when assembly succeeded.
  if (result.errors.length === 0) {
    const binary = Buffer.from(result.binary);
    writeFileSync(binaryPath, binary);
    console.log(`Wrote binary:  ${binaryPath} (${binary.length} bytes)`);
  } else {
    console.log(`Binary not written: ${result.errors.length} error(s)`);
  }

  // The listing (hex dump + symbol table) is always useful, so write it even
  // when there were errors so it can be inspected alongside the diagnostics.
  const listing =
    formatListing(
      result.listing,
      result.errors,
      result.warnings,
      result.listingEvents,
    ) +
    "\n\n" +
    formatSymbolTable(result.symbolTable);
  writeFileSync(listingPath, listing);
  console.log(`Wrote listing: ${listingPath}`);

  // Exit with error code if there are errors
  if (result.errors.length > 0) {
    exit(1);
  }
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`Fatal error: ${msg}`);
  exit(1);
}
