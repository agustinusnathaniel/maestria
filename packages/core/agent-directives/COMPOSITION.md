# Directive Composition

How the canonical directives combine into what each host loads. The generators are the source of truth: `scripts/sync-consolidated-plugin.ts` for `@maestria/agent-plugins`, `packages/opencode/sync.config.ts` and `packages/pi/sync.config.ts` for the native adapters, and `scripts/sync-bundled-skills.ts` for the method skills. Check this file against them when either changes.

## One Main Loop and One Reviewer

The main session is the main loop (`specialists/main-loop.md`): it does recon, design, diagnosis, implementation, and delivery itself, loading the method skills its Routing skill map names (`recon`, `architecture-plan`, `diagnose`, `implement`, `docs-update`, `create-pull-request`, and `review-loop`) when a task needs them. [ADR-CORE-036](../../../docs/adr/core/ADR-CORE-036-always-on-core-and-skill-map.md) records which rules stay always-on and which move to skills. Its only split into another context is one blind `@reviewer` pass (`specialists/reviewer.md`) for meaningful changes. The modes (`commands/fein.md`, `sonar.md`, `blitz.md`) adjust that loop per turn. [ADR-CORE-035](../../../docs/adr/core/ADR-CORE-035-main-loop-with-one-reviewer.md) records the decision.

The reviewer is the checker of the maker/checker split: it receives the requirements, acceptance criteria, and diff, never the main loop's assessment of them. Hosts enforce its read-only role to different degrees (a tool filter, not a sandbox, on most), and the directives say only what each host actually enforces.

## Rules Parts per Artifact

`rules.md` has four `# ` parts: `Every Agent`, `Implementation and Review`, `Writing Changes`, and `Main Session`. Paths below are in `@maestria/agent-plugins`.

| Artifact | Composed from |
| --- | --- |
| Main-session policy (`rules/global.md`, `rules/cursor/maestria-global.mdc`) | `main-loop.md` and all four parts, plus that host's note |
| Complete session context (`AGENTS.md`, `kimi.system-prompt.md`) | Main-session policy plus the three mode bodies and host notes |
| Mode commands (`commands/<mode>.md`) | The mode body, main-session policy, and `integrations/command-arguments.md` |
| Reviewer profile (`agents/reviewer.md`, `agents/maestria-reviewer.toml`) | `reviewer.md` with `Every Agent`, `Implementation and Review`, and the `implement` skill body; the TOML adds the Codex note |
| Method skills, `handoff` and `review-loop` included | Copied unchanged from `skills/` into `@maestria/agent-plugins`, `@maestria/opencode`, and `@maestria/pi` |

## Session Context per Host

- **Devin** loads the root `AGENTS.md` always-on; `rules/global.md` sets `trigger: manual` so Devin does not load it a second time.
- **Codex** gets the root `AGENTS.md` as a marked block that `maestria install codex` writes into Codex's active global `AGENTS.md`, and the reviewer as `agents/maestria-reviewer.toml`.
- **Hermes** gets the same `AGENTS.md` only when the user adds it through a host context setting; installing the package supplies the skills alone.
- **Kimi Code** reads `kimi.system-prompt.md` through `systemPromptPath`. It carries only the Kimi host note so it stays under Kimi's 32 KB limit, which the generator enforces.
- **Cursor** applies `rules/cursor/maestria-global.mdc` (`alwaysApply`).
- **OMP** applies `rules/global.md` as its always-apply root rule.
- **Claude Code and ZCode** have no plugin session-context component; the main-session policy arrives through the mode commands, and the reviewer profile and skills load natively.
- **OpenCode** registers the `maestria` agent from `main-loop.md` and injects all of `rules.md` into every agent's system context on each turn and at compaction, the reviewer included; the reviewer agent file also appends the `implement` skill body. Agents that maestria does not define also get the main loop's `Modes` and `Continuation and Delivery` sections.
- **Pi** ships the main loop and all of `rules.md` as the `maestria` and `global-rules` skills, which Pi injects into every session, and adds the active mode's prompt, when one is set, on each turn. The reviewer agent runs with `inherit_context: true` and appends the `implement` skill body.

## Canonical Sync

Edit only `packages/core/agent-directives/`, run `scripts/sync-all` to regenerate every projection, and run `scripts/check-sync` before handoff.
