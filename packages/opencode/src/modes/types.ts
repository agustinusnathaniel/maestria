/**
 * Types for keyword-triggered workflow modes.
 *
 * @see ADR-008 for full design context.
 */

import { z } from "zod";

/**
 * Valid mode keywords.
 *
 * - `"fein"` -- Full pipeline (recon -> design -> build -> review)
 * - `"sonar"` -- Research only (recon + design, stop before build)
 * - `"blitz"` -- Fast implementation (builder direct, skip recon/design/review)
 */
export const modeKeywordSchema = z.enum(["fein", "sonar", "blitz"]);
export type ModeKeyword = z.infer<typeof modeKeywordSchema>;

/**
 * Plugin-level options for @maestria/opencode.
 */
export const maestriaOptionsSchema = z.object({
  modes: z
    .object({
      disabledKeywords: z.array(modeKeywordSchema).optional(),
    })
    .optional(),
});
export type MaestriaPluginOptions = z.infer<typeof maestriaOptionsSchema>;

/** Resolved config after validation */
export interface ResolvedMaestriaConfig {
  disabledKeywords: Set<ModeKeyword>;
}

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
