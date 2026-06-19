/**
 * Type definitions for the assembly source formatter.
 */

/** Column width configuration for fixed-width formatting. */
export interface ColumnWidths {
  label: number;
  operation: number;
  arguments: number;
  comment: number;
}

/** A single formatted line with all fields separated. */
export interface FormattedLine {
  label: string;
  operation: string;
  arguments: string;
  comment: string;
  /** True only for truly empty lines (no code and no comment). */
  isBlank: boolean;
  /** True for comment-only lines (no code, comment present). */
  isComment: boolean;
  /**
   * Verbatim source for lines that could not be parsed. When set, the line is
   * rendered as-is to avoid silently dropping content.
   */
  raw?: string | undefined;
  originalLineNumber: number;
}

/** Formatter configuration (auto-detected or loaded from file). */
export interface FormatterConfig {
  columnWidths: ColumnWidths;
  collapseBlankLines: boolean;
  normalizeExpressions: boolean;
}

/** Defaults when auto-detecting or no config provided. */
export const DEFAULT_FORMATTER_CONFIG: FormatterConfig = {
  columnWidths: {
    label: 0, // Will be auto-detected
    operation: 0,
    arguments: 0,
    comment: 0,
  },
  collapseBlankLines: true,
  normalizeExpressions: true,
};
