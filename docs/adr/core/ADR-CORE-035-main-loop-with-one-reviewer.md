# ADR-CORE-035: One Main Loop With One Reviewer

## Status

Accepted (2026-10-28). Confidence: medium.

## Context

maestria shipped four role agents (`@adventurer`, `@architect`, `@builder`, `@reviewer`) on every host, and an orchestrator that routed work among them. On OpenCode the orchestrator could not edit, so every turn delegated. A run-level eval on OpenCode (`deepseek-v4.1-flash`, ten tasks on a 152-file fixture with hidden checks, floor checks, and delivery grading) compared the host default, maestria at `main`, and a main loop that did the work itself with one reviewer:

| Arm                         | Outcome | Delivery | Floor violations | Median tokens per run |
| --------------------------- | ------- | -------- | ---------------- | --------------------- |
| Host default, no maestria   | 10/10   | 2/10     | 0                | about 31k             |
| Role agents (`main`)        | 14/14   | 8/14     | 1                | about 320k            |
| Main loop with one reviewer | 11/11   | 10/11    | 0                | about 110k            |

Local usage on the maintainer's machine showed the same pattern outside the eval: across 140 Claude Code sessions, `builder`, `adventurer`, and `architect` were never dispatched; OpenCode's full-tool `build` agent dispatched a role in 10 of 395 sessions; on Codex `builder` appeared in about a dozen of 463 sessions. The heavy role use on OpenCode came from the orchestrator that could not edit.

The evidence is limited: one eval host and model, small samples, outcome saturated on these tasks, and usage from a single user.

## Decision

On every host, the main session is a main loop: it does recon, design, implementation, and delivery itself, loading the `recon`, `architecture-plan`, and `diagnose` method skills when a task needs them, and dispatches only `@reviewer` for an independent blind review of meaningful changes. `@adventurer`, `@architect`, and `@builder` are removed.

Content from the removed roles that applies to every change moves into always-on rules (`rules.md` Implementation Judgment), because skills are often not loaded; on-demand method moves into the `recon` and `architecture-plan` skills; handoff formats for the next agent are dropped.

Host enforcement follows: OpenCode's orchestrator gets the writer tool set and may dispatch only `reviewer`; Pi no longer blocks main-session edits under a mode and blocks mutation and dispatch only under `sonar`; native profiles on Claude Code, Cursor, Codex, Kimi, OMP, and Pi ship only the reviewer.

## Consequences

- Turns cost fewer tokens and less time because one session does the work instead of three to six.
- Every agent that writes or reviews code reads the implementation judgment on every turn, adding about 270 words to the always-on rules while removing the role files and their generated copies.
- Users who called the removed roles by name, or set per-role models, lose them; the CLI ignores stored settings for removed roles. This is a breaking change released as a 0.x minor.
- `sonar` remains read-only by permission on Pi and by instruction elsewhere.
- Hosts other than OpenCode were not measured with an eval; a regression there would show in use, not in a test.

## Alternatives Considered

- **Fold OpenCode only** (ADR-OC-008 as first written): matched the evidence exactly but kept a second canonical copy of the orchestrator and modes and three unused roles on other hosts.
- **Keep the roles installed but unused**: no breakage, but installs carry roles maestria never dispatches, and their text competes with the main loop.
- **Move the builder's judgment into an `implement` skill**: cheaper per turn, but evidence shows skills are often skipped, so it would usually be absent.

## Supersession

Supersedes [ADR-OC-008](../opencode/ADR-OC-008-orchestrator-main-loop.md), which folded OpenCode only.

## Date

2026-10-28
