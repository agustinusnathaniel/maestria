import type { ModeKeyword } from "./types";

/**
 * Mode prompt text for each keyword.
 * These are injected into the turn when a mode is detected.
 *
 * @see ADR-008 (section "Mode Prompts")
 */
export const MODE_PROMPTS: Record<ModeKeyword, string> = {
  fein: [
    "## MODE: fein (Full Pipeline)",
    "",
    "Execute the complete fein pipeline: mandatory reconnaissance",
    "(@adventurer) → design/plan (@architect or @planner) →",
    "implementation (@builder) → review (@reviewer).",
    "Do NOT skip any phase unless the user explicitly overrides",
    "in the same turn.",
  ].join("\n"),

  sonar: [
    "## MODE: sonar (Research Only)",
    "",
    "Research mode: reconnaissance and design only. Delegate to",
    "@adventurer (recon) followed by @architect or @planner",
    "(analysis/design). STOP after delivering findings and design.",
    "Do NOT implement, write code, or create any production files.",
  ].join("\n"),

  blitz: [
    "## MODE: blitz (Fast Implementation)",
    "",
    "Speed mode: skip reconnaissance and design gates. Go directly",
    "to @builder for implementation. Only use @adventurer if the",
    "codebase context is genuinely unknown (not as a default step).",
    "Skip @reviewer unless the user explicitly requests review.",
  ].join("\n"),
};

/**
 * Marker strings for each mode keyword, used to signal the active mode.
 * Format: `[MODE: <keyword>]`
 */
export const MODE_MARKERS: Record<ModeKeyword, string> = {
  fein: "[MODE: fein]",
  sonar: "[MODE: sonar]",
  blitz: "[MODE: blitz]",
};

/**
 * Array of all valid mode keywords for runtime iteration.
 */
export const VALID_KEYWORDS: readonly ModeKeyword[] = ["fein", "sonar", "blitz"];
