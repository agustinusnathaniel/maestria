# ADR-OC-003: Keyword-Triggered Workflow Modes - Hybrid Hook + Prompt, Denylist Config

## Status

Accepted

## Current Status

The original mode table documents the historical OpenCode implementation. The current canonical contract is capability-aware: `blitz` uses direct execution for familiar, low-risk work when the host permits it, otherwise the permitted specialist; `fein` uses the full route with dynamic sequencing and required review floors. See `packages/core/agent-directives/commands/blitz.md` and `packages/core/agent-directives/commands/fein.md`.

## Context

The orchestrator's default pipeline (`adventurer → architect/planner → builder → reviewer`) handles most work well, but three usage patterns don't fit it:

1. **Full pipeline, every step** - methodical, verified work; no shortcuts; every new pattern needs an ADR; tests are non-negotiable; reviewer approval required before sign-off.
2. **Research only** - investigation and options, not implementation; run recon, synthesize findings, produce structured output, then stop.
3. **Fast implementation** - the user knows what they want and wants it done now; skip optional recon and design ceremony while preserving safety, authorization, branch, validation, and required-review floors.

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

Rationale for plain words over bracketed syntax:

- **Lower friction** - `fein: map the auth module` reads naturally; `[MODE: FOCUSED] ...` is noisy and mechanical.
- **Learnable by context** - `blitz: fix this bug` infers its pattern from `sonar: what does this code do`.
- **No prefix collision** - the keywords are not common programming terms; false positives are negligible.
- **Most-restrictive-wins** handles rephrasing mid-message: `we need sonar for this but actually blitz it`.

### Mechanism: Hybrid Hook + Prompt

The design separates detection (hook) from behavior (prompt + global rules), avoiding pipeline logic in TypeScript while keeping detection reliable.

| Layer               | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `chat.message` hook | Regex detection, keyword stripping, marker injection |
| Mode prompt strings | Static prompt snippets for fein/sonar/blitz          |
| Orchestrator rules  | Mode behavior definitions, pipeline overrides        |
| Global rules        | Awareness bullet: "mode keywords change pipeline"    |

#### Hook Behavior

The `chat.message` hook:

1. Tests the incoming message against `\bfein\b`, `\bsonar\b`, `\bblitz\b`
2. If multiple match, the most restrictive mode wins (fein > sonar > blitz)
3. Strips the keyword from the message
4. Prepends the `[MODE: fein]` (or `sonar`/`blitz`) marker plus that mode's summary prompt

For OpenCode, the marker is **re-injected every turn**: the hook fires on every user message, so the orchestrator receives the mode instruction fresh each time. This eliminates stale-state bugs (what happens if the mode changes mid-task). Other adapters may persist mode state and must document a clear/reset path.

#### No Phase Tracking

For OpenCode, the mode is per-turn, not per-phase; conversation history tracks progress between turns. Adapters that use session state must document its lifetime and expose a neutral reset such as `/mode-clear`.

### Mode Prompts (TypeScript Definition)

Prompts are defined as TypeScript strings and injected by the hook at the start of each turn:

#### fein prompt

```
## MODE: fein (Full Pipeline)

Execute the complete fein pipeline: mandatory reconnaissance
(@adventurer) → design/plan (@architect or @planner) →
implementation (@builder) → review (@reviewer).
Do NOT skip any phase unless the user explicitly overrides
in the same turn.
```

#### sonar prompt

```
## MODE: sonar (Research Only)

Research mode: reconnaissance and design only. Delegate to
@adventurer (recon) or @planner (read-only analysis). Add only a
second read-only @adventurer/@planner when a distinct output is needed.
STOP after delivering findings. Do NOT implement, write code, or create
any production files.
```

#### blitz prompt

```
## MODE: blitz (Fast Implementation)

Speed mode: skip optional reconnaissance and design ceremony. Go directly
to @builder for familiar low-risk implementation. Required validation and
review floors remain; never use blitz to bypass safety, authorization, or
branch requirements.
```

### Prompt Depth Gap

Each prompt fully describes its mode's pipeline behavior without referencing the orchestrator's global CRITICAL RULES, so behavior changes require editing only the prompt strings. The trade-off is duplication with those rules, but mode overrides arrive as complete briefs.

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

Rationale:

- **Denylist over allowlist** - modes are additive: a new mode works out of the box, and users exclude it by name.
- **No default mode** - the standard pipeline is the implicit fallback.
- **No per-agent overrides** - mode governs the orchestrator's pipeline, not agent behavior.

### ADR-Naming Compliance (ADR-CORE-002)

The keywords are functional descriptors, not mythological or thematic:

- **fein** - German for "fine, precise" - careful, methodical work
- **sonar** - technology metaphor - scanning and depth-finding without action
- **blitz** - German for "lightning" - speed and minimal ceremony

This follows ADR-CORE-002's principle: "functional naming tells you what the agent does."

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

- Positive: one-word intent that is unambiguous and machine-detectable
- Positive: plain words integrate naturally; no bracket syntax or special characters
- Positive: per-turn detection allows switching modes mid-task without stale state
- Positive: the hook is minimal and easy to audit
- Positive: denylist config is one array, with no mode resolution logic
- Positive: prompts live in TypeScript for hook injection - faster than file reads, at the cost of a package rebuild to edit
- Positive: ADR-CORE-002 compliant naming
- Positive: no default mode leaves existing orchestrator behavior undisturbed
- Positive: most-restrictive-wins lets users self-correct mid-message
- Negative: three more concepts for users to learn
- Negative: plain-word detection can false-positive (e.g., a code snippet containing "sonar")
- Negative: no hybrid shortcut (e.g., "research + build" needs two turns)
- Negative: the hook adds a trivial but measurable per-message processing step

## Lessons Learned

1. **Plain words over brackets came from user-first reasoning.** Bracketed syntax is machine-unambiguous but human-mechanical.
2. **Per-turn mode eliminates stale-state bugs.** A session-level flag would raise unanswerable questions about mid-session switches and compacted state; each message is evaluated fresh.
3. **The hybrid split follows ADR-CORE-002 and ADR-OC-001.** Minimal hooks from CORE-002; policy in directives from OC-001. Detection in the hook, behavior in the orchestrator rules.
4. **Mode prompts are orchestrator rules, not global rules.** Mode affects only the orchestrator's pipeline, per ADR-CORE-001's cross-cutting-only filter.
5. **Denylist is forward-safe.** A fourth mode reaches all existing users automatically; an allowlist would require explicit opt-in per mode.

## Date

2026-06-14
