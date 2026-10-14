/**
 * Hosts the maestria CLI can install into, in homepage picker order. Ids match
 * the platform identifiers in /cli/commands/; `via` names the package or
 * mechanism the CLI uses for that host.
 */

export interface InstallTarget {
  id: string;
  name: string;
  via: string;
  href: string;
}

export const installTargets: InstallTarget[] = [
  {
    href: '/opencode/',
    id: 'opencode',
    name: 'OpenCode',
    via: '@maestria/opencode, a native plugin',
  },
  { href: '/pi/', id: 'pi', name: 'Pi', via: '@maestria/pi, a native extension' },
  {
    href: '/agent-plugins/installation/#claude-code',
    id: 'claude-code',
    name: 'Claude Code',
    via: '@maestria/agent-plugins, through a local marketplace',
  },
  {
    href: '/agent-plugins/installation/#codex-cli',
    id: 'codex',
    name: 'Codex',
    via: '@maestria/agent-plugins, through a local marketplace',
  },
  {
    href: '/agent-plugins/installation/#cursor',
    id: 'cursor',
    name: 'Cursor',
    via: '@maestria/agent-plugins',
  },
  {
    href: '/agent-plugins/installation/#kimi-code',
    id: 'kimi-code',
    name: 'Kimi Code',
    via: '@maestria/agent-plugins',
  },
  {
    href: '/agent-plugins/installation/#omp',
    id: 'omp',
    name: 'Oh My Pi',
    via: '@maestria/agent-plugins with native data resources',
  },
  {
    href: '/agent-plugins/installation/#hermes',
    id: 'hermes',
    name: 'Hermes',
    via: 'the Git-based Hermes plugin installer',
  },
];
