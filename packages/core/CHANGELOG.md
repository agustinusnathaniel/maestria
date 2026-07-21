# @maestria/core

## 0.4.8

### Patch Changes

- [#106](https://github.com/agustinusnathaniel/maestria/pull/106) [`ba91d36`](https://github.com/agustinusnathaniel/maestria/commit/ba91d36ba612cd2c634e3a73071047a5f50f46b4) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Updated dependencies across packages: diff ^9.0.0, zod ^4.4.3, @clack v1.x, effect beta.100, astro 7.1.3, and more

## 0.4.7

### Patch Changes

- [#103](https://github.com/agustinusnathaniel/maestria/pull/103) [`886dbd0`](https://github.com/agustinusnathaniel/maestria/commit/886dbd0b92256110d89f1549d7a96849950a2e82) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Sync workflow mode commands (fein/sonar/blitz) through canonical source pipeline, including Hermes

## 0.4.6

### Patch Changes

- [#94](https://github.com/agustinusnathaniel/maestria/pull/94) [`6a0243f`](https://github.com/agustinusnathaniel/maestria/commit/6a0243f3d969f4721c07ff2ebec6676f322c0486) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Compact agent directives to cut context usage (~38% on the orchestrator prompt) without removing rules or intent. The orchestrator consolidates 15 critical rules into 11 and merges the commit, review, and routing guidance into single sections. Shared specialist rules (maker/checker split, handoff validation, ambiguity handling, escalation format, tool routing) now live once in the global rules instead of being repeated per specialist. Also fixes duplicate skill prescriptions in diagnose and architect, a formatting bug in the global rules, and stale cross-references.

## 0.4.5

### Patch Changes

- [#83](https://github.com/agustinusnathaniel/maestria/pull/83) [`db2e845`](https://github.com/agustinusnathaniel/maestria/commit/db2e845c7aebaf8c1a865df1f41bd18d39b89241) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Added structural assumption-verification tags to specialist outputs, deterministic agent principle, cognitive hygiene delegation checklist, outcome-specs principle, experiment-framing routing, unprompted observations rule, parallel speculation pattern, and first-principles decomposition principle

## 0.4.4

### Patch Changes

- [#82](https://github.com/agustinusnathaniel/maestria/pull/82) [`3cf6d4a`](https://github.com/agustinusnathaniel/maestria/commit/3cf6d4a4d461e3c55de8b808cfbd27be571f21be) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: make PR description structure mandatory, fix wording inconsistencies

  Changed COMMIT PROTOCOL step 7 from "should include" to a numbered list of
  required PR description sections: Summary, ## Changes (Work Results table),

  ## Testing, and ## Breaking Changes. Aligned CRITICAL RULE [#14](https://github.com/agustinusnathaniel/maestria/issues/14)'s override

  wording with the Work Results section's qualified partial override. Aligned
  Work Results teaser section names with step 7's formal headings.

## 0.4.3

### Patch Changes

- [#74](https://github.com/agustinusnathaniel/maestria/pull/74) [`6fdd0ee`](https://github.com/agustinusnathaniel/maestria/commit/6fdd0ee63aed1252fb32784f62a10020ad08c264) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Align orchestrator push rules with Branch Discipline

  Remove the question() call when the commit protocol lands on main/master.
  The Branch Discipline rule already states to never push to main - the
  commit protocol now auto-checkouts a feature branch instead of asking.
  Synced to all platform plugins.

- [#76](https://github.com/agustinusnathaniel/maestria/pull/76) [`cadd9b6`](https://github.com/agustinusnathaniel/maestria/commit/cadd9b6a5239fe268488d0df57634bfb1876cd67) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: improve Work Results output format for scanning and PR reuse

  Restructured the Work Results section from a 3-part narrative format (Overview, File-by-file, Cohesion) to a lean table-first format optimized for scanning instead of reading the diff. Added signature-style notation, change-type prefixes (+/~/-), breaking change markers (!), and test file annotations ((test)). The Work Results table is now reused as the `## Changes` section in PR descriptions per existing COMMIT PROTOCOL step 7.

## 0.4.2

### Patch Changes

- [#72](https://github.com/agustinusnathaniel/maestria/pull/72) [`22bf9a5`](https://github.com/agustinusnathaniel/maestria/commit/22bf9a585fee04696f4af191e790cd3d3bb982d5) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Orchestrator now always uses the structured summary table after builder tasks

  The orchestrator's Work Results output format is now mandatory rather than
  suggested. After every builder task, a structured `## Changes` table is
  shown summarizing what files changed and why. The existing "write for
  humans" guidance no longer overrides this specific output.

  The documentation audit step before committing is now also mandatory.
  Both the project checklist and the commit protocol enforce this step
  to prevent undocumented changes from landing.

- [#72](https://github.com/agustinusnathaniel/maestria/pull/72) [`22bf9a5`](https://github.com/agustinusnathaniel/maestria/commit/22bf9a585fee04696f4af191e790cd3d3bb982d5) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Sync pipeline now detects hand-edited platform files. The check-sync
  verifies that synced copies were generated from canonical source,
  not hand-edited - catching mismatches before CI fails.

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

## 0.3.2

### Patch Changes

- [#52](https://github.com/agustinusnathaniel/maestria/pull/52) [`cc81ff1`](https://github.com/agustinusnathaniel/maestria/commit/cc81ff16c0395e3834c623a93e9826e8dbff2c2f) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add code intelligence tool preference to global rules - agents are now directed to prefer code intelligence tools (when available) before falling back to grep/read for codebase exploration

## 0.3.1

### Patch Changes

- [`456ae22`](https://github.com/agustinusnathaniel/maestria/commit/456ae22da14f336784ec944755fb11092fbbeee0) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add two new principles to agent directives
  - **Start from first principles** - added as a new `## Principles` section in `rules.md` and as a Phase 0 preamble in `diagnose.md`
  - **Prefer existing solutions** - added to `rules.md`, as a first-check blockquote in `architect.md` Phase 2, and as Round 0 in `builder.md`'s Constraint Escalation pattern

## 0.3.0

### Minor Changes

- [`665bf4b`](https://github.com/agustinusnathaniel/maestria/commit/665bf4b0aed6162ed93579a1f1c55e80fae887ec) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add effort anthropomorphism guard and writing style guidance to agent directives
  - **Critical Rule [#11](https://github.com/agustinusnathaniel/maestria/issues/11) (orchestrator):** "Don't anthropomorphize effort" - prevents the dispatcher from avoiding the correct specialist because an analysis "feels like too much work"
  - **Output Style section (orchestrator):** Guides the dispatcher to write for humans, avoiding AI-typical patterns like em dash overuse and promotional phrasing
  - **Global agent rules (rules.md):** Cross-agent versions of both - "Don't anthropomorphize effort" and "Write for humans" - so architect, planner, builder, and all other specialists also receive the guidance

## 0.3.0

### Minor Changes

- [#36](https://github.com/agustinusnathaniel/maestria/pull/36) [`83a3d8b`](https://github.com/agustinusnathaniel/maestria/commit/83a3d8b) - Add `.maestria/` project workflow protocol to agent directives. Projects can now define `.maestria/workflow.md` and `.maestria/rules.md` for custom delegation sequencing and project-specific rules.

## 0.2.0

### Minor Changes

- [#33](https://github.com/agustinusnathaniel/maestria/pull/33) [`c2075b6`](https://github.com/agustinusnathaniel/maestria/commit/c2075b69b3c44ec8a95ba3711ce4bc4d76e6d163) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Introduce @maestria/core as canonical source for agent directives with config-driven sync tool
  - Add packages/core/agent-directives/ with canonical specialist, orchestrator, and rules files
  - Add packages/core/scripts/sync.ts transform pipeline (replace, prepend, append, frontmatter)
  - Add per-plugin sync.config.ts for opencode, pi, and kimi-code
  - Add scripts/sync-all and scripts/check-sync with auto-discovery via glob
  - Wire sync check into vp check via vite.config.ts run.tasks
  - Document architecture decision in ADR-CORE-005
