# Changelog

## 0.5.4

### Patch Changes

- [#83](https://github.com/agustinusnathaniel/maestria/pull/83) [`db2e845`](https://github.com/agustinusnathaniel/maestria/commit/db2e845c7aebaf8c1a865df1f41bd18d39b89241) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Added structural assumption-verification tags to specialist outputs, deterministic agent principle, cognitive hygiene delegation checklist, outcome-specs principle, experiment-framing routing, unprompted observations rule, parallel speculation pattern, and first-principles decomposition principle

## 0.5.3

### Patch Changes

- [#82](https://github.com/agustinusnathaniel/maestria/pull/82) [`3cf6d4a`](https://github.com/agustinusnathaniel/maestria/commit/3cf6d4a4d461e3c55de8b808cfbd27be571f21be) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: make PR description structure mandatory, fix wording inconsistencies

  Changed COMMIT PROTOCOL step 7 from "should include" to a numbered list of
  required PR description sections: Summary, ## Changes (Work Results table),

  ## Testing, and ## Breaking Changes. Aligned CRITICAL RULE [#14](https://github.com/agustinusnathaniel/maestria/issues/14)'s override

  wording with the Work Results section's qualified partial override. Aligned
  Work Results teaser section names with step 7's formal headings.

## 0.5.2

### Patch Changes

- [#74](https://github.com/agustinusnathaniel/maestria/pull/74) [`6fdd0ee`](https://github.com/agustinusnathaniel/maestria/commit/6fdd0ee63aed1252fb32784f62a10020ad08c264) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Align orchestrator push rules with Branch Discipline

  Remove the question() call when the commit protocol lands on main/master.
  The Branch Discipline rule already states to never push to main - the
  commit protocol now auto-checkouts a feature branch instead of asking.
  Synced to all platform plugins.

- [#76](https://github.com/agustinusnathaniel/maestria/pull/76) [`cadd9b6`](https://github.com/agustinusnathaniel/maestria/commit/cadd9b6a5239fe268488d0df57634bfb1876cd67) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: improve Work Results output format for scanning and PR reuse

  Restructured the Work Results section from a 3-part narrative format (Overview, File-by-file, Cohesion) to a lean table-first format optimized for scanning instead of reading the diff. Added signature-style notation, change-type prefixes (+/~/-), breaking change markers (!), and test file annotations ((test)). The Work Results table is now reused as the `## Changes` section in PR descriptions per existing COMMIT PROTOCOL step 7.

## 0.5.1

### Patch Changes

- [#72](https://github.com/agustinusnathaniel/maestria/pull/72) [`22bf9a5`](https://github.com/agustinusnathaniel/maestria/commit/22bf9a585fee04696f4af191e790cd3d3bb982d5) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Orchestrator now always uses the structured summary table after builder tasks

  The orchestrator's Work Results output format is now mandatory rather than
  suggested. After every builder task, a structured `## Changes` table is
  shown summarizing what files changed and why. The existing "write for
  humans" guidance no longer overrides this specific output.

  The documentation audit step before committing is now also mandatory.
  Both the project checklist and the commit protocol enforce this step
  to prevent undocumented changes from landing.

## 0.5.0

### Minor Changes

- [#66](https://github.com/agustinusnathaniel/maestria/pull/66) [`8321ab8`](https://github.com/agustinusnathaniel/maestria/commit/8321ab891e3d4ffb562617ba2e09a06f51eb580a) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: use Pi native skill system + pi-subagents agent registration

  Replaced non-standard `before_agent_start` + `readFileSync` injection with Pi's standard patterns:

  - **Skill-based injection:** Orchestrator dispatcher prompt and global agent rules now ship as `SKILL.md` files auto-discovered from `pi.skills` manifest field and injected by Pi's resource loader into every session's system prompt.
  - **Pi-subagents agent registration:** 7 specialist agents defined as `.md` files with YAML frontmatter (`description`, `tools`, `prompt_mode: append`, `inherit_context: true`), deployed to `~/.pi/agent/agents/` at extension startup for pi-subagents discovery. Each specialist has role-specific tool isolation enforcing maker/checker split.
  - Removed dead `prompts/` and `rules/` directories (synced but never consumed).

## 0.4.1

### Patch Changes

- [#63](https://github.com/agustinusnathaniel/maestria/pull/63) [`0085920`](https://github.com/agustinusnathaniel/maestria/commit/00859201f49aae3d792730091b9109fdc3d3381c) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Reordered conventional commit prefixes

  `refactor` is now the default prefix instead of `feat`. `feat` is
  reserved for user-facing features only.

## 0.4.0

### Minor Changes

- [#59](https://github.com/agustinusnathaniel/maestria/pull/59) [`9c0746e`](https://github.com/agustinusnathaniel/maestria/commit/9c0746e611afb6e79b071a14629fbd5b925338e9) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add multi-lens review swarm, observation-first principle, and triage pipeline

  Three review methodology patterns adopted from PostHog's code review research:

  - **Multi-lens review swarm** - orchestrator can dispatch parallel reviewers with different focus areas (Security, Architecture, Performance, UX, General) for non-trivial changes, with exclusive lenses and cross-referenced etiquette rules
  - **Observation over reasoning** - reviewer principle shifted from "verify without running" to "what command produces visible proof?", prioritizing observable behavior over logical argument
  - **Review triage pipeline** - issues categorized [fix]/[dismiss]/[escalate] by reviewer, then validated by orchestrator with conflict resolution (conservative wins); iteration terminates when no actionable threads remain

  Rule [#9](https://github.com/agustinusnathaniel/maestria/issues/9) (single @reviewer after @builder) remains the default; multi-lens is an enhancement for changes touching multiple concerns.

- [#61](https://github.com/agustinusnathaniel/maestria/pull/61) [`9e06eee`](https://github.com/agustinusnathaniel/maestria/commit/9e06eee83f32a33c248715130ed8b1c7e3f57747) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Eliminate questions - autonomous philosophy across core methodology

  Shift from "ask when unsure" to "exhaust data, document assumptions,
  proceed - reviewer catches mistakes". Based on analysis of 1,133 real
  question() calls across 5,675 sessions.

  **Mid-phase questions eliminated** - architect, planner, diagnose no
  longer ask design/permission questions. They exhaust data sources and
  document assumptions instead.

  **Autonomous commit protocol** - agent reads git log for past corrections,
  composes correct conventional commit message, commits autonomously.
  Push is automatic on feature branches, asks only on main/master.

  **Work result summary** - orchestrator presents completed work as
  structured file/signature table, not verbatim handoff dump.

  - !!! Convention, "Never delete" rule, escalation ladder, anti-patterns,
    Session Flow, Commit Completeness Check, and Automatic Review Loop added.

  See ADR-CORE-011 for full decision record.

## 0.3.7

### Patch Changes

- [#52](https://github.com/agustinusnathaniel/maestria/pull/52) [`cc81ff1`](https://github.com/agustinusnathaniel/maestria/commit/cc81ff16c0395e3834c623a93e9826e8dbff2c2f) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add code intelligence tool preference to global rules - agents are now directed to prefer code intelligence tools (when available) before falling back to grep/read for codebase exploration

## 0.3.6

### Patch Changes

- [`f992fdd`](https://github.com/agustinusnathaniel/maestria/commit/f992fddc445b9caf4687dcd4451280e570e12d50) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - ci: optimize pipeline

## 0.3.5

### Patch Changes

- [`8083a57`](https://github.com/agustinusnathaniel/maestria/commit/8083a575fce127470217a83fef99a26fe542d206) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - ci: optimize pipeline

## 0.3.4

### Patch Changes

- [`63593e0`](https://github.com/agustinusnathaniel/maestria/commit/63593e051208b57e2bf17a73660a3b08b3fe7006) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - ci: ensure release is pure and fresh build

## 0.3.3

### Patch Changes

- [#44](https://github.com/agustinusnathaniel/maestria/pull/44) [`b57c259`](https://github.com/agustinusnathaniel/maestria/commit/b57c25906207c6a77ce6fb2650a53c4d759e7c1d) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Fix subagent dispatch error handling: catch block now logs the actual error instead of always reporting "Subagent SDK not available"

  Add null guard in tool interceptor to prevent crashes on malformed bash events

  Remove redundant build-rules.ts codegen step: rules are now read directly from rules/AGENTS.md

## 0.3.2

### Patch Changes

- [`3babd4b`](https://github.com/agustinusnathaniel/maestria/commit/3babd4b2ef95be59f1e0157eeb8a6cf2b7b05f65) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix dependency issues

## 0.3.1

### Patch Changes

- [`456ae22`](https://github.com/agustinusnathaniel/maestria/commit/456ae22da14f336784ec944755fb11092fbbeee0) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add two new principles to agent directives
  - **Start from first principles** - added as a new `## Principles` section in `rules.md` and as a Phase 0 preamble in `diagnose.md`
  - **Prefer existing solutions** - added to `rules.md`, as a first-check blockquote in `architect.md` Phase 2, and as Round 0 in `builder.md`'s Constraint Escalation pattern

- Updated dependencies [[`456ae22`](https://github.com/agustinusnathaniel/maestria/commit/456ae22da14f336784ec944755fb11092fbbeee0)]:
  - @maestria/core@0.3.1

## 0.3.0

### Minor Changes

- [#36](https://github.com/agustinusnathaniel/maestria/pull/36) [`d1bc253`](https://github.com/agustinusnathaniel/maestria/commit/d1bc253b9c4004ccf4ef09cfa9c8b1a7f99b39e7) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add `.maestria/` project workflow protocol to agent directives

  Projects using maestria's agent directives can now define `.maestria/workflow.md` for custom delegation sequencing and `.maestria/rules.md` for project-specific non-negotiable rules. The orchestrator loads these files via `@adventurer` delegation and propagates project rules to all subagents via delegation prompts.

  See ADR-CORE-006 for the design decision.

- [`665bf4b`](https://github.com/agustinusnathaniel/maestria/commit/665bf4b0aed6162ed93579a1f1c55e80fae887ec) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add effort anthropomorphism guard and writing style guidance to agent directives
  - **Critical Rule [#11](https://github.com/agustinusnathaniel/maestria/issues/11) (orchestrator):** "Don't anthropomorphize effort" - prevents the dispatcher from avoiding the correct specialist because an analysis "feels like too much work"
  - **Output Style section (orchestrator):** Guides the dispatcher to write for humans, avoiding AI-typical patterns like em dash overuse and promotional phrasing
  - **Global agent rules (rules.md):** Cross-agent versions of both - "Don't anthropomorphize effort" and "Write for humans" - so architect, planner, builder, and all other specialists also receive the guidance

## 0.2.1

### Patch Changes

- [#33](https://github.com/agustinusnathaniel/maestria/pull/33) [`c2075b6`](https://github.com/agustinusnathaniel/maestria/commit/c2075b69b3c44ec8a95ba3711ce4bc4d76e6d163) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Introduce @maestria/core as canonical source for agent directives with config-driven sync tool
  - Add packages/core/agent-directives/ with canonical specialist, orchestrator, and rules files
  - Add packages/core/scripts/sync.ts transform pipeline (replace, prepend, append, frontmatter)
  - Add per-plugin sync.config.ts for opencode, pi, and kimi-code
  - Add scripts/sync-all and scripts/check-sync with auto-discovery via glob
  - Wire sync check into vp check via vite.config.ts run.tasks
  - Document architecture decision in ADR-CORE-005

## 0.2.0

### Minor Changes

- [#12](https://github.com/agustinusnathaniel/maestria/pull/12) [`95a0ea0`](https://github.com/agustinusnathaniel/maestria/commit/95a0ea084f2ca48b5283375b55ab1c81c5f8a014) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - feat(pi): ship @maestria/pi@0.1.0 with full agent orchestration

  Implements the `@maestria/pi` package - a Pi coding agent extension bringing Maestria's structured agent orchestration (recon → design → implement → review) to the Pi ecosystem.

  Includes:
  - 9 source modules: extension, modes, rules, rules-content, state, compaction, subagent, commands, tools
  - 3 workflow modes: fein (full pipeline), sonar (research), blitz (fast impl)
  - 8 prompt templates: orchestrator + 7 specialists
  - 2 methodology skills: handoff, iteration-limits
  - Subagent dispatch with 3 modes: single, parallel (max 8), chain (with {previous} placeholder)
  - Global rules injection via before_agent_start event
  - Compaction state preservation
  - Maker/checker enforcement via tool-call interception
  - 9 Pi commands: /fein, /sonar, /blitz, /orchestrate, /review, /restore-model, /review-model, /handoff, /maestria-status
  - 63 tests with full coverage
  - User-facing documentation (7 pages)
  - 3 ADRs documenting architecture decisions

## 0.1.0 (2026-06-22)

### Features

- 8 specialist prompt templates (orchestrator + 7 specialists)
- 3 workflow modes: fein (full pipeline), sonar (research only), blitz (fast implementation)
- Global rules injection via `before_agent_start` event
- Session compaction preservation with structured state summaries
- Subagent dispatch via `@gotgenes/pi-subagents` with 6-field handoff validation
- `/orchestrate`, `/review`, `/maestria-status` commands
- Maker/checker enforcement via tool-call interception
- 2 methodology skills: handoff contract and iteration limits
