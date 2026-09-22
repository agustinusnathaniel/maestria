# ADR-OC-003: Keyword-Triggered Workflow Modes - Hybrid Hook + Prompt, Denylist Config

## Status

Accepted (2026-06-14)

## Current Status

The mode table below documents the historical OpenCode implementation. The current canonical contract is capability-aware: `blitz` uses direct execution for familiar, low-risk work when the host permits it, otherwise the permitted specialist; `fein` uses the full route with dynamic sequencing and required review floors. See `packages/core/agent-directives/commands/blitz.md` and `packages/core/agent-directives/commands/fein.md`.

> **Note (2026-09-22).** Mode prompt text is no longer defined as TypeScript strings: `packages/opencode/src/modes/prompts.ts` lazily loads each mode section from its command file (`fein.md`, `sonar.md`, `blitz.md`, generated projections of the canonical files named in Current Status above) via `@maestria/shared-mode`, with pure detection (word-boundary, priority, code-block exclusion, disabled-keyword handling, case-insensitivity) delegated to the same shared module. The "TypeScript Definition" prompt dumps and the "prompts live in TypeScript" consequence below are the historical record; the command files are the current home. Detection still runs in the `chat.message` hook with `disabledKeywords` (`packages/opencode/src/index.ts`).

## Context

The orchestrator's default pipeline handles most work well, but three usage patterns don't fit it: full-pipeline methodical work with reviewer approval before sign-off; research-only investigation producing structured output then stopping; and fast implementation that skips optional ceremony while preserving safety, authorization, branch, validation, and required-review floors.

Before this ADR, intent could only be expressed through ambiguous natural-language prompts ("take your time", "just explore", "ship it fast"), so research looked like a plan request and fast work triggered the full pipeline. A one-word, machine-detectable mechanism was needed to redirect the pipeline upfront.

## Decision

### Detect Three Keywords via `chat.message` Hook

| Mode | Keyword | Origin | Meaning | Pipeline Behavior |
| --- | --- | --- | --- | --- |
| Full pipeline | `fein` | German | Fine, precise, careful | Mandatory recon → design → build → review. Reviewer gate non-negotiable. |
| Research only | `sonar` | Space/tech | Scan depths, map terrain | Read-only `@adventurer` or `@planner` research → STOP. No builder calls or production-file writes. |
| Fast implementation | `blitz` | German | Lightning, fast | Builder direct. Skip optional recon/design ceremony; required review remains. |

### Detection Syntax

| Rule | Value |
| --- | --- |
| Position | Anywhere in the message |
| Detection mechanism | Word-boundary regex (`\bfein\b`, `\bsonar\b`, `\bblitz\b`) |
| Multiple keywords | Most restrictive keyword wins (fein > sonar > blitz) |
| Special characters / brackets / prefixes | None - plain words only |
| Code blocks | Keywords inside code fences and `inline` backtick spans are excluded |
| Stripped before orchestrator | Removed from message text |

Plain words over bracketed syntax: lower friction (`fein: map the auth module` reads naturally), learnable by context, no prefix collision (the keywords are not common programming terms), and most-restrictive-wins handles mid-message rephrasing.

### Mechanism: Hybrid Hook + Prompt

Detection lives in the hook; behavior lives in prompts plus orchestrator and global rules. No pipeline logic in TypeScript beyond detection.

| Layer               | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `chat.message` hook | Regex detection, keyword stripping, marker injection |
| Mode prompt strings | Static prompt snippets for fein/sonar/blitz          |
| Orchestrator rules  | Mode behavior definitions, pipeline overrides        |
| Global rules        | Awareness bullet: "mode keywords change pipeline"    |

The `chat.message` hook tests each message, resolves multiples to the most restrictive mode, strips the keyword, and prepends the `[MODE: fein]` (or `sonar`/`blitz`) marker plus that mode's summary prompt. The marker is **re-injected every turn**, so the orchestrator receives the mode instruction fresh each time and mode changes mid-task carry no stale state. Other adapters may persist mode state and must document a clear/reset path.

Mode is per-turn, not per-phase; conversation history tracks progress between turns. Adapters using session state must document its lifetime and expose a neutral reset such as `/mode-clear`. Each mode prompt fully describes its pipeline behavior without referencing the orchestrator's global CRITICAL RULES, so behavior changes require editing only the prompt strings at the cost of duplicating those rules.

### Config Model: Denylist Only

| Feature           | Value                                 |
| ----------------- | ------------------------------------- |
| Config shape      | `disabledKeywords: string[]`          |
| Default           | All modes enabled                     |
| Opt-out mechanism | User adds mode name to denylist       |
| Allowlist         | None - not supported                  |
| Default mode      | None - no fallback mode               |
| Per-agent config  | None - mode applies globally per turn |

```typescript
// Plugin options type
type PluginOptions = {
  modes?: {
    disabledKeywords?: Array<'fein' | 'sonar' | 'blitz'>;
  };
};

// Usage: opt out of blitz
MaestriaPlugin({ modes: { disabledKeywords: ['blitz'] } });
```

Denylist over allowlist (a new mode works out of the box), no default mode (the standard pipeline is the implicit fallback), no per-agent overrides (mode governs the orchestrator's pipeline, not agent behavior).

### ADR-Naming Compliance (ADR-CORE-002)

The keywords are functional descriptors, not mythological or thematic: **fein** (German for "fine, precise"), **sonar** (technology metaphor for scanning without action), **blitz** (German for "lightning"). Functional naming tells you what the agent does.

### What We Avoid

| Anti-pattern                | Why Not                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| Bracketed syntax (`[FEIN]`) | Noisy and mechanical; plain words read naturally.                 |
| Hashtag prefixes (`#fein`)  | No advantage over plain words.                                    |
| Case-sensitive matching     | `Fein`, `FEIN`, `fein` all trigger; lowercase is canonical.       |
| Leftmost-wins               | Most-restrictive-wins lets users self-correct mid-message.        |
| Persistent mode state       | OpenCode is per-turn; session-state adapters must document reset. |
| Phase tracking              | Over-engineered; history handles it.                              |
| Default / fallback mode     | Standard pipeline is the implicit default; keywords override.     |
| Allowlist configuration     | New modes should not break setups; denylist is forward-safe.      |
| Per-agent mode overrides    | Mode governs the orchestrator pipeline, not agents.               |

## Consequences

One-word machine-detectable intent in plain words, with per-turn detection (mid-task switching, no stale state), a minimal auditable hook, a one-array denylist, and ADR-CORE-002 compliant naming, all without disturbing existing orchestrator behavior. Costs: three more concepts to learn; plain-word false positives (e.g., "sonar" in a code snippet); no hybrid shortcut ("research + build" needs two turns); a trivial per-message processing step. (Historical note: prompts lived in TypeScript for hook injection at the cost of a package rebuild to edit; see the 2026-09-22 note above for the current file-loaded arrangement.)

## Lessons Learned

Plain words over brackets came from user-first reasoning; per-turn mode eliminates stale-state bugs (no session flag to reconcile across mid-session switches or compacted state); the hybrid split follows ADR-CORE-002 (minimal hooks) and ADR-OC-001 (policy in directives); mode prompts are orchestrator rules, not global rules, per ADR-CORE-001's cross-cutting-only filter; denylist config is forward-safe (a fourth mode reaches existing users automatically).

## Date

2026-06-14
