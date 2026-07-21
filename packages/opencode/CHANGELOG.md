# Changelog

## 0.6.8

### Patch Changes

- [#106](https://github.com/agustinusnathaniel/maestria/pull/106) [`ba91d36`](https://github.com/agustinusnathaniel/maestria/commit/ba91d36ba612cd2c634e3a73071047a5f50f46b4) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Updated dependencies across packages: diff ^9.0.0, zod ^4.4.3, @clack v1.x, effect beta.100, astro 7.1.3, and more

## 0.6.7

### Patch Changes

- [#103](https://github.com/agustinusnathaniel/maestria/pull/103) [`886dbd0`](https://github.com/agustinusnathaniel/maestria/commit/886dbd0b92256110d89f1549d7a96849950a2e82) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Sync workflow mode commands (fein/sonar/blitz) through canonical source pipeline, including Hermes

## 0.6.6

### Patch Changes

- [#94](https://github.com/agustinusnathaniel/maestria/pull/94) [`6a0243f`](https://github.com/agustinusnathaniel/maestria/commit/6a0243f3d969f4721c07ff2ebec6676f322c0486) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Compact agent directives to cut context usage (~38% on the orchestrator prompt) without removing rules or intent. The orchestrator consolidates 15 critical rules into 11 and merges the commit, review, and routing guidance into single sections. Shared specialist rules (maker/checker split, handoff validation, ambiguity handling, escalation format, tool routing) now live once in the global rules instead of being repeated per specialist. Also fixes duplicate skill prescriptions in diagnose and architect, a formatting bug in the global rules, and stale cross-references.

## 0.6.5

### Patch Changes

- [#83](https://github.com/agustinusnathaniel/maestria/pull/83) [`db2e845`](https://github.com/agustinusnathaniel/maestria/commit/db2e845c7aebaf8c1a865df1f41bd18d39b89241) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Added structural assumption-verification tags to specialist outputs, deterministic agent principle, cognitive hygiene delegation checklist, outcome-specs principle, experiment-framing routing, unprompted observations rule, parallel speculation pattern, and first-principles decomposition principle

## 0.6.4

### Patch Changes

- [#82](https://github.com/agustinusnathaniel/maestria/pull/82) [`3cf6d4a`](https://github.com/agustinusnathaniel/maestria/commit/3cf6d4a4d461e3c55de8b808cfbd27be571f21be) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: make PR description structure mandatory, fix wording inconsistencies

  Changed COMMIT PROTOCOL step 7 from "should include" to a numbered list of
  required PR description sections: Summary, ## Changes (Work Results table),

  ## Testing, and ## Breaking Changes. Aligned CRITICAL RULE [#14](https://github.com/agustinusnathaniel/maestria/issues/14)'s override

  wording with the Work Results section's qualified partial override. Aligned
  Work Results teaser section names with step 7's formal headings.

## 0.6.3

### Patch Changes

- [#74](https://github.com/agustinusnathaniel/maestria/pull/74) [`6fdd0ee`](https://github.com/agustinusnathaniel/maestria/commit/6fdd0ee63aed1252fb32784f62a10020ad08c264) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Align orchestrator push rules with Branch Discipline

  Remove the question() call when the commit protocol lands on main/master.
  The Branch Discipline rule already states to never push to main - the
  commit protocol now auto-checkouts a feature branch instead of asking.
  Synced to all platform plugins.

- [#76](https://github.com/agustinusnathaniel/maestria/pull/76) [`cadd9b6`](https://github.com/agustinusnathaniel/maestria/commit/cadd9b6a5239fe268488d0df57634bfb1876cd67) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: improve Work Results output format for scanning and PR reuse

  Restructured the Work Results section from a 3-part narrative format (Overview, File-by-file, Cohesion) to a lean table-first format optimized for scanning instead of reading the diff. Added signature-style notation, change-type prefixes (+/~/-), breaking change markers (!), and test file annotations ((test)). The Work Results table is now reused as the `## Changes` section in PR descriptions per existing COMMIT PROTOCOL step 7.

## 0.6.2

### Patch Changes

- [#72](https://github.com/agustinusnathaniel/maestria/pull/72) [`22bf9a5`](https://github.com/agustinusnathaniel/maestria/commit/22bf9a585fee04696f4af191e790cd3d3bb982d5) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Orchestrator now always uses the structured summary table after builder tasks

  The orchestrator's Work Results output format is now mandatory rather than
  suggested. After every builder task, a structured `## Changes` table is
  shown summarizing what files changed and why. The existing "write for
  humans" guidance no longer overrides this specific output.

  The documentation audit step before committing is now also mandatory.
  Both the project checklist and the commit protocol enforce this step
  to prevent undocumented changes from landing.

## 0.6.1

### Patch Changes

- [#63](https://github.com/agustinusnathaniel/maestria/pull/63) [`0085920`](https://github.com/agustinusnathaniel/maestria/commit/00859201f49aae3d792730091b9109fdc3d3381c) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Expanded agent shell permissions

  Adventurer, architect, planner, reviewer, and writer now have
  expanded shell access. Read-only file operations and role-specific
  tools are pre-allowed. Unusual or dangerous commands still prompt
  for approval.

- [#63](https://github.com/agustinusnathaniel/maestria/pull/63) [`0085920`](https://github.com/agustinusnathaniel/maestria/commit/00859201f49aae3d792730091b9109fdc3d3381c) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Reordered conventional commit prefixes

  `refactor` is now the default prefix instead of `feat`. `feat` is
  reserved for user-facing features only.

## 0.6.0

### Minor Changes

- [#59](https://github.com/agustinusnathaniel/maestria/pull/59) [`9c0746e`](https://github.com/agustinusnathaniel/maestria/commit/9c0746e611afb6e79b071a14629fbd5b925338e9) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add multi-lens review swarm, observation-first principle, and triage pipeline

  Three review methodology patterns adopted from PostHog's code review research:

  - **Multi-lens review swarm** - orchestrator can dispatch parallel reviewers with different focus areas (Security, Architecture, Performance, UX, General) for non-trivial changes, with exclusive lenses and cross-referenced etiquette rules
  - **Observation over reasoning** - reviewer principle shifted from "verify without running" to "what command produces visible proof?", prioritizing observable behavior over logical argument
  - **Review triage pipeline** - issues categorized [fix]/[dismiss]/[escalate] by reviewer, then validated by orchestrator with conflict resolution (conservative wins); iteration terminates when no actionable threads remain

  Rule [#9](https://github.com/agustinusnathaniel/maestria/issues/9) (single @reviewer after @builder) remains the default; multi-lens is an enhancement for changes touching multiple concerns.

- [#61](https://github.com/agustinusnathaniel/maestria/pull/61) [`9e06eee`](https://github.com/agustinusnathaniel/maestria/commit/9e06eee83f32a33c248715130ed8b1c7e3f57747) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Align OpenCode agent permissions with autonomous philosophy

  Builder shell permissions expanded from 5 narrow patterns to a
  comprehensive allow-list covering read-only file operations, git,
  package managers (pnpm, npm), and build/test/lint tools (tsc, vitest,
  vp, rtk, eslint, prettier). Both builder and diagnose keep \*: ask
  catch-all for unusual commands.

  Diagnose edit permission changed from ask to allow.

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

## 0.5.7

### Patch Changes

- [#52](https://github.com/agustinusnathaniel/maestria/pull/52) [`cc81ff1`](https://github.com/agustinusnathaniel/maestria/commit/cc81ff16c0395e3834c623a93e9826e8dbff2c2f) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add code intelligence tool preference to global rules - agents are now directed to prefer code intelligence tools (when available) before falling back to grep/read for codebase exploration

## 0.5.6

### Patch Changes

- [`f992fdd`](https://github.com/agustinusnathaniel/maestria/commit/f992fddc445b9caf4687dcd4451280e570e12d50) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - ci: optimize pipeline

## 0.5.5

### Patch Changes

- [`8083a57`](https://github.com/agustinusnathaniel/maestria/commit/8083a575fce127470217a83fef99a26fe542d206) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - ci: optimize pipeline

## 0.5.4

### Patch Changes

- [`63593e0`](https://github.com/agustinusnathaniel/maestria/commit/63593e051208b57e2bf17a73660a3b08b3fe7006) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - ci: ensure release is pure and fresh build

## 0.5.3

### Patch Changes

- [#44](https://github.com/agustinusnathaniel/maestria/pull/44) [`b57c259`](https://github.com/agustinusnathaniel/maestria/commit/b57c25906207c6a77ce6fb2650a53c4d759e7c1d) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Plugin now throws an error when the agents directory is missing or unreadable, instead of silently loading zero agents

## 0.5.2

### Patch Changes

- [`3babd4b`](https://github.com/agustinusnathaniel/maestria/commit/3babd4b2ef95be59f1e0157eeb8a6cf2b7b05f65) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix dependency issues

## 0.5.1

### Patch Changes

- [`456ae22`](https://github.com/agustinusnathaniel/maestria/commit/456ae22da14f336784ec944755fb11092fbbeee0) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add two new principles to agent directives

  - **Start from first principles** - added as a new `## Principles` section in `rules.md` and as a Phase 0 preamble in `diagnose.md`
  - **Prefer existing solutions** - added to `rules.md`, as a first-check blockquote in `architect.md` Phase 2, and as Round 0 in `builder.md`'s Constraint Escalation pattern

- Updated dependencies [[`456ae22`](https://github.com/agustinusnathaniel/maestria/commit/456ae22da14f336784ec944755fb11092fbbeee0)]:
  - @maestria/core@0.3.1

## 0.5.0

### Minor Changes

- [#36](https://github.com/agustinusnathaniel/maestria/pull/36) [`d1bc253`](https://github.com/agustinusnathaniel/maestria/commit/d1bc253b9c4004ccf4ef09cfa9c8b1a7f99b39e7) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add `.maestria/` project workflow protocol to agent directives

  Projects using maestria's agent directives can now define `.maestria/workflow.md` for custom delegation sequencing and `.maestria/rules.md` for project-specific non-negotiable rules. The orchestrator loads these files via `@adventurer` delegation and propagates project rules to all subagents via delegation prompts.

  See ADR-CORE-006 for the design decision.

- [`665bf4b`](https://github.com/agustinusnathaniel/maestria/commit/665bf4b0aed6162ed93579a1f1c55e80fae887ec) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add effort anthropomorphism guard and writing style guidance to agent directives
  - **Critical Rule [#11](https://github.com/agustinusnathaniel/maestria/issues/11) (orchestrator):** "Don't anthropomorphize effort" - prevents the dispatcher from avoiding the correct specialist because an analysis "feels like too much work"
  - **Output Style section (orchestrator):** Guides the dispatcher to write for humans, avoiding AI-typical patterns like em dash overuse and promotional phrasing
  - **Global agent rules (rules.md):** Cross-agent versions of both - "Don't anthropomorphize effort" and "Write for humans" - so architect, planner, builder, and all other specialists also receive the guidance

## 0.4.9

### Patch Changes

- [#33](https://github.com/agustinusnathaniel/maestria/pull/33) [`c2075b6`](https://github.com/agustinusnathaniel/maestria/commit/c2075b69b3c44ec8a95ba3711ce4bc4d76e6d163) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Introduce @maestria/core as canonical source for agent directives with config-driven sync tool
  - Add packages/core/agent-directives/ with canonical specialist, orchestrator, and rules files
  - Add packages/core/scripts/sync.ts transform pipeline (replace, prepend, append, frontmatter)
  - Add per-plugin sync.config.ts for opencode, pi, and kimi-code
  - Add scripts/sync-all and scripts/check-sync with auto-discovery via glob
  - Wire sync check into vp check via vite.config.ts run.tasks
  - Document architecture decision in ADR-CORE-005

## 0.4.8

### Patch Changes

- [`c035ef2`](https://github.com/agustinusnathaniel/maestria/commit/c035ef2769586f253bb0d668fd07fcab38c567b6) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Move @opencode-ai/plugin to peerDependencies + devDependencies (community convention) Add graceful error handling in loadAgents() with per-file try/catch Add opencode metadata block to package.json for plugin discovery

## 0.4.7

### Patch Changes

- [#29](https://github.com/agustinusnathaniel/maestria/pull/29) [`8761471`](https://github.com/agustinusnathaniel/maestria/commit/8761471e185595cb0123b78cb4fa38fbbcd799fb) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Refactor orchestrator pipeline to use role-based abstraction (thinker/worker/verifier) with dynamic sequencing, verifier-terminated execution, and context access lists for delegation handoffs. Updates fein mode prompt to reference roles instead of specific agents.

- [`b5edf75`](https://github.com/agustinusnathaniel/maestria/commit/b5edf75080248d649dff847ff832cb3298a9dfda) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Remove Vite+-specific CLI references from plugin agents and rules

  Replace hard-coded `vp check` / `vp test` references with generic validation language so the plugin is toolchain-agnostic.

## 0.4.6

### Patch Changes

- [`ecfa74a`](https://github.com/agustinusnathaniel/maestria/commit/ecfa74a34acadb66871c66de9e6b05fd0695d769) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix: preserve line breaks when stripping mode keywords from messages

- [`9b91ca9`](https://github.com/agustinusnathaniel/maestria/commit/9b91ca9aa3b75566edca317b2535794092f5fcf8) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Strengthen commit authorization rules in orchestrator directive
  - Add explicit COMMIT PROTOCOL section to the orchestrator prompt
  - Harden CRITICAL RULE [#3](https://github.com/agustinusnathaniel/maestria/issues/3) with ZERO authorization after each commit
  - Add Commit Policy section to global rules for all subagents
  - Tighten prose and remove redundant language

## 0.4.5

### Patch Changes

- [`2d10324`](https://github.com/agustinusnathaniel/maestria/commit/2d10324e0d2a539616c7d3da576695eb6fd994fb) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix scripts to use vp

## 0.4.4

### Patch Changes

- [`9c396e6`](https://github.com/agustinusnathaniel/maestria/commit/9c396e6e6920d74a2080903fcf6e91293457d9fd) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Upgrade TypeScript to v6, streamline Vite+ configuration, and consolidate scripts

## 0.4.3

### Patch Changes

- [`b722da0`](https://github.com/agustinusnathaniel/maestria/commit/b722da01d6bbe8a105a26d757a870b5cf0ef9b43) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Switch build from tsc to vp pack (tsdown), consolidate configs
  - Replace tsc build with vp pack/tsdown for native @/ alias resolution
  - Consolidate vitest.config.ts into single vite.config.ts with pack + test blocks
  - Add integration tests for chat.message hook
  - Remove tsconfig.build.json, verify-imports.sh (no longer needed)
  - Add proper pack config (target, sourcemap, minify)
  - Simplify pre-push hook
  - Remove redundant typecheck script (vp check covers it)

## 0.4.2

### Patch Changes

- [`20fdde5`](https://github.com/agustinusnathaniel/maestria/commit/20fdde52b05142ec7a7e293f15ebc9cbc1496e5f) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add @/ path alias, integration tests, vitest config, and pre-push hooks
  - Add @/ path alias to tsconfig.json for cleaner imports across src/ and tests/
  - Create vitest.config.ts with tsconfigPaths resolution
  - Add integration tests for chat.message hook (asserts on parts length)
  - Add pre-push hook via vite-hooks (runs vp check + pnpm test)

## 0.4.1

### Patch Changes

- [`0990997`](https://github.com/agustinusnathaniel/maestria/commit/099099761174ad6f277405d21005a09abc3cf2a8) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Fix ESM compatibility: add .js extensions to relative imports

  Relative imports in the plugin source were missing `.js` extensions, causing ERR_MODULE_NOT_FOUND in Node ESM environments. Added `.js` extensions to all 5 internal imports and a build-time verification script to catch future regressions.

## 0.4.0

### Minor Changes

- [#20](https://github.com/agustinusnathaniel/maestria/pull/20) [`c3a5015`](https://github.com/agustinusnathaniel/maestria/commit/c3a501572835ae880eb56202b115c9771f999910) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Introduce three keyword-triggered workflow modes that override the orchestrator's default delegation pipeline:

  - `fein` - full pipeline (mandatory recon → design → build → review)
  - `sonar` - research only (recon + design, stop before implementation)
  - `blitz` - fast implementation (builder direct, skip gates)

  Detection is word-boundary regex at any position, code-block-aware, case-insensitive. Most restrictive mode wins (fein > sonar > blitz). Config via `modes.disabledKeywords` denylist.

  ADR-008 documents the full design.

## 0.3.11

### Patch Changes

- [`4500749`](https://github.com/agustinusnathaniel/maestria/commit/4500749126e1c4b37fba83bdb8daf8dc319b654a) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Remove read-only bash permissions (git status/diff/log/show/branch, ls, which, pwd) from orchestrator - it is now a pure dispatcher. Any codebase inspection must go through @adventurer or @builder.

## 0.3.10

### Patch Changes

- [`a12fc6d`](https://github.com/agustinusnathaniel/maestria/commit/a12fc6d719cefc7572f4afe85c664ee0ebc4031d) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Revert orchestrator to pure dispatcher - after real-world testing, read/glob/grep permissions on the orchestrator caused workaround behavior (preferring direct recon over delegation to specialist agents). The experiment confirmed that structural permission denial is the only reliable enforcement for an LLM-based orchestrator. The orchestrator remains limited to task() delegation and question() - no read, glob, grep, webfetch, edit, or lsp.

  Streamline orchestrator prompt - remove directives that redundantly restate permission blocks (tool restrictions, bash allow-lists, task routing limits) which are already structurally enforced through YAML frontmatter.

## 0.3.9

### Patch Changes

- [`21d866f`](https://github.com/agustinusnathaniel/maestria/commit/21d866ff9a2b41e68e4de17152c5a6727d6b0e22) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add websearch:ask for architect, adventurer, and diagnose agents - these discovery-oriented agents can now search the web (with user prompt via `ask` permission) to find relevant documentation and resources.

  Grant read/glob/grep to orchestrator - the orchestrator now has read-only reconnaissance tools for quick verification before delegation, with structural safeguards (edit/webfetch/lsp remain denied, 3-call limit).

## 0.3.8

### Patch Changes

- [`2e2f10e`](https://github.com/agustinusnathaniel/maestria/commit/2e2f10e62e932747d0fc1a260aed3ef2b65f267c) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Refine agent permissions after audit
  - Add `todowrite` to adventurer, diagnose, writer for multi-step tracking
  - Add missing git commands (status, show, diff, log) to adventurer, architect, reviewer, writer
  - Add `lsp` to writer for code navigation during doc generation
  - Add `npm view` to builder for dependency checks
  - Add `which` to planner for tool discovery

## 0.3.7

### Patch Changes

- [`86c9589`](https://github.com/agustinusnathaniel/maestria/commit/86c958922d3d52308f106bb3d9785e3cab202092) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix: replace hand-rolled YAML parser with spec-compliant library

  The custom YAML frontmatter parser (~120 lines) didn't handle quoting, nesting, or multiline values correctly. Permission patterns like `"git status*": allow` and `"*": deny` were silently broken because the parser treated quotes as literal characters instead of YAML syntax.

  This is now replaced with the `yaml` library (eemeli/yaml) - a proper spec-compliant parser that handles quoting, multiline values, and nested structures natively. The `stripYamlQuotes` workaround, added to patch the old parser, has been removed as it's no longer needed.

  All 8 agent descriptions have also been converted to YAML folded block scalars (`>`) for cleaner multiline text that reads well both in source and when parsed.

  Every agent's permission model was broken out of the box - deny-by-default didn't deny, and allowlists didn't allow. That's fixed now.

## 0.3.6

### Patch Changes

- [`a52dd48`](https://github.com/agustinusnathaniel/maestria/commit/a52dd48b8ee2aa031f9989fde268d08d5c2569ce) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix: explicitly deny orchestrator read-side tools

  The orchestrator's `read`, `glob`, `grep`, `lsp`, and `webfetch` permissions are now explicitly set to `deny`. The previous refactor relied on a missing-key default that the opencode framework does not honor, so the orchestrator was still able to use these tools. The new explicit denials make the strict-dispatcher role effective.

  The 7 specialist subagents retain full read-side tool access for the work they pick up.

## 0.3.5

### Patch Changes

- [`f9f9a7d`](https://github.com/agustinusnathaniel/maestria/commit/f9f9a7d6f08699d5db8c2ddc0d7234eb9e3b2251) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: strip orchestrator read-side tools and add missing global directives

  The orchestrator is restructured into a strict dispatcher. Its `read`, `glob`, `grep`, `lsp`, and `webfetch` permissions are removed, and the opening prompt is rewritten as a dispatcher mandate stating that `task()` and `question()` are the only tools for making progress. CRITICAL RULES are consolidated from 10 to 8 - the redundant "Shell is not a workaround" and "Prefer local tools over webfetch; webfetch may hang" directives are deleted and the rest are renumbered. The 7 specialists retain full read-side tool access for the work they pick up.

  Three directives are also added to the global rules (`packages/opencode/rules/AGENTS.md`): "Webfetch may hang - don't block on it", "CLI references - use local tools first", and "Local files - read directly". Because global rules are injected into every specialist's prompt at runtime, this closes 21 directive-coverage gaps (3 directives × 7 specialists) and the guidance now applies uniformly.

## 0.3.4

### Patch Changes

- [`361171d`](https://github.com/agustinusnathaniel/maestria/commit/361171de7b0d2b90235a98f7d61c1ba3c541f3f4) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix: audit and update skill prescriptions across all 7 agents
  - Fix rename: `diagnose` → `diagnosing-bugs`, `write-a-skill` → `writing-great-skills`
  - Remove dead skill: `zoom-out` (not in mattpocock/skills)
  - Fix 10 wrong source repos (ADRs → wshobson/agents, review-logging-patterns → hugorcd/evlog, etc.)
  - Remove skills from sickn33/antigravity-awesome-skills and refoundai/lenny-skills sources
  - Add 8 new skills from mattpocock/skills and anthropics/skills with cross-references across appropriate agents

## 0.3.3

### Patch Changes

- [`7c6e15c`](https://github.com/agustinusnathaniel/maestria/commit/7c6e15c61a329bccf5776201e860c6816ef11edb) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: audit and sort agent skill prescriptions across all 7 agents

  Alphabetically sorts the "Load on trigger" skill lists in all 7 agent files (adventurer, architect, builder, diagnose, planner, reviewer, writer) and adds a few missing skill entries for consistency (e.g., `session-handoff` to adventurer, `prioritizing-roadmap` and `technical-roadmaps` to planner).

## 0.3.2

### Patch Changes

- [`bda0043`](https://github.com/agustinusnathaniel/maestria/commit/bda00430d0dbfc6ba050dced54b9f52236d0811f) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: strengthen orchestrator delegation rules
  - Rule [#1](https://github.com/agustinusnathaniel/maestria/issues/1) expanded to explicitly forbid using shell commands for implementation work - shell is for context-gathering only, never for doing the work yourself. References the Available Specialists table instead of duplicating agent mappings inline.
  - New rule [#2](https://github.com/agustinusnathaniel/maestria/issues/2): "Shell is not a workaround" - catches the common failure mode of substituting shell commands for delegation.
  - Subsequent rules renumbered.

## 0.3.1

### Patch Changes

- [`fc26805`](https://github.com/agustinusnathaniel/maestria/commit/fc26805a19ee712b75e96766859d8c2d86d31266) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: restrict orchestrator task permissions to 7 registered subagents

  The orchestrator's `task` permission was changed from `"*": allow` to a deny-by-default pattern that explicitly allows only the 7 registered subagents (adventurer, architect, builder, diagnose, planner, reviewer, writer). Built-in `explore` and `general` subagents are removed from the Task tool description entirely, providing technical enforcement that prevents the orchestrator from delegating to them.

## 0.3.0

### Minor Changes

- [`9759d01`](https://github.com/agustinusnathaniel/maestria/commit/9759d01c08dba296a4c139be977147131be9134a) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Incorporate AI engineering learnings from knowledge base
  - **"Read the docs first"** - new non-negotiable directive across global rules (AGENTS.md), architect, and builder agents to prevent guessing at API behavior
  - **Diagnostic documentation mandate** - elevated from passive guidance to `!!!` non-negotiable in diagnose.md; diagnostic findings must be saved as persistent knowledge artifacts
  - **Skill prescription expansion** - builder gains `commit-work` skill, diagnose gains `dependency-updater` skill for dependency-related investigations

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.2.6](https://github.com/agustinusnathaniel/maestria/compare/v0.2.5...v0.2.6) (2026-06-14)

### Bug Fixes

- **opencode:** fix typo in builder.md agent prompt ([1c098ff](https://github.com/agustinusnathaniel/maestria/commit/1c098fffce7235c6b1e1d88d9fd1750794ec9930))

## [0.2.5](https://github.com/agustinusnathaniel/maestria/compare/v0.2.4...v0.2.5) (2026-06-12)

## [0.2.4](https://github.com/agustinusnathaniel/maestria/compare/v0.2.3...v0.2.4) (2026-06-12)

### Bug Fixes

- **opencode:** restore rules injection, remove conflicting instruction ([85d0267](https://github.com/agustinusnathaniel/maestria/commit/85d0267e9c82687b62750777b83ea54c70fb8f0e))

## [0.2.3](https://github.com/agustinusnathaniel/maestria/compare/v0.2.2...v0.2.3) (2026-06-12)

## [0.2.2](https://github.com/agustinusnathaniel/maestria/compare/v0.2.1...v0.2.2) (2026-06-12)

### Features

- **docs:** add Astro Starlight documentation site for @maestria/opencode ([06a21ac](https://github.com/agustinusnathaniel/maestria/commit/06a21ac7b95ab97bcf5773bd43081fabe1bf1be6))

### Bug Fixes

- **opencode:** correct source repos for 10 skills per KB doc ([d2e0671](https://github.com/agustinusnathaniel/maestria/commit/d2e0671b7fd8816684bdb960b57defda1f074784))
- **opencode:** restore commit discipline, counter builder dispatch bias ([29df280](https://github.com/agustinusnathaniel/maestria/commit/29df28071b4ca996cf65b1050de7f2c69b341c2f)), closes [#3](https://github.com/agustinusnathaniel/maestria/issues/3) [#7](https://github.com/agustinusnathaniel/maestria/issues/7) [#8](https://github.com/agustinusnathaniel/maestria/issues/8) [#1](https://github.com/agustinusnathaniel/maestria/issues/1)
- **opencode:** stop injecting rules into subagent prompts ([9dfb79c](https://github.com/agustinusnathaniel/maestria/commit/9dfb79cd005629617b900d7be2b8dab42ea3e48c))
- **orchestrator:** unstick webfetch by skipping approval + preferring local tools ([23278a0](https://github.com/agustinusnathaniel/maestria/commit/23278a03667909af740648af888377dc0ce8c31f)), closes [#9](https://github.com/agustinusnathaniel/maestria/issues/9)

## [0.2.1](https://github.com/agustinusnathaniel/maestria/compare/v0.2.0...v0.2.1) (2026-06-12)

### Bug Fixes

- force orchestrator delegation via permissions, inject specialist table into global rules ([74fcecd](https://github.com/agustinusnathaniel/maestria/commit/74fcecd20ec427da7accb857df2c6bb0b444b1f8))

## 0.2.0 (2026-06-12)

### Features

- add adventurer subagent, fix orchestrator delegation and skill patterns ([4306993](https://github.com/agustinusnathaniel/maestria/commit/4306993803b2f78f09bde009d1d164ddcd28b84e))
- **opencode:** add @maestria/opencode plugin with 7 agents and rules injection ([21138d2](https://github.com/agustinusnathaniel/maestria/commit/21138d29911604035cfa7e589618caac2f92bcc5))
- **opencode:** add agent cross-references and skill discovery guidance ([b49e3e9](https://github.com/agustinusnathaniel/maestria/commit/b49e3e9427b02d0781aa15dd1a8dfc60e5140abc))
- **opencode:** add categorized skill catalog to orchestrator ([8883b11](https://github.com/agustinusnathaniel/maestria/commit/8883b11010dabb61972b353f689a7097bb8e591b))
- **opencode:** add Conventional Comments labels to reviewer output ([3578490](https://github.com/agustinusnathaniel/maestria/commit/357849075247b17e55dcb140af834554751894cb))
- **opencode:** add domain-specific skill lists to all subagents ([0f10b74](https://github.com/agustinusnathaniel/maestria/commit/0f10b74ca6d7955fd0b49c4276723ea47c646971))
- **opencode:** add opensrc pattern to global rules ([47962e9](https://github.com/agustinusnathaniel/maestria/commit/47962e9b4229e8c01ecde26fe621dbb73c41ff0d))
- **opencode:** enrich skill lists across all agents ([afb9400](https://github.com/agustinusnathaniel/maestria/commit/afb9400649918762631816e880bb8c0c6d641d15))
- **opencode:** final enrichment pass on agent skill lists ([e677425](https://github.com/agustinusnathaniel/maestria/commit/e67742538957bbd91ad3b8bc4990324c9e02041b))

### Bug Fixes

- **opencode:** add commit/push discipline rule ([e44aea3](https://github.com/agustinusnathaniel/maestria/commit/e44aea32540590b03bb59f4a5632815bf031dc6c))
