# Hermes plugin: current reference

## Purpose

Describe the current `@maestria/hermes` implementation and its runtime boundaries. Use this page for active behavior; use the [historical design record](hermes-maestria-plugin.md) for earlier decisions, rejected approaches, and future ideas.

## Audience

Maintainers and contributors working on the Hermes adapter. End users should start with the [public Hermes documentation](https://maestria.sznm.dev/hermes/).

## Current surface

Verified against the repository snapshot on 2026-09-02. The active package version is `0.1.13`.

| Surface | Current behavior | Source of truth |
| --- | --- | --- |
| Skills | 12 skills: 9 methodology skills and 3 workflow-mode skills | `packages/hermes/src/maestria_hermes/skills/` |
| Commands | The manifest declares 6 commands; runtime registration adds `mode-clear`, for 7 commands total: `fein`, `sonar`, `blitz`, `mode`, `mode-clear`, `review`, `plan` | `packages/hermes/plugin.yaml`, `src/maestria_hermes/__init__.py` |
| Hooks | 10 lifecycle hooks for gateway dispatch, LLM/tool calls, sessions, subagents, and result transformation | `packages/hermes/plugin.yaml`, `src/maestria_hermes/hooks/` |
| Middleware | `llm_execution`, an opt-in mode-footer annotation | `packages/hermes/plugin.yaml`, `src/maestria_hermes/middleware/` |
| Tool | `opencode_route`, an optional OpenCode CLI delegator | `packages/hermes/plugin.yaml`, `src/maestria_hermes/tools/` |
| Distribution | Git-based Hermes plugin installation from this repository; the repository also contains Python package metadata for `maestria-hermes` | `packages/hermes/pyproject.toml`, public installation guide |

## Runtime behavior

- Hermes starts the plugin in `fein` mode unless the user changes it. `/sonar` is research-only. `/blitz` permits only its literal direct read/research/LLM allowlist; code changes stay on the trusted top-level `fein` path.
- Mode state is persisted in `$HERMES_HOME/maestria-mode.json`. It is global to that Hermes home, not isolated per session. `/mode-clear` returns the state to neutral.
- Native Hermes child roles are topology roles, not Maestria specialist identities. Delegated children receive a fixed read/research/LLM-only policy and cannot write, execute code, run a shell, delegate again, or invoke OpenCode.
- The seven specialist names describe routing intent. They do not grant child capabilities.
- Review and landing remain advisory because Hermes has no native review-state or landing gate.
- Startup probes for external tools are not part of the plugin. `opencode_route` fails clearly if OpenCode is unavailable rather than probing during startup.

## Canonical source and generated content

Shared methodology content is authored in `packages/core/agent-directives/` and projected into the Hermes skill tree through `packages/hermes/sync.config.ts`.

When changing shared methodology:

```bash
scripts/sync-all
scripts/check-sync
```

Do not edit generated skills in `src/maestria_hermes/skills/` directly. Hand-authored Hermes behavior lives in `src/maestria_hermes/`, including hooks, middleware, tools, commands, mode persistence, and session trust handling.

## Verification

Run the package tests and the docs build when changing the adapter or its public guidance:

```bash
pytest packages/hermes/
ruff check packages/hermes/src/
pnpm --filter @maestria/docs build
```

The package manifest and runtime registration tests must agree. When a host API claim changes, update the dated evidence in [runtime-support-matrix.md](runtime-support-matrix.md) and reverify the relevant public docs.

## Related documentation

- [Hermes installation](/hermes/getting-started/installation/)
- [Hermes commands](/hermes/commands/)
- [Hermes contributing guide](/hermes/contributing/)
- [Hermes runtime ADRs](adr/hermes/)
- [Historical Hermes design record](hermes-maestria-plugin.md)

## Dated evidence

- `[verified]` 2026-09-02: `packages/hermes/plugin.yaml` declares version `0.1.13`, 6 commands, 10 hooks, one middleware component, and one tool; runtime registration adds the `mode-clear` command.
- `[verified]` 2026-09-02: `packages/hermes/src/maestria_hermes/skills/` contains the generated methodology and workflow-mode skill directories.
- `[verified]` 2026-09-02: `packages/hermes/README.md` and the public installation guide document the git-based Hermes plugin path.

## Next step

Update this page when the active Hermes runtime contract changes. Keep historical plans and superseded designs in the archive document rather than extending this reference with another implementation era.
