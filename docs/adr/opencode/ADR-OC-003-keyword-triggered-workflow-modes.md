# ADR-OC-003: Keyword-Triggered Workflow Modes

## Status

Accepted (2026-06-14). Amended 2026-10-14: OpenCode detects modes during V2 prompt admission. Condensed 2026-11-27: mode behavior now follows the main loop ([CORE-035](../core/ADR-CORE-035-main-loop-with-one-reviewer.md)), and each mode's current text lives in `packages/core/agent-directives/commands/`.

## Context

Most work fits the default route, but three intents do not: careful work with full method and a required review, research that must stop before changing anything, and fast work that skips optional ceremony while keeping safety, authorization, and required review. Natural-language hints ("take your time", "just explore", "ship it fast") were ambiguous, so research looked like a plan request and fast work got full ceremony. Users needed a one-word, machine-detectable way to set the route up front.

## Decision

Three plain-word keywords select a mode for the turn:

| Mode | Meaning |
| --- | --- |
| `fein` | Full method: recon and design skills, implementation, required blind review. |
| `sonar` | Research only: investigate and answer, change no files, dispatch no subagents, then stop. |
| `blitz` | Direct work that skips optional recon and design; review only when required. |

Detection lives in code; behavior lives in prompts. The shared detector in `packages/shared/mode` matches whole words case-insensitively anywhere in the message, ignores matches inside fenced code and inline backticks, and picks the most restrictive mode when several appear (`fein` over `sonar` over `blitz`). An unclosed fence is not treated as code; that false positive is accepted. The adapter strips the keyword and prepends a `[MODE: <name>]` marker and the mode's prompt. Each mode prompt states its full behavior on its own, so changing a mode means editing one prompt.

On OpenCode the V2 `session.hook("prompt")` admission hook expands a bare keyword before the message is stored, so the marker travels with the message across continuations, queued delivery, and reloads with no per-session cache; each new prompt selects its own mode. Explicit slash commands submit the same template and skip a second expansion. The global rules and `.maestria/` files are appended by separate `context` and `compaction` hooks, because V2 reference registration does not load file content as instructions. Adapters that persist a mode in session state document its lifetime and expose a reset such as Pi's `/mode-clear`.

Configuration is a denylist only: `modes.disabledKeywords` turns modes off, every mode is on by default, and there is no default mode or per-agent override.

## Consequences

- One word sets intent, per turn, with no stale state between turns.
- The detection hook stays small and auditable.
- Users learn three terms; a keyword in ordinary prose can trigger a mode by accident; combining research and build takes two turns.

## Alternatives Considered

- **Bracketed or prefixed syntax (`[FEIN]`, `#fein`):** rejected as noisier with no detection benefit.
- **Leftmost keyword wins:** rejected because most-restrictive-wins lets users correct themselves mid-message.
- **Persistent mode state with phase tracking:** rejected for OpenCode because per-turn detection avoids stale state and history already shows progress.
- **An allowlist or default mode:** rejected because a denylist lets a new mode reach existing users, and the normal route is the implicit default.
- **Per-agent mode overrides:** rejected because a mode governs the session's route, not individual agents.

## Date

2026-06-14; amended 2026-10-14.
