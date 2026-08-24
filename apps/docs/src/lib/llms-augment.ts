/**
 * Post-build augmentation of the generated `llms.txt` with an explicit
 * "Agent instructions" section.
 *
 * Pure string functions: the inline integration in astro.config.mjs wires
 * `augmentLlmsTxt` into `astro:build:done`, reading and writing
 * `<dist>/llms.txt` after starlight-llms-txt has generated it.
 *
 * Idempotency is keyed on an HTML comment marker so re-runs (or repeated
 * builds over a cached file) never duplicate the section. Output follows the
 * llms.txt format: markdown, with the appended block as a `##` section.
 */

export const AGENT_INSTRUCTIONS_MARKER = '<!-- maestria:agent-instructions -->';

const SITE = 'https://maestria.sznm.dev';
const REPO = 'https://github.com/agustinusnathaniel/maestria';

/** The appended section as valid llms.txt markdown. */
export function agentInstructionsSection(): string {
  return [
    AGENT_INSTRUCTIONS_MARKER,
    '',
    '## Agent instructions',
    '',
    'Maestria is portable AI engineering praxis: installable plugins that wire a',
    'dispatcher-plus-specialist methodology (adventurer, architect, builder, diagnose,',
    'planner, reviewer, writer around a dispatch-only orchestrator) into coding agents.',
    '',
    'Use Maestria when you need to:',
    '',
    '- Install or wire structured agent-methodology plugins into a supported coding',
    '  platform: OpenCode, Kimi Code, Pi, Hermes, Claude Code, Codex CLI, Cursor,',
    '  prime-agent, or OMP.',
    '- Decide how to route a task: direct execution vs specialist dispatch vs the full',
    '  staged pipeline (thinker, worker, verifier).',
    '- Enforce maker/checker review: the builder never approves its own work; an',
    '  independent reviewer signs off.',
    '',
    'How to consume these docs:',
    '',
    `- [Complete documentation](${SITE}/llms-full.txt)`,
    `- [Condensed index](${SITE}/llms-small.txt)`,
    `- [Sitemap](${SITE}/sitemap-index.xml)`,
    `- [Source repository](${REPO})`,
    `- Per-page markdown twins exist at \`<page>.md\` (each page links its twin via`,
    '  `<link rel="alternate" type="text/markdown">`), e.g.',
    `  \`${SITE}/core/when-to-use.md\`.`,
    '- Install into a platform with `npx maestria install <platform>` (e.g.',
    '  `npx maestria install opencode`).',
    '',
  ].join('\n');
}

/**
 * Append the agent-instructions section to an llms.txt document.
 * Returns the input unchanged when the marker is already present, so calling
 * twice yields the exact same output.
 */
export function augmentLlmsTxt(original: string): string {
  if (original.includes(AGENT_INSTRUCTIONS_MARKER)) return original;
  const base = original.endsWith('\n') ? original : `${original}\n`;
  return `${base}\n${agentInstructionsSection()}`;
}
