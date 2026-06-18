/**
 * Width detector: auto-detect column widths from formatted lines.
 */

import type { FormattedLine } from "../formatter-types.js";
import type { ColumnWidths } from "../formatter-types.js";

/**
 * Auto-detect column widths by scanning all formatted lines.
 * Returns the maximum width needed for each column, plus 1 space buffer
 * before the next column per user preference.
 *
 * @param lines - All formatted lines (including blanks)
 * @returns ColumnWidths with computed widths
 */
export function detectColumnWidths(lines: FormattedLine[]): ColumnWidths {
  let maxLabel = 0;
  let maxOp = 0;
  let maxArgs = 0;
  let maxComment = 0;

  for (const line of lines) {
    if (!line.isBlank) {
      maxLabel = Math.max(maxLabel, line.label.length);
      maxOp = Math.max(maxOp, line.operation.length);
      maxArgs = Math.max(maxArgs, line.arguments.length);
      maxComment = Math.max(maxComment, line.comment.length);
    }
  }

  // Apply 1-space buffer before each column (per user preference):
  // longest entry + 1 space before next column starts
  return {
    label: maxLabel + 1,
    operation: maxOp + 1,
    arguments: maxArgs + 1,
    comment: maxComment,
  };
}
