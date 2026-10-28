# ADR-OC-008: OpenCode Orchestrator as a Main Loop

## Status

Superseded (2026-10-28) by [ADR-CORE-035](../core/ADR-CORE-035-main-loop-with-one-reviewer.md), which folds every host. Confidence: medium.

## Context

On OpenCode the orchestrator was denied read, search, edit, and shell access, so every turn had to delegate, including a one-line typo fix. ADR-OC-001 had briefly granted read tools and reverted them because the orchestrator "worked around delegation"; that judgement measured whether delegation happened, not whether outcomes held.

A run-level eval (private harness: one model, OpenCode, ten tasks on a 152-file fixture with hidden checks, floors, and delivery grading) compared the host default, maestria at `main`, and a folded variant:

| Arm                       | Outcome | Delivery | Floor violations | Median tokens per run |
| ------------------------- | ------- | -------- | ---------------- | --------------------- |
| Host default, no maestria | 10/10   | 2/10     | 0                | about 31k             |
| maestria `main`           | 14/14   | 8/14     | 1                | about 320k            |
| Folded main loop          | 11/11   | 10/11    | 0                | about 110k            |

Outcome was saturated on these tasks, the samples are small, and only OpenCode with `deepseek-v4.1-flash` was measured.

## Decision

On OpenCode only, the orchestrator is a main loop. It has the writer tool set that `@builder` has, keeps its existing permission to ask the user questions and install skills, may dispatch only `@reviewer` (enforced by its `task` permissions), investigates, designs, and implements itself, and loads the `recon`, `architecture-plan`, and `diagnose` method skills when a task needs them. Meaningful changes still get one blind review, and floors, authorization stops, modes, and delivery rules are unchanged. Its directives come from OpenCode-only canonical sources under `packages/core/agent-directives/opencode/`; every other host keeps the shared orchestrator and modes.

The `@adventurer`, `@architect`, and `@builder` agents stay installed on every host, including OpenCode, so direct `@` mentions keep working.

## Consequences

- OpenCode turns cost roughly a third of the tokens and half the time, with no measured loss of outcome or delivery.
- The OpenCode orchestrator and mode texts are a second canonical copy of the shared ones; edits to delivery, review, or reporting rules must be made in both until the hosts converge.
- Pi still blocks main-session edits under a mode and delegates them, so folding Pi needs a runtime change, not only text.
- Read-only `sonar` on OpenCode relies on the instruction to change no files, not on a permission.
- The `blitz` and Runtime Authority fallback to "delegate to the permitted specialist" stays for hosts without direct work; on OpenCode direct work is always available, so it does not apply.

## Alternatives Considered

- **Fold every host.** Rejected for now: no host other than OpenCode was measured, and Pi's runtime block would leave the main session unable to edit or delegate under a mode.
- **Remove the three role agents everywhere.** Rejected for now: breaking for users who call them or set per-role models, and unsupported outside OpenCode.
- **Unlock OpenCode tools but keep the routing text.** Not measured; ADR-OC-001 recorded that variant working around delegation.

## Future Considerations

Revisit folding other hosts, or removing the role agents, when real OpenCode use shows no regressions and there is evidence about whether the roles are used elsewhere.

## Supersession

Supersedes in part [ADR-OC-001](ADR-OC-001-tool-permission-design.md): its section 5 orchestrator lockdown no longer applies on OpenCode. ADR-OC-001 keeps the rest of the OpenCode permission design.

## Date

2026-10-28
