/**
 * Shared platform registry - single source of truth for every maestria
 * platform adapter across the homepage adapter grid and footer.
 *
 * Blurbs are presentation copy; keep them in sync with the homepage card
 * language. `mark` keys into the shared glyph dict in src/data/marks.ts.
 * `installArgs` is the argument string for `npx maestria <installArgs>`;
 * an empty string means the platform has no canonical maestria CLI install
 * (e.g. ecosystem tooling, or platforms installed via their own tooling).
 */

export interface Platform {
  /** Registry id, e.g. 'opencode'. */
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
 * All eight entries in homepage grid order. `/ecosystem/` closes the grid
 * with shared companion tooling.
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
  },
  {
    blurb: 'Namespaced agents, skills, and workflow commands for Claude Code.',
    href: '/claude-code/',
    id: 'claude-code',
    installArgs: 'install claude-code',
    mark: 'claudeCode',
    name: 'Maestria for Claude Code',
  },
  {
    blurb: 'Specialist and workflow skills for Codex CLI.',
    href: '/codex/',
    id: 'codex',
    installArgs: 'install codex',
    mark: 'codex',
    name: 'Maestria for Codex',
  },
  {
    blurb: '8 specialized skills with swarm-aware orchestration and no build step.',
    href: '/kimi-code/',
    id: 'kimi-code',
    installArgs: 'install kimi-code',
    mark: 'kimiCode',
    name: 'Maestria for Kimi Code',
  },
  {
    blurb: 'Specialist agents, orchestrator skill, and workflow commands for Cursor IDE and CLI.',
    href: '/cursor/',
    id: 'cursor',
    installArgs: 'install cursor',
    mark: 'cursorMark',
    name: 'Maestria for Cursor',
  },
  {
    blurb: '7 specialist subagents with spec-driven orchestration for Pi and Oh My Pi.',
    href: '/pi-omp/',
    id: 'pi-omp',
    // CLI positional arg is `pi` (see /cli/commands/), not `pi-omp`.
    installArgs: 'install pi',
    mark: 'piOmp',
    name: '@maestria/pi & @maestria/omp',
  },
  {
    blurb: 'Shared methodology skills through Hermes portable plugin support.',
    href: '/hermes/',
    id: 'hermes',
    installArgs: 'install hermes',
    mark: 'hermes',
    name: 'Maestria for Hermes',
  },
  {
    auxiliary: true,
    blurb: 'Optional companion tooling: CodeGraph indexing and RTK.',
    href: '/ecosystem/',
    id: 'ecosystem',
    installArgs: '',
    mark: 'ecosystem',
    name: 'Shared ecosystem',
  },
];
