# ADR-008: Keyword-Triggered Workflow Modes — Hybrid Hook + Prompt, Denylist Config

## Status

Accepted

## Context

The orchestrator's default pipeline (`adventurer → architect/planner → builder → reviewer`) handles most work well, but users have three distinct usage patterns that don't fit the full pipeline:

1. **Full pipeline, every step** — the user wants methodical, verified work. No shortcuts. Every new pattern needs an ADR. Tests are non-negotiable. Reviewer approval required before sign-off.

2. **Research only** — the user wants investigation and options, not implementation. Run recon, synthesize findings, produce structured output — then stop. No builder delegations, no code changes.

3. **Fast implementation** — the user knows what they want and wants it done now. Skip recon, skip design, skip review. One-shot edits preferred. Tests optional.

Before this ADR, the only way to express intent was through the natural language prompt — "take your time", "just explore", "ship it fast". These are ambiguous or phrased inconsistently. A research request gets interpreted as needing a plan. A fast request triggers the full pipeline. Every mode was a guess.

We needed a mechanism that lets the user express their intent upfront — one word, unambiguous, machine-detectable — and redirects the orchestrator's pipeline accordingly.

## Decision

### Detect Three Keywords via `chat.message` Hook

| Mode                | Keyword | Origin     | Meaning                  | Pipeline Behavior                                                        |
| ------------------- | ------- | ---------- | ------------------------ | ------------------------------------------------------------------------ |
| Full pipeline       | `fein`  | German     | Fine, precise, careful   | Mandatory recon → design → build → review. Reviewer gate non-negotiable. |
| Research only       | `sonar` | Space/tech | Scan depths, map terrain | Recon + architect/planner → STOP. No builder calls.                      |
| Fast implementation | `blitz` | German     | Lightning, fast          | Builder direct. Skip recon/design/review. One-shot preferred.            |

### Detection Syntax

| Rule                                     | Value                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| Position                                 | Anywhere in the message                                                          |
| Detection mechanism                      | Word-boundary regex (`\bfein\b`, `\bsonar\b`, `\bblitz\b`)                       |
| Multiple keywords                        | Most restrictive keyword wins (fein > sonar > blitz)                             |
| Special characters / brackets / prefixes | None — plain words only                                                          |
| Code blocks                              | Keywords inside ```fences and`inline` backtick spans are excluded from detection |
| Stripped before orchestrator             | Removed from message text                                                        |

Rationale for plain words over bracketed syntax:

- **Lower friction** — `fein: map the auth module` reads naturally. `[MODE: FOCUSED] map the auth module` is noisy and mechanical.
- **Learnable by context** — a user who types `blitz: fix this bug` can infer the pattern from `sonar: what does this code do` without reading docs.
- **No prefix collision** — `fein`, `sonar`, `blitz` are not common programming terms. False positives are negligible.
- **Most-restrictive-wins** handles the case where a user rephrases mid-message: `we need sonar for this but actually blitz it`.

### Mechanism: Hybrid Hook + Prompt

The design separates detection (hook) from behavior (prompt + global rules). This avoids putting pipeline logic in TypeScript while keeping detection reliable.

| Layer               | File                     | Lines | What it does                                         |
| ------------------- | ------------------------ | ----- | ---------------------------------------------------- |
| `chat.message` hook | `src/modes/index.ts`     | ~30   | Regex detection, keyword stripping, marker injection |
| Mode prompt strings | `src/modes/prompts.ts`   | ~25   | Static prompt snippets for fein/sonar/blitz          |
| Orchestrator rules  | `agents/orchestrator.md` | ~60   | Mode behavior definitions, pipeline overrides        |
| Global rules        | `rules/AGENTS.md`        | 1     | Awareness bullet: "mode keywords change pipeline"    |

#### Hook Behavior

The `chat.message` hook:

1. Tests incoming message against `\bfein\b`, `\bsonar\b`, `\bblitz\b`
2. If multiple match, the most restrictive mode wins (fein > sonar > blitz)
3. Strips the keyword from the message
4. Prepends `[MODE: fein]` (or `sonar`/`blitz`) marker + the mode's summary prompt (~3-5 lines)

The mode marker is **re-injected every turn** — it is not stateful. The hook fires on every user message, so the orchestrator receives the mode instruction fresh each time. This eliminates stale-state bugs (what happens if the mode changes mid-task).

#### No Phase Tracking

The mode is per-turn, not per-phase. Conversation history (the existing message log) tracks progress between turns. No additional state machinery is needed. A user can switch from `sonar` to `blitz` between turns by changing the keyword.

### Mode Prompts (TypeScript Definition)

The following prompts are defined in `src/modes/prompts.ts` and injected by the hook at the start of each turn:

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
@adventurer (recon) followed by @architect or @planner
(analysis/design). STOP after delivering findings and design.
Do NOT implement, write code, or create any production files.
```

#### blitz prompt

```
## MODE: blitz (Fast Implementation)

Speed mode: skip reconnaissance and design gates. Go directly
to @builder for implementation. Only use @adventurer if the
codebase context is genuinely unknown (not as a default step).
Skip @reviewer unless the user explicitly requests review.
```

### Prompt Depth Gap

The mode prompts above are self-contained — each prompt fully describes the pipeline behavior for that mode without referencing back to the orchestrator's global CRITICAL RULES. This makes the prompts independently maintainable: changes to mode behavior only require editing the prompt text in one place (`src/modes/prompts.ts`), without coupling to orchestrator.md changes. The trade-off is some duplication between mode prompts and the orchestrator's rules, but the independence is worth it — mode overrides are injected as complete briefs that don't assume knowledge of the orchestrator's full rule set.

### Config Model: Denylist Only

| Feature           | Value                                 |
| ----------------- | ------------------------------------- |
| Config shape      | `disabledKeywords: string[]`          |
| Default           | All modes enabled                     |
| Opt-out mechanism | User adds mode name to denylist       |
| Allowlist         | None — not supported                  |
| Default mode      | None — no fallback mode               |
| Per-agent config  | None — mode applies globally per turn |

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

- **Denylist over allowlist** because modes are opt-in additive features. Adding a new mode in the future should work out of the box; existing users who want to exclude it add it to their denylist.
- **No default mode** because the orchestrator's existing behavior (standard pipeline) is the fallback. A mode keyword is an override, not a requirement.
- **No per-agent overrides** because mode is about the orchestrator's pipeline, not individual agent behavior. A blitz'd builder still builds; a sonar'd architect still designs.

### ADR-Naming Compliance (ADR-002)

The three keywords are functional descriptors, not mythological/thematic:

- **fein** — German for "fine, precise" — communicates careful, methodical work
- **sonar** — technology metaphor — communicates scanning/depth-finding without action
- **blitz** — German for "lightning" — communicates speed and minimal ceremony

This follows ADR-002's principle: "functional naming tells you what the agent does." Each keyword tells you the pipeline shape.

### What We Avoid

| Anti-pattern                       | Why Not                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------- |
| Bracketed syntax (`[FEIN]`)        | Noisy, mechanical feel. Plain words read naturally in context.            |
| Hashtag prefixes (`#fein`)         | No advantage over plain words; adds a character with no semantic benefit. |
| Case-sensitive matching            | `Fein`, `FEIN`, `fein` all trigger the same mode. Lowercase is canonical. |
| Leftmost-wins on multiple keywords | Most-restrictive-wins lets users correct themselves mid-message.          |
| Persistent mode state              | Per-turn only. Mode is re-detected each message; no session-level state.  |
| Phase tracking                     | Over-engineered for a per-turn feature. Conversation history handles it.  |
| Default / fallback mode            | Standard pipeline is the implicit default. Mode keywords are overrides.   |
| Allowlist configuration            | Adding modes should not break existing setups; denylist is forward-safe.  |
| Per-agent mode overrides           | Mode is about orchestrator pipeline, not individual agent behavior.       |

## Consequences

- Positive: Users express intent with one word — unambiguous and machine-detectable
- Positive: Plain words integrate naturally into sentences — no bracket syntax or special characters
- Positive: Per-turn detection means modes can switch mid-task without stale state
- Positive: Hook is minimal (~30 lines TS) — easy to audit and maintain
- Positive: Denylist config is simple — one array, no mode resolution logic
- Positive: Prompts live in TypeScript (`src/modes/prompts.ts`) for hook-injection purposes — faster than file reads and co-located with detection code, at the cost of requiring a package rebuild to edit
- Positive: ADR-002 compliant — functional naming (fein/sonar/blitz), not mythological
- Positive: No default mode changes — existing orchestrator behavior is undisturbed
- Positive: Most-restrictive-wins lets users correct themselves mid-message
- Negative: Three more imported concepts for users to learn (fein, sonar, blitz)
- Negative: Plain-word detection can false-positive in rare cases (e.g., a code snippet containing "sonar")
- Negative: No shortcut for hybrid modes (e.g., "research + build" — must use two turns)
- Negative: Hook adds a processing step before every message — trivial cost but measurable in latency

## Lessons Learned

1. **Plain words over brackets came from user-first reasoning.** Bracketed syntax (`[MODE: FEIN]`) is unambiguous for machines but feels mechanical to humans. Plain words read naturally — `fein: trace this dependency` reads like a sentence, not a config file. The most-restrictive-wins rule handles the edge case where a user types `we need sonar for this but actually blitz it`.

2. **Per-turn mode eliminates stale-state bugs.** The initial design considered a session-level mode flag. But what happens when a user switches from `sonar` to `blitz` mid-session? Or when a compacted session restores a stale mode? Per-turn detection avoids all of these — each message is evaluated fresh.

3. **The hybrid hook + prompt split was learned from ADR-002 and ADR-006.** ADR-002 established that plugin hooks should be minimal. ADR-006 established that policy belongs in directives, not in code. The mode mechanism follows both: detection logic is in the hook (~30 lines), but pipeline behavior is in orchestrator.md (~60 lines). Neither layer does the other's job.

4. **Mode prompts are orchestrator rules, not global rules.** An early draft put mode behavior in `rules/AGENTS.md`. But mode only affects the orchestrator's pipeline decisions — subagents don't change behavior based on mode. The orchestrator already mediates between user and specialist; mode override is a natural extension of that role. ADR-001's filter (global rules are for cross-cutting techniques only) confirms this: mode behavior is orchestrator-specific.

5. **Denylist is forward-safe.** If a fourth mode is added in the future, all existing users get it automatically. An allowlist would require an explicit opt-in for each new mode. Denylist matches the principle that modes are additive features.

## Date

2026-06-14
