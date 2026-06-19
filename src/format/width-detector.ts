/**
 * Width detector: auto-detect column widths from formatted lines.
 */

import type { FormattedLine } from "../formatter-types.js";
import type { ColumnWidths } from "../formatter-types.js";

/**
 * Fraction of values that an auto-detected column width must cover. Using a
 * high percentile instead of the absolute maximum keeps a handful of unusually
 * long fields (e.g. a `.subttl` title or a deeply nested `.if` expression) from
 * ballooning a shared column and pushing every following comment off-screen.
 * The rare over-long fields simply overflow their column; the renderer still
 * guarantees a separating space after them, so nothing is lost.
 */
const COVERAGE_PERCENTILE = 0.99;

/**
 * Smallest width that covers at least `fraction` of the given lengths. With no
 * outliers this equals the maximum; with a long tail it trims to the bulk of
 * the data.
 */
function percentileWidth(lengths: number[], fraction: number): number {
  if (lengths.length === 0) {
    return 0;
  }
  const sorted = [...lengths].sort((a, b) => a - b);
  // Index of the value at or below which `fraction` of entries fall.
  const idx = Math.min(
    sorted.length - 1,
    Math.ceil(fraction * sorted.length) - 1,
  );
  return sorted[Math.max(0, idx)] ?? 0;
}

/**
 * Auto-detect column widths by scanning all formatted lines.
 *
 * Layout-affecting columns (label, operation, arguments) use a high-percentile
 * width so outliers do not inflate them; over-long fields overflow gracefully.
 * The trailing comment column is the last field and never pushes anything, so
 * it keeps the true maximum.
 *
 * @param lines - All formatted lines (including blanks)
 * @returns ColumnWidths with computed widths
 */
export function detectColumnWidths(lines: FormattedLine[]): ColumnWidths {
  const labelLengths: number[] = [];
  const opLengths: number[] = [];
  const argLengths: number[] = [];
  let maxComment = 0;

  for (const line of lines) {
    // Only fully-formatted code lines contribute to the column-alignment
    // widths. Blank, comment-only and verbatim (unparseable) lines have no
    // meaningful label/operation/argument fields.
    if (line.isBlank || line.isComment || line.raw !== undefined) {
      maxComment = Math.max(maxComment, line.comment.length);
      continue;
    }
    labelLengths.push(line.label.length);
    opLengths.push(line.operation.length);
    argLengths.push(line.arguments.length);
    maxComment = Math.max(maxComment, line.comment.length);
  }

  // Apply 1-space buffer before each layout-affecting column so adjacent
  // fields never abut.
  return {
    label: percentileWidth(labelLengths, COVERAGE_PERCENTILE) + 1,
    operation: percentileWidth(opLengths, COVERAGE_PERCENTILE) + 1,
    arguments: percentileWidth(argLengths, COVERAGE_PERCENTILE) + 1,
    comment: maxComment,
  };
}

