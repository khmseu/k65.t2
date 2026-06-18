/**
 * Config loader: load optional formatter configuration from JSON file.
 */

import * as fs from "fs";
import type { FormatterConfig, ColumnWidths } from "../formatter-types.js";
import { DEFAULT_FORMATTER_CONFIG } from "../formatter-types.js";

/**
 * Load formatter configuration from a JSON file.
 * Validates that widths are positive integers.
 *
 * @param configPath - Path to JSON config file
 * @returns FormatterConfig with loaded or default values
 * @throws Error if config file is invalid
 */
export function loadConfig(configPath?: string): FormatterConfig {
  if (!configPath) {
    return DEFAULT_FORMATTER_CONFIG;
  }

  let content: string;
  try {
    content = fs.readFileSync(configPath, "utf-8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to read config file "${configPath}": ${msg}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(
      `Failed to parse config file "${configPath}" as JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // Validate columnWidths if present
  if (parsed.columnWidths) {
    const widths = parsed.columnWidths as Partial<ColumnWidths>;
    for (const key of ["label", "operation", "arguments", "comment"] as const) {
      if (key in widths && widths[key] !== undefined) {
        const val = widths[key];
        if (typeof val !== "number" || val < 0 || !Number.isInteger(val)) {
          throw new Error(
            `Invalid column width for '${key}': must be a non-negative integer, got ${val}`,
          );
        }
      }
    }
  }

  // Merge with defaults
  const config: FormatterConfig = {
    ...DEFAULT_FORMATTER_CONFIG,
    ...parsed,
    columnWidths: {
      ...DEFAULT_FORMATTER_CONFIG.columnWidths,
      ...parsed.columnWidths,
    },
  };

  return config;
}
