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

| Rule                                     | Value                                                      |
| ---------------------------------------- | ---------------------------------------------------------- |
| Position                                 | Anywhere in the message                                    |
| Detection mechanism                      | Word-boundary regex (`\bfein\b`, `\bsonar\b`, `\bblitz\b`) |
| Multiple keywords                        | Rightmost keyword wins                                     |
| Special characters / brackets / prefixes | None — plain words only                                    |
| Stripped before orchestrator             | Removed from message text                                  |

Rationale for plain words over bracketed syntax:

- **Lower friction** — `fein: map the auth module` reads naturally. `[MODE: FOCUSED] map the auth module` is noisy and mechanical.
- **Learnable by context** — a user who types `blitz: fix this bug` can infer the pattern from `sonar: what does this code do` without reading docs.
- **No prefix collision** — `fein`, `sonar`, `blitz` are not common programming terms. False positives are negligible.
- **Rightmost-wins** handles the case where a user rephrases mid-message: `we need sonar for this but actually blitz it`.

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
2. If multiple match, keeps the rightmost
3. Strips the keyword from the message
4. Prepends `[MODE: fein]` (or `sonar`/`blitz`) marker + the mode's summary prompt (~3-5 lines)

The mode marker is **re-injected every turn** — it is not stateful. The hook fires on every user message, so the orchestrator receives the mode instruction fresh each time. This eliminates stale-state bugs (what happens if the mode changes mid-task).

#### No Phase Tracking

The mode is per-turn, not per-phase. Conversation history (the existing message log) tracks progress between turns. No additional state machinery is needed. A user can switch from `sonar` to `blitz` between turns by changing the keyword.

### Mode Prompts (Orchestrator Addition)

The following text is added to `agents/orchestrator.md` as a new `## Mode Override` section:

#### fein mode (~25 lines)

```
## Mode Override: fein

A [MODE: fein] marker was injected into this turn. Follow these rules:

**Pipeline is mandatory:** @adventurer (recon) → @architect or @planner
(design) → @builder (implement) → @reviewer (validate). Every step must
complete before reporting done. Do not skip any step.

**Reviewer gate is non-negotiable.** @reviewer must approve before you
report the task as complete. If the reviewer identifies issues, route
them back to @builder.

**Tests must pass.** Before @reviewer validation, delegate `vp test` to
@builder and confirm all tests pass. If tests fail, route back to
@builder for fixes.

**ADRs required for new patterns.** If the work introduces a new
architectural pattern, dependency, or design approach, delegate to
@architect for an ADR as part of the design phase.

**Max 3 rounds per phase.** If a phase exceeds 3 task() delegations
without completing, escalate via question().
```

#### sonar mode (~20 lines)

```
## Mode Override: sonar

A [MODE: sonar] marker was injected into this turn. Follow these rules:

**Research only — no implementation.** Pipeline: @adventurer (recon) →
@architect or @planner (synthesis) → STOP. Do NOT delegate to @builder
under any circumstance. No code changes, no file writes.

**Output a structured summary covering:**
1. What was investigated
2. Key findings and data points
3. Options identified (with pros/cons per option)
4. Recommended next steps (but do NOT execute them)

**Load architecture-decision-records and codebase-design skills**
before delegating to @architect — the research phase benefits from
structured decision vocabulary.

**If the user follows up with implementation intent**, acknowledge the
research findings and wait for a new mode keyword. Do not assume the
research phase authorizes building.
```

#### blitz mode (~15 lines)

```
## Mode Override: blitz

A [MODE: blitz] marker was injected into this turn. Follow these rules:

**Builder direct.** Delegate to @builder immediately. No recon
(@adventurer), no design (@architect or @planner), no review
(@reviewer) unless explicitly requested.

**One-shot preferred.** Request a single, complete implementation rather
than iterative refinement. If the change has edge cases, handle them
in the first delegation — don't save them for a second pass.

**Tests optional.** Skip testing unless the user explicitly asks for it.
Token efficiency is the priority.

**No ADRs.** Do not suggest or delegate ADR creation.

**Token efficiency prioritized.** Minimize delegation overhead. Avoid
parallel fan-out unless the sub-tasks are clearly independent and
combining them would lose context.
```

### Prompt Depth Gap

The mode prompts above reference several granular behavioral rules — e.g., "ADRs required for new patterns", "Max 3 rounds per phase", "Load architecture-decision-records and codebase-design skills" — that are also covered by the orchestrator's existing CRITICAL RULES. This overlap is intentional: the mode prompts reference the most relevant rules from the orchestrator's global rule set so a mode override is self-contained. The prompts do not re-implement those rules; they reference them. If a rule changes in the orchestrator's CRITICAL RULES, it does not need to be edited in the mode prompts — the prompts serve as hints, not authoritative definitions.

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
    disabledKeywords?: Array<"fein" | "sonar" | "blitz">;
  };
};

// Usage: opt out of blitz
MaestriaPlugin({ modes: { disabledKeywords: ["blitz"] } });
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
| Leftmost-wins on multiple keywords | Rightmost-wins lets users correct themselves mid-message.                 |
| Persistent mode state              | Per-turn only. Mode is re-detected each message; no session-level state.  |
| Phase tracking                     | Over-engineered for a per-turn feature. Conversation history handles it.  |
| Default / fallback mode            | Standard pipeline is the implicit default. Mode keywords are overrides.   |
| Allowlist configuration            | Adding modes should not break existing setups; denylist is forward-safe.  |
| Per-agent mode overrides           | Mode is about orchestrator pipeline, not individual agent behavior.       |
| Plugin option for mode prompts     | Prompts are text, not code. They belong in markdown, not TypeScript.      |

## Consequences

- Positive: Users express intent with one word — unambiguous and machine-detectable
- Positive: Plain words integrate naturally into sentences — no bracket syntax or special characters
- Positive: Per-turn detection means modes can switch mid-task without stale state
- Positive: Hook is minimal (~30 lines TS) — easy to audit and maintain
- Positive: Denylist config is simple — one array, no mode resolution logic
- Positive: Prompts live in orchestrator.md, not in TypeScript — editable without rebuilding the package
- Positive: ADR-002 compliant — functional naming (fein/sonar/blitz), not mythological
- Positive: No default mode changes — existing orchestrator behavior is undisturbed
- Positive: Rightmost-wins lets users correct themselves mid-message
- Negative: Three more imported concepts for users to learn (fein, sonar, blitz)
- Negative: Plain-word detection can false-positive in rare cases (e.g., a code snippet containing "sonar")
- Negative: No shortcut for hybrid modes (e.g., "research + build" — must use two turns)
- Negative: Hook adds a processing step before every message — trivial cost but measurable in latency

## Lessons Learned

1. **Plain words over brackets came from user-first reasoning.** Bracketed syntax (`[MODE: FEIN]`) is unambiguous for machines but feels mechanical to humans. Plain words read naturally — `fein: trace this dependency` reads like a sentence, not a config file. The rightmost-wins rule handles the edge case where a user types `we need sonar for this but actually blitz it`.

2. **Per-turn mode eliminates stale-state bugs.** The initial design considered a session-level mode flag. But what happens when a user switches from `sonar` to `blitz` mid-session? Or when a compacted session restores a stale mode? Per-turn detection avoids all of these — each message is evaluated fresh.

3. **The hybrid hook + prompt split was learned from ADR-002 and ADR-006.** ADR-002 established that plugin hooks should be minimal. ADR-006 established that policy belongs in directives, not in code. The mode mechanism follows both: detection logic is in the hook (~30 lines), but pipeline behavior is in orchestrator.md (~60 lines). Neither layer does the other's job.

4. **Mode prompts are orchestrator rules, not global rules.** An early draft put mode behavior in `rules/AGENTS.md`. But mode only affects the orchestrator's pipeline decisions — subagents don't change behavior based on mode. The orchestrator already mediates between user and specialist; mode override is a natural extension of that role. ADR-001's filter (global rules are for cross-cutting techniques only) confirms this: mode behavior is orchestrator-specific.

5. **Denylist is forward-safe.** If a fourth mode is added in the future, all existing users get it automatically. An allowlist would require an explicit opt-in for each new mode. Denylist matches the principle that modes are additive features.

## Date

2026-06-14
