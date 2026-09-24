/**
 * Shared platform registry - single source of truth for every Maestria
 * platform integration across the homepage directory, plugin overview pages
 * (see src/components/plugin/), and the footer.
 *
 * Blurbs are presentation copy; keep them in sync with the homepage directory
 * language. `mark` keys into the shared glyph dict in src/data/marks.ts.
 * `installArgs` is the argument string for `npx maestria <installArgs>`;
 * an empty string means the platform has no canonical maestria CLI install
 * (e.g. ecosystem tooling, or platforms installed via their own tooling).
 */

export interface Platform {
  /** Registry id, e.g. 'opencode'. */
  id: string;
  /** Display name shown on directory rows and chips. */
  name: string;
  /** Compact human label for navigation surfaces. */
  shortName?: string;
  /** Docs route for the platform overview page. */
  href: string;
  /** Directory description shown in the homepage platform registry. */
  blurb: string;
  /** Key into the shared marks dict (src/data/marks.ts). */
  mark: string;
  /** Optional mono badge rendered next to the name ('PROVISIONAL' for codex). */
  badge?: string;
  /**
   * Argument string for `npx maestria …` (e.g. 'install opencode').
   * Empty string = no canonical CLI install for this entry.
   */
  installArgs: string;
  /** Homepage-only: draws the accent tick on the top-left corner of the row. */
  flagship?: boolean;
  /** Homepage-only: marks companion tooling in the ecosystem group. */
  auxiliary?: boolean;
}

/**
 * All nine entries in registry order. `/ecosystem/` closes the directory with
 * shared companion tooling, separate from platform integrations.
 */
export const platforms: Platform[] = [
  {
    blurb: '8 specialized agents with global rules injected into every session.',
    flagship: true,
    href: '/opencode/',
    id: 'opencode',
    installArgs: 'install opencode',
    mark: 'opencode',
    name: '@maestria/opencode',
    shortName: 'OpenCode',
  },
  {
    blurb: 'Namespaced agents, skills, and workflow commands for Claude Code.',
    href: '/claude-code/',
    id: 'claude-code',
    installArgs: 'install claude-code',
    mark: 'claudeCode',
    name: '@maestria/claude-code',
    shortName: 'Claude Code',
  },
  {
    blurb: 'Specialist and workflow skills for Codex CLI.',
    href: '/codex/',
    id: 'codex',
    installArgs: 'install codex',
    mark: 'codex',
    name: '@maestria/codex',
    shortName: 'Codex',
  },
  {
    blurb: '8 specialized skills with swarm-aware orchestration and no build step.',
    href: '/kimi-code/',
    id: 'kimi-code',
    installArgs: 'install kimi-code',
    mark: 'kimiCode',
    name: '@maestria/kimi-code',
    shortName: 'Kimi Code',
  },
  {
    blurb: 'Specialist agents, orchestrator skill, and workflow commands for Cursor IDE and CLI.',
    href: '/cursor/',
    id: 'cursor',
    installArgs: 'install cursor',
    mark: 'cursorMark',
    name: '@maestria/cursor',
    shortName: 'Cursor',
  },
  {
    blurb: '7 specialist subagents with spec-driven orchestration for Pi and Oh My Pi.',
    href: '/pi-omp/',
    id: 'pi-omp',
    // CLI positional arg is `pi` (see /cli/commands/), not `pi-omp`.
    installArgs: 'install pi',
    mark: 'piOmp',
    name: '@maestria/pi & @maestria/omp',
    shortName: 'Pi + OMP',
  },
  {
    blurb: 'Methodology layer for Hermes Agent: specialists, pipeline, and mode system.',
    href: '/hermes/',
    id: 'hermes',
    // Hermes installs via its own git-based plugin manager, not the maestria CLI.
    installArgs: '',
    mark: 'hermes',
    name: '@maestria/hermes',
    shortName: 'Hermes',
  },
  {
    blurb: 'Skills-first Maestria for Prime Agent: specialists, orchestrator, and workflow modes.',
    href: '/prime-agent/',
    id: 'prime-agent',
    installArgs: 'install prime-agent',
    mark: 'primeAgent',
    name: '@maestria/prime-agent',
    shortName: 'Prime Agent',
  },
  {
    auxiliary: true,
    blurb: 'Optional companion tooling: CodeGraph indexing and RTK.',
    href: '/ecosystem/',
    id: 'ecosystem',
    installArgs: '',
    mark: 'ecosystem',
    name: 'Shared ecosystem',
    shortName: 'Shared ecosystem',
  },
];

/** Resolve a structural registry key without embedding presentation claims in the registry. */
export const findPlatform = (id: string): Platform | undefined =>
  platforms.find((platform) => platform.id === id);

/** Identify platform overview routes, excluding auxiliary ecosystem entries. */
export const isPlatformOverview = (id: string): boolean =>
  platforms.some((platform) => platform.id === id && platform.auxiliary !== true);

/** Return the canonical CLI install command when the registry has one. */
export const getPlatformInstallCommand = (platform: Platform): string | undefined =>
  platform.installArgs.trim() === '' ? undefined : `npx maestria ${platform.installArgs}`;
