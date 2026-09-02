# Contributing to Maestria

## Start Here

```bash
# Prerequisites: Node 24.16+, pnpm 11.8+, Python 3.11+, ruff
vp install
vp check
```

Maestria uses [Vite+](https://viteplus.dev) for formatting, linting, type-checking, tests, and builds. Use the package-specific commands below when you need to narrow a check.

## Repository Map

```text
packages/core/agent-directives/  canonical agent prompts and rules
packages/<platform>/             platform projections and adapters
packages/shared/                 host-neutral shared code
apps/docs/                       Astro + Starlight documentation site
apps/maestria-cli/               CLI for managing integrations
docs/adr/                        architecture decisions
scripts/                         sync and CI helpers
AGENTS.md                        repository instructions for agents
PATTERNS.md                      methodology patterns
VISION.md                        project motivation and boundaries
```

The important ownership rule is:

| Content | Edit here | Do not edit |
| --- | --- | --- |
| Agent prompts, rules, and workflow modes | `packages/core/agent-directives/` | Generated plugin projections |
| Platform transforms and runtime adapters | The relevant `packages/<platform>/` source | Another platform's package |
| User-facing documentation | `apps/docs/` or the relevant package README | Generated agent files |
| Architecture decisions | `docs/adr/<area>/` | A duplicate explanation in a package README |

Package manifests, runtime code, package READMEs, and the docs site are hand-authored. Agent files and skills produced by the sync pipeline are generated.

## The Sync Pipeline

The sync pipeline keeps one canonical copy of every agent directive while adapting it to each host:

```text
packages/core/agent-directives/
    -> scripts/sync-all
packages/<platform>/ generated agents, skills, commands, and rules
```

Each platform's `sync.config.ts` declares its output path and the transformations needed for that host, such as tool names, frontmatter, and routing syntax. The pipeline also removes stale generated files.

Never edit a generated file. Edit the canonical source, then regenerate and verify:

```bash
scripts/sync-all
scripts/check-sync
```

Use a package-local sync command only when you are working on one projection:

```bash
cd packages/opencode
pnpm exec tsx ../core/scripts/sync.ts --diff
```

## Change an Agent Directive

1. Edit the matching file under `packages/core/agent-directives/`.
2. Keep the directive focused: short sections, one concern per section, and references instead of repeated rules.
3. Update the orchestrator's delegation table when adding a specialist.
4. Run `scripts/sync-all`, then `scripts/check-sync`.
5. Run the relevant package tests and the repository quality gates.

Agent prompts should describe the agent's behavior, not the history of the prompt. Put design rationale in an ADR. Remove a line when it no longer changes behavior, but keep constraints, evidence requirements, and escalation instructions that agents need to act correctly.

## Add a Platform Plugin

1. Create `packages/<name>/` with its manifest and package metadata.
2. Add `sync.config.ts` when the platform consumes generated directives.
3. Implement the native adapter when the platform needs runtime behavior. A declarative package may not need runtime source.
4. Add the platform's user-facing docs under `apps/docs/src/content/docs/<name>/`.
5. Add tests or validation for the platform's actual boundary.
6. Run `scripts/check-sync` and the full quality gates.

The root `scripts/sync-all` discovers package sync configs automatically. Do not register a platform by editing generated output or by copying another platform's runtime assumptions.

## Platform Development Reference

Use the package README for detailed setup. This table shows where changes normally belong:

| Package | Hand-authored integration | Generated output | Focused verification |
| --- | --- | --- | --- |
| `opencode` | `src/` runtime adapter | `agents/` | `pnpm --filter @maestria/opencode test` |
| `kimi-code` | `kimi.plugin.json` and transforms | `skills/` | `vp test` |
| `pi` | `src/extension.ts` and runtime modules | `agents/`, `skills/` | `pnpm --filter @maestria/pi test` and `validate` |
| `omp` | `src/extension.ts` and runtime modules | `agents/`, `skills/` | `pnpm --filter @maestria/omp test` and `validate` |
| `cursor` | `.cursor-plugin/` manifest and declarative files | `agents/`, `skills/`, `rules/`, `commands/` | `pnpm --filter @maestria/cursor test` |
| `hermes` | Python adapter, hooks, middleware, and commands | `src/maestria_hermes/skills/` | `ruff check src/` |
| `claude-code` | `.claude-plugin/` manifest | `agents/`, `skills/`, `commands/` | `pnpm --filter @maestria/claude-code test` and `claude plugin validate . --strict` |
| `codex` | `.codex-plugin/` manifest and native-agent metadata | `skills/` | `pnpm --filter @maestria/codex test` |
| `prime-agent` | manifest and verified extension subset | `skills/` | package validation and focused tests |
| `agent-plugin` | portable manifest and package metadata | `skills/` | package validation and focused tests |

When a platform's behavior differs from the core contract, document the boundary in its package README or an ADR. Do not hide a runtime limitation in generated prompt text.

## Tests and Quality Gates

Test observable contracts at the highest practical boundary. Prefer real lightweight boundaries or explicit fakes over mocks, and add regression tests only for durable contracts or meaningful failure modes.

Before a commit, run:

```bash
pnpm check
pnpm test
pnpm typecheck
pnpm build
```

For docs-only changes, also run:

```bash
pnpm --filter @maestria/docs test
pnpm --filter @maestria/docs build
git diff --check
```

If agent directives changed, `scripts/check-sync` is required. If a package has a narrower validation command, run that as well.

## Changesets and Pull Requests

Create a changeset for a user-facing change to a published package or a package awaiting its first release. Private packages such as `@maestria/core` and `@maestria/docs` do not require one.

For a pull request:

1. Branch from `main` with a descriptive name.
2. Keep generated files synchronized and update the relevant docs or ADR.
3. Explain the motivation, user-visible effect, and migration steps, if any.
4. List the validation commands that passed.

## Documentation Locations

| Need                               | Location                                |
| ---------------------------------- | --------------------------------------- |
| User-facing guides                 | `apps/docs/`                            |
| Architecture decisions             | `docs/adr/`                             |
| Testing conventions                | `docs/testing.md`                       |
| Completion checklist               | `docs/checklist.md`                     |
| Project-wide behavior and patterns | `AGENTS.md`, `PATTERNS.md`, `VISION.md` |

The docs sidebar is configured in `apps/docs/astro.config.mjs`. Add a sidebar group when adding a new platform section, then build the docs site to catch broken links.

## Contributor Recognition

This project uses [all-contributors](https://all-contributors.js.org/). After your pull request is merged, request recognition with:

```text
@all-contributors please add @<your-username>
```

Maintainers can update the generated list locally:

```bash
pnpm contributors:add <username> <contributionType>
pnpm contributors:generate
pnpm contributors:check
```
