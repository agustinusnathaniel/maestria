# @maestria/agent-plugins

maestria ships one directly installable plugin with native host components and two reusable utility skills. Canonical methodology lives in `packages/core/agent-directives/`; generated resources and all five host manifest directories live at this package root. Git/local installations and npm archives expose the same resource paths.

## Component ownership

| Package folder | Contents | Canonical input |
| --- | --- | --- |
| `agents/` | One profile per specialist for every Markdown host, plus a generated Codex TOML beside each | Core `specialists/` and `generation/profiles.json` |
| `commands/` | Complete FEIN, SONAR, and BLITZ workflow entry points shared by every command-capable host | Core `commands/`, dispatcher, and policy |
| `rules/` | Global policy, plus one folder per host whose rule format differs | Core `rules.md` and integration notes |
| `skills/` | Only `handoff` and `iteration-limits` reusable utilities | One core `rules.md` section each |
| `integrations/` | Generated host usage and capability guides | Core integration notes |
| `generation/` | Development-only manifests and profile metadata | Hand-authored mechanical inputs |
| `assets/`, `docs/` | Presentation and package usage documentation | Hand-authored package files |

Roles, modes, dispatch, and policy are not published as root skills. Full native profiles include the role and policy required in an isolated child. Workflow commands carry their mode, router, policy, and argument contract without loading removed skills.

Each profile's frontmatter carries every Markdown host's keys at once, and each host reads only its own: `readonly` (Cursor), `disallowedTools: [Write, Edit]` (Claude Code, Kimi Code, ZCode), and `subagents: []` (Kimi). Profiles omit `model`, so hosts use the main conversation's model. Primary-session routing comes from each host's always-on rule, context, or companion installation, not from a dispatcher profile.

## Host mappings

Supports Claude Code, Cursor, Codex, Kimi Code, Devin, ZCode, OMP, and Hermes, plus portable utility clients. Follow the public [installation](https://maestria.sznm.dev/agent-plugins/installation/), [usage](https://maestria.sznm.dev/agent-plugins/usage/), and [compatibility](https://maestria.sznm.dev/agent-plugins/compatibility/) pages for per-host setup and support boundaries.

See [installation](INSTALL.md) and the [public guides](https://maestria.sznm.dev/agent-plugins/). OpenCode and Pi retain their native runtime packages. The standalone CLI lives in `apps/maestria-cli`; separately installable methodology skills remain under the repository's root `skills/`.

## Development and verification

Edit core methodology or `generation/` metadata, then run `scripts/sync-all` and `scripts/check-sync`. The consolidated compiler composes an explicitly owned output plan from canonical inputs and validates it before mutation. It is the single writer for this package's generated resources. Generic package sync validates every discovered configuration before any write. Cleanup retires only named generated outputs and preserves unrelated files.

Run `pnpm --filter @maestria/agent-plugins test` for archive, assembly, native context, and Kimi resource contracts. Packed evidence is written under ignored `artifacts/`. The [capability audit](https://github.com/agustinusnathaniel/maestria/blob/main/docs/agent-plugin-capabilities.md) records supported, selected, and unverified surfaces; [host verification](https://github.com/agustinusnathaniel/maestria/blob/main/docs/plugin-host-verification.md) records reproducible loader probes and their limits.

This package has no executable runtime adapter, hooks, scheduled automations, CLI executable, or MCP server. Some hosts support these components; they are intentionally omitted because this package supplies methodology and has no concrete executable integration requiring them.
