/**
 * Types for keyword-triggered workflow modes.
 *
 * @see ADR-008 for full design context.
 */

/**
 * The three workflow mode keywords.
 *
 * - `"fein"` — Full pipeline (recon → design → build → review)
 * - `"sonar"` — Research only (recon + design, stop before build)
 * - `"blitz"` — Fast implementation (builder direct, skip recon/design/review)
 */
export type ModeKeyword = "fein" | "sonar" | "blitz";

/**
 * Result returned when a mode keyword is detected in a message.
 */
export interface ModeResult {
  /** The resolved mode keyword (lowercase). */
  mode: ModeKeyword;
  /** The keyword string as matched in the original text. */
  keyword: string;
  /** The character index where the keyword starts in the original text. */
  index: number;
  /** The mode prompt text to inject. */
  prompt: string;
  /** The mode marker string like `[MODE: fein]`. */
  marker: string;
}

/**
 * Plugin-level options for @maestria/opencode.
 *
 * Extends the base plugin options with workflow mode configuration.
 */
export interface MaestriaPluginOptions {
  modes?: {
    /**
     * List of mode keywords to disable.
     * Disabled keywords will be ignored during detection.
     */
    disabledKeywords?: ModeKeyword[];
  };
}
