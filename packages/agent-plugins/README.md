# @maestria/agent-plugins

maestria ships one directly installable plugin with native host components and four skills. Canonical methodology lives in `packages/core/agent-directives/`; generated resources and all five host manifest directories live at this package root. Git/local installations and npm archives expose the same resource paths.

## Component ownership

| Package folder | Contents | Canonical input |
| --- | --- | --- |
| `agents/` | One profile per specialist for every Markdown host, plus a generated Codex TOML beside each | Core `specialists/` and `generation/profiles.json` |
| `commands/` | Complete FEIN, SONAR, and BLITZ workflow entry points shared by every command-capable host | Core `commands/`, dispatcher, and policy |
| `rules/` | Global policy, plus one folder per host whose rule format differs | Core `rules.md` and integration notes |
| `skills/` | `handoff` and `iteration-limits` utilities, plus the bundled `create-pull-request` and `docs-update` methodology skills | One core `rules.md` section per utility; repository-root `skills/<name>/SKILL.md` for each bundled skill (`scripts/sync-bundled-skills.ts`) |
| `generation/` | Development-only profile metadata (`profiles.json`); not shipped | Hand-authored mechanical input |
| `assets/` | Logo shared by the host manifests | Hand-authored package file |

Roles, modes, dispatch, and policy are not published as root skills. Full native profiles include the role and policy required in an isolated child. Workflow commands carry their mode, router, policy, and argument contract without loading removed skills.

Each profile's frontmatter carries every Markdown host's keys at once, and each host reads only its own: `readonly` (Cursor), `disallowedTools: [Write, Edit]` (Claude Code, Kimi Code, ZCode), and `subagents: []` (Kimi). Profiles omit `model`, so hosts use the main conversation's model. Primary-session routing comes from each host's always-on rule, context, or companion installation, not from a dispatcher profile.

## Install

On a host with a managed flow, run `npx maestria install <host>` (`claude-code`, `cursor`, `codex`, `kimi-code`, `omp`, or `hermes`). In Claude Code 2.1.275 or later you can also install it from the maestria marketplace in one step:

```text
/plugin install maestria --marketplace agustinusnathaniel/maestria
```

## Host mappings

Supports Claude Code, Cursor, Codex, Kimi Code, Devin, ZCode, OMP, and Hermes, plus portable skill clients. Follow the public [installation](https://maestria.sznm.dev/agent-plugins/installation/), [usage](https://maestria.sznm.dev/agent-plugins/usage/), and [compatibility](https://maestria.sznm.dev/agent-plugins/compatibility/) pages for per-host setup and support boundaries.

See [installation](INSTALL.md) and the [public guides](https://maestria.sznm.dev/agent-plugins/). OpenCode and Pi retain their native runtime packages. The standalone CLI lives in `apps/maestria-cli`; the repository's root `skills/` holds the canonical methodology skills, which this package bundles and `skills.sh` serves to runtimes maestria does not package.

## Development and verification

Edit core methodology or `generation/` metadata, then run `scripts/sync-all` and `scripts/check-sync`. The consolidated compiler composes an explicitly owned output plan from canonical inputs and validates it before mutation. It is the single writer for this package's generated resources. Generic package sync validates every discovered configuration before any write. Cleanup retires only named generated outputs and preserves unrelated files.

Run `pnpm --filter @maestria/agent-plugins test` for archive, assembly, native context, and Kimi resource contracts. Packed evidence is written under ignored `artifacts/`. The [capability audit](https://github.com/agustinusnathaniel/maestria/blob/main/docs/agent-plugin-capabilities.md) records supported, selected, and unverified surfaces; [host verification](https://github.com/agustinusnathaniel/maestria/blob/main/docs/plugin-host-verification.md) records reproducible loader probes and their limits.

This package has no executable runtime adapter, hooks, scheduled automations, CLI executable, or MCP server. Some hosts support these components; they are intentionally omitted because this package supplies methodology and has no concrete executable integration requiring them.
