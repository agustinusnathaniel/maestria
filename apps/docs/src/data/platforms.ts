/**
 * Shared platform registry - single source of truth for every Maestria
 * platform adapter across the homepage adapter grid, plugin overview pages
 * (see src/components/plugin/), and the footer.
 *
 * Blurbs are presentation copy; keep them in sync with the homepage card
 * language. `mark` keys into the shared glyph dict in src/data/marks.ts.
 * `installArgs` is the argument string for `npx maestria <installArgs>`;
 * an empty string means the platform has no canonical maestria CLI install
 * (e.g. ecosystem tooling, or platforms installed via their own tooling).
 */

export interface Platform {
  /** Registry id, e.g. 'opencode'. Also the SiblingPlatforms exclude key. */
  id: string;
  /** Display name shown on cards and chips. */
  name: string;
  /** Docs route for the platform overview page. */
  href: string;
  /** Card description (matches the homepage adapters grid). */
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
  /** Homepage-only: draws the accent tick on the top-left corner of the cell. */
  flagship?: boolean;
  /** Homepage-only: draws the dashed inset ring on the cell (auxiliary tooling). */
  auxiliary?: boolean;
}

/**
 * All nine entries in homepage grid order. Nine cells complete the 3-column
 * grid; `/ecosystem/` closes it with shared companion tooling.
 */
export const platforms: Platform[] = [
  {
    id: 'opencode',
    name: '@maestria/opencode',
    href: '/opencode/',
    blurb: '8 specialized agents with global rules injected into every session.',
    mark: 'opencode',
    installArgs: 'install opencode',
    flagship: true,
  },
  {
    id: 'claude-code',
    name: '@maestria/claude-code',
    href: '/claude-code/',
    blurb: 'Namespaced agents, skills, and workflow commands for Claude Code.',
    mark: 'claudeCode',
    installArgs: 'install claude-code',
  },
  {
    id: 'codex',
    name: '@maestria/codex',
    href: '/codex/',
    blurb: 'Specialist and workflow skills for Codex CLI.',
    mark: 'codex',
    installArgs: 'install codex',
  },
  {
    id: 'kimi-code',
    name: '@maestria/kimi-code',
    href: '/kimi-code/',
    blurb: '8 specialized skills with swarm-aware orchestration and no build step.',
    mark: 'kimiCode',
    installArgs: 'install kimi-code',
  },
  {
    id: 'cursor',
    name: '@maestria/cursor',
    href: '/cursor/',
    blurb: 'Specialist agents, orchestrator skill, and workflow commands for Cursor IDE and CLI.',
    mark: 'cursorMark',
    installArgs: 'install cursor',
  },
  {
    id: 'pi-omp',
    name: '@maestria/pi & @maestria/omp',
    href: '/pi-omp/',
    blurb: '7 specialist subagents with spec-driven orchestration for Pi and Oh My Pi.',
    mark: 'piOmp',
    // CLI positional arg is `pi` (see /cli/commands/), not `pi-omp`.
    installArgs: 'install pi',
  },
  {
    id: 'hermes',
    name: '@maestria/hermes',
    href: '/hermes/',
    blurb: 'Methodology layer for Hermes Agent: specialists, pipeline, and mode system.',
    mark: 'hermes',
    // Hermes installs via its own git-based plugin manager, not the maestria CLI.
    installArgs: '',
  },
  {
    id: 'prime-agent',
    name: '@maestria/prime-agent',
    href: '/prime-agent/',
    blurb: 'Skills-first Maestria for Prime Agent: specialists, orchestrator, and workflow modes.',
    mark: 'primeAgent',
    installArgs: 'install prime-agent',
  },
  {
    id: 'ecosystem',
    name: 'Shared ecosystem',
    href: '/ecosystem/',
    blurb: 'Optional companion tooling: CodeGraph indexing and RTK.',
    mark: 'ecosystem',
    installArgs: '',
    auxiliary: true,
  },
];
