/**
 * Shared platform registry - single source of truth for every installable
 * maestria package across the homepage adapter grid.
 *
 * Blurbs are presentation copy; keep them in sync with the homepage card
 * language. `mark` keys into the shared glyph dict in src/data/marks.ts.
 * `installArgs` is the argument string for `npx maestria <installArgs>`;
 * an empty string means the entry has no canonical maestria CLI install
 * (e.g. ecosystem tooling, or the multi-host package, which installs per host).
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
  /** Homepage-only: hosts served by a shared package, listed on the card. */
  hosts?: string[];
}

/**
 * All entries in homepage grid order. `/ecosystem/` closes the grid
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
    blurb: '7 specialist subagents with native workflow modes and session tracking for Pi.',
    href: '/pi/',
    id: 'pi',
    installArgs: 'install pi',
    mark: 'piOmp',
    name: '@maestria/pi',
  },
  {
    blurb:
      "One declarative package: seven specialists, three workflow modes, always-on policy, and two utilities, loaded through each host's own plugin system.",
    hosts: ['Claude Code', 'Codex', 'Cursor', 'Kimi Code', 'Devin', 'ZCode', 'OMP', 'Hermes'],
    href: '/agent-plugins/',
    id: 'agent-plugins',
    installArgs: '',
    mark: 'platforms',
    name: '@maestria/agent-plugins',
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
