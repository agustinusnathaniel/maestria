/**
 * Post-build augmentation of the generated `llms.txt` plus the dedicated
 * `agents.md` document.
 *
 * Pure string functions: the inline integration in astro.config.mjs wires
 * `augmentLlmsTxt` into `astro:build:done`, reading and writing
 * `<dist>/llms.txt` after starlight-llms-txt has generated it, and writes
 * `<dist>/agents.md` from `agentsMdDocument`.
 *
 * Idempotency is keyed on HTML comment markers so re-runs (or repeated builds
 * over a cached file) never duplicate a section. Output follows the llms.txt
 * format: markdown, with appended blocks as `##` sections. agents.md follows
 * the agents.md convention: a single standalone markdown document.
 */

export const AGENT_INSTRUCTIONS_MARKER = '<!-- maestria:agent-instructions -->';
export const DEVELOPER_RESOURCES_MARKER = '<!-- maestria:developer-resources -->';

const SITE = 'https://maestria.sznm.dev';
const REPO = 'https://github.com/agustinusnathaniel/maestria';
const NPM_PACKAGE = 'https://www.npmjs.com/package/maestria';

/** Shared prose: what Maestria is (single source for llms.txt and agents.md). */
function maestriaSummaryLines(): string[] {
  return [
    'Maestria is portable AI engineering praxis: installable plugins that wire a',
    'dispatcher-plus-specialist methodology (adventurer, architect, builder, diagnose,',
    'planner, reviewer, writer around a dispatch-only orchestrator) into coding agents.',
  ];
}

/** Shared bullets: when to reach for Maestria (single source for both surfaces). */
function whenToUseMaestriaLines(): string[] {
  return [
    'Use Maestria when you need to:',
    '',
    '- Install or wire structured agent-methodology plugins into a supported coding',
    '  platform: OpenCode, Kimi Code, Pi, Hermes, Claude Code, Codex CLI, Cursor,',
    '  prime-agent, or OMP.',
    '- Decide how to route a task: direct execution vs specialist dispatch vs the full',
    '  staged pipeline (thinker, worker, verifier).',
    '- Enforce maker/checker review: the builder never approves its own work; an',
    '  independent reviewer signs off.',
  ];
}

/** The Developer resources section as valid llms.txt markdown. */
export function developerResourcesSection(): string {
  return [
    DEVELOPER_RESOURCES_MARKER,
    '',
    '## Developer resources',
    '',
    `- [Maestria documentation home](${SITE}/)`,
    `- [When to Use Maestria guide](${SITE}/core/when-to-use/)`,
    `- [Maestria CLI getting started](${SITE}/cli/getting-started/) (install with`,
    '  `npx maestria install <platform>`)',
    `- [Complete Maestria documentation for agents](${SITE}/llms-full.txt)`,
    `- [Condensed Maestria index for agents](${SITE}/llms-small.txt)`,
    `- [Dedicated Maestria agent instructions](${SITE}/agents.md)`,
    `- [Maestria sitemap](${SITE}/sitemap-index.xml)`,
    `- [Maestria robots.txt](${SITE}/robots.txt)`,
    `- [Maestria on npm](${NPM_PACKAGE})`,
    `- [Maestria source repository](${REPO})`,
    `- [Maestria issue tracker](${REPO}/issues)`,
    '- Per-page markdown twins exist at `<page>.md`, e.g.',
    `  \`${SITE}/core/when-to-use.md\`.`,
    '',
  ].join('\n');
}

/** The appended Agent instructions section as valid llms.txt markdown. */
export function agentInstructionsSection(): string {
  return [
    AGENT_INSTRUCTIONS_MARKER,
    '',
    '## Agent instructions',
    '',
    ...maestriaSummaryLines(),
    '',
    ...whenToUseMaestriaLines(),
    '',
    'How to consume these docs:',
    '',
    `- [Complete documentation](${SITE}/llms-full.txt)`,
    `- [Condensed index](${SITE}/llms-small.txt)`,
    `- [Agent instructions](${SITE}/agents.md)`,
    `- [Sitemap](${SITE}/sitemap-index.xml)`,
    `- [Source repository](${REPO})`,
    '- Per-page markdown twins exist at `<page>.md` (each page links its twin via',
    '  `<link rel="alternate" type="text/markdown">`), e.g.',
    `  \`${SITE}/core/when-to-use.md\`.`,
    '- Install into a platform with `npx maestria install <platform>` (e.g.',
    '  `npx maestria install opencode`).',
    '',
  ].join('\n');
}

/**
 * The dedicated agents.md document: one markdown file giving coding agents
 * what Maestria is, when to use it, and how to call it. Composed from the
 * same shared prose blocks as the llms.txt sections so the two surfaces
 * cannot drift apart.
 */
export function agentsMdDocument(): string {
  return [
    '# Maestria agent instructions',
    '',
    ...maestriaSummaryLines(),
    '',
    '## When to use Maestria',
    '',
    ...whenToUseMaestriaLines(),
    '',
    '## How to call Maestria',
    '',
    'Install into a supported coding platform:',
    '',
    '```sh',
    'npx maestria install <platform>',
    '```',
    '',
    'For example: `npx maestria install opencode`.',
    '',
    'How to consume these docs:',
    '',
    `- Complete documentation: ${SITE}/llms-full.txt`,
    `- Condensed index: ${SITE}/llms-small.txt`,
    '- Per-page markdown twins at `<page>.md`, e.g.',
    `  ${SITE}/core/when-to-use.md.`,
    `- Sitemap: ${SITE}/sitemap-index.xml`,
    `- Documentation site: ${SITE}/`,
    `- Source repository: ${REPO}`,
    '',
  ].join('\n');
}

/**
 * Append the missing sections to an llms.txt document: Developer resources
 * first, then Agent instructions. Each append is keyed on its own marker, so
 * calling twice yields the exact same output, and an already-complete
 * document is returned unchanged.
 */
export function augmentLlmsTxt(original: string): string {
  const hasResources = original.includes(DEVELOPER_RESOURCES_MARKER);
  const hasInstructions = original.includes(AGENT_INSTRUCTIONS_MARKER);
  if (hasResources && hasInstructions) return original;

  let augmented = original;
  if (!hasResources) augmented = appendSection(augmented, developerResourcesSection());
  if (!hasInstructions) augmented = appendSection(augmented, agentInstructionsSection());
  return augmented;
}

/** Append one marker-led section as a new llms.txt block. */
function appendSection(documentText: string, section: string): string {
  const base = documentText.endsWith('\n') ? documentText : `${documentText}\n`;
  return `${base}\n${section}`;
}
