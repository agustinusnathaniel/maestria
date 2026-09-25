# @maestria/cursor

## 0.2.13

### Patch Changes

- [#347](https://github.com/agustinusnathaniel/maestria/pull/347) [`14fb301`](https://github.com/agustinusnathaniel/maestria/commit/14fb301aaf9410baf809922797eb2f25146482d4) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Adopt behavior-first testing guidance across the generated Maestria methodology. Reject tautological and change-detector tests, require pre-code test selection, prefer E2E artifacts for complex features, and record failure-mode inventories before isolated-system implementation.

- [#346](https://github.com/agustinusnathaniel/maestria/pull/346) [`b3aa378`](https://github.com/agustinusnathaniel/maestria/commit/b3aa378700cf327ea702376e5fd475d99213bb4a) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Guide agents to commit verified implementation slices, plan reviewable PR boundaries early, and present architect or planner designs to users before dependent implementation.

## 0.2.12

### Patch Changes

- [#322](https://github.com/agustinusnathaniel/maestria/pull/322) [`971ff4b`](https://github.com/agustinusnathaniel/maestria/commit/971ff4b7378ddd8654b97196cd19fce4343185ed) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add the `docs-update` methodology skill as a standalone root skill and distribute it through the existing skills CLI selection. Fresh installs default to `create-pull-request` plus `docs-update`; recorded per-platform choices (including `[]`) are preserved exactly, and updates of legacy installs without a record infer only `create-pull-request`, never silently adding the new skill. The selection record moves to version 2 only with per-skill observed source/path; reconcile, preflight, removal guards, and uninstall now operate per skill with partial successes recorded recoverably and failed skills never marked installed. Interactive update still reviews skills with final confirmation when plugins are already current. Core keeps only a short docs obligation plus the skill pointer.

- [#319](https://github.com/agustinusnathaniel/maestria/pull/319) [`05cfdfa`](https://github.com/agustinusnathaniel/maestria/commit/05cfdfa1451ab91c3ac220269776e3784919d0b2) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Load project-root `.maestria/workflow.md` then `.maestria/rules.md` as subordinate guidance on every host. OpenCode injects full fresh content on every model call through `experimental.chat.system.transform` with no restart; Pi, OMP, and Prime re-read both files on every `before_agent_start` turn from the session cwd with a notify plus STOP banner on errors; Hermes re-reads both files on every `pre_llm_call` turn with a visible error banner; declarative hosts read the project-root files with host tools when not already supplied. Absent or empty files leave defaults unchanged; present-but-unusable files never run silently. Project content may replace configurable workflows but never waives safety, authorization, or host permissions.

- [#320](https://github.com/agustinusnathaniel/maestria/pull/320) [`6430ee9`](https://github.com/agustinusnathaniel/maestria/commit/6430ee95ed03908e535e2e069e0672fda4e5eaef) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Install, update, and reconcile the `create-pull-request` methodology skill through the official `skills` CLI instead of bundling skill bodies into plugins. `install` and `update` accept `--skills` (CSV, or `none`), `--exclude-skills` (CSV), and `--yes`; per-platform selections persist only after actual success, independently installed copies are never adopted or deleted, and shared native skill directories are preserved while another owned platform still uses them. The visual-evidence procedure lives once in the root skill, with the core and integration routers pointing at it.

## 0.2.11

### Patch Changes

- [#316](https://github.com/agustinusnathaniel/maestria/pull/316) [`7a9334b`](https://github.com/agustinusnathaniel/maestria/commit/7a9334b3c020d8cbd91441e1ced33495a75b6f7a) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Restore a consistent PR delivery contract.
  
  - Titles use explicit Conventional Commits; bodies use literal ## headings in order (Summary, Changes, Verification, plus Visual evidence and Breaking changes when applicable), respecting explicit project templates.
  - Changes carries the Work Results table (File, What changed, Why); Verification carries checks, results, and unresolved gaps.
  - Pushes that change the cumulative diff or verification evidence update the PR title and body with a published-body readback. Acceptance classifies visual evidence as required or not applicable with reason, carries it through briefs, checks rendered coverage in review, reads back the published body at delivery, and treats an open PR as complete only with its applicable evidence.
  
  Also restores proportional documentation assessment: internal docs, user-facing docs, changelog/release notes, and required changesets are assessed separately, only affected categories are updated, plausible unaffected categories note a reason, and required docs carry through briefs to reconciliation.

## 0.2.10

### Patch Changes

- [#314](https://github.com/agustinusnathaniel/maestria/pull/314) [`811e6c2`](https://github.com/agustinusnathaniel/maestria/commit/811e6c25c9643ee9e8ffb04731da5cededc4ba9f) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Tighten the visual delivery evidence contract: capture, handoff, publication in the PR body, and delivery-owner readback are distinct stages. Local paths and session-log references no longer count as PR-body evidence, missing required evidence is incomplete with the checked limitation, and final reconciliation calls out PR-body evidence with readback. PR presentation stays concise and comparable without fabricated baselines, and affected evidence is refreshed with obsolete PR body references removed before delivery or re-delivery.

## 0.2.9

### Patch Changes

- [#312](https://github.com/agustinusnathaniel/maestria/pull/312) [`998a9dd`](https://github.com/agustinusnathaniel/maestria/commit/998a9dd615ada84b85c8c266415e58f10885af31) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Clarify when Sonar research is complete: each requested question needs an evidence-backed answer or a specific unresolved gap. Blitz now reuses valid context and checks, switches routes when investigation or design is needed, and continues through verification, review, and delivery.

## 0.2.8

### Patch Changes

- [#304](https://github.com/agustinusnathaniel/maestria/pull/304) [`93e4b3c`](https://github.com/agustinusnathaniel/maestria/commit/93e4b3c6fd991d3ce44dd769b95eae4d8811d560) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Clarify rendered verification and visual delivery evidence, including documentation sites, CLI output, headless capture, and unavailable uploads. Keep required artifacts and verification gaps in handoffs, reconcile accepted requirements before completion, and apply independent review to meaningful direct implementation.

## 0.2.7

### Patch Changes

- [#293](https://github.com/agustinusnathaniel/maestria/pull/293) [`5e3046e`](https://github.com/agustinusnathaniel/maestria/commit/5e3046ee97c9223c8a184aa6ad63a33b52286c94) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Remove duplicated specialist guidance from generated orchestrator skills. The canonical Specialist Ownership table shipped in the same file already covers the removed tables and rosters, so the guidance is unchanged in substance.

## 0.2.6

### Patch Changes

- [#278](https://github.com/agustinusnathaniel/maestria/pull/278) [`c770954`](https://github.com/agustinusnathaniel/maestria/commit/c7709544f12393c98fa44b966cafc452a0aa5f84) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Clarify installation paths, prerequisites, and support boundaries in package documentation. Separate contributor validation from user setup and remove stale pre-release wording.

- [#281](https://github.com/agustinusnathaniel/maestria/pull/281) [`5c5729b`](https://github.com/agustinusnathaniel/maestria/commit/5c5729b0f70d54f4181b2a5a2f1aad87fe0a92af) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Fix stale skill references so prescribed skills resolve at load time: planner skill guidance no longer names the removed `to-issues` and `to-prd` skills, and the duplicated Kimi orchestrator skill prescription (which restated canonical skill governance and drifted stale) is removed so `sync.config.ts` only adapts toward the plugin runtime. Clarify in the orchestrator's Role-Based Pipeline that `@diagnose` analyzes the bug, applies the minimal fix, and verifies the repair instead of grouping it with analyze-only thinkers. Correct the canonical agent-directives README index to count 8 pipeline agents (orchestrator + 7 specialists) and list `orchestrator.md`.

- [#280](https://github.com/agustinusnathaniel/maestria/pull/280) [`7c038cd`](https://github.com/agustinusnathaniel/maestria/commit/7c038cd28448149f4154510ee0866f0a3ef523f8) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Make agent investigation, verification, skill loading, and output structure proportional to the task. Preserve complete assignment ownership and delivery, allow necessary in-scope regression coverage, and keep downstream instructions independent of Maestria repository paths.

## 0.2.5

### Patch Changes

- [#275](https://github.com/agustinusnathaniel/maestria/pull/275) [`56351de`](https://github.com/agustinusnathaniel/maestria/commit/56351debf73a97c24eb10826517e0d9aabeaca6b) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Refine specialist engineering judgment around trust-boundary normalization, feature-local seams, shared-interface compatibility, executable sources of truth, staged migrations, durable diagnostic knowledge, and operational documentation.

## 0.2.4

### Patch Changes

- [#269](https://github.com/agustinusnathaniel/maestria/pull/269) [`ef07bf7`](https://github.com/agustinusnathaniel/maestria/commit/ef07bf78a8e5f676c76b55680301bc7c839b68a9) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add conditional visual-evidence guidance for PR delivery: confirm the project targets GitHub with authenticated gh --attach support and an available capture tool before attaching a screenshot or short video for visual or behavioral changes. Vision is optional verification only, not a precondition.

- [#269](https://github.com/agustinusnathaniel/maestria/pull/269) [`ef07bf7`](https://github.com/agustinusnathaniel/maestria/commit/ef07bf78a8e5f676c76b55680301bc7c839b68a9) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add a global testing-judgment rule (test artifacts are opt-in, behavior over implementation shape, mocks only at external seams) and align reviewer and diagnose guidance with it.

## 0.2.3

### Patch Changes

- [#248](https://github.com/agustinusnathaniel/maestria/pull/248) [`93ff292`](https://github.com/agustinusnathaniel/maestria/commit/93ff292b83f5659b67af4889848de454d1661206) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Align Cursor packaging and native per-agent model configuration while preserving existing user settings across plugin updates.

## 0.2.2

### Patch Changes

- [#246](https://github.com/agustinusnathaniel/maestria/pull/246) [`e4b5d86`](https://github.com/agustinusnathaniel/maestria/commit/e4b5d867365aec4617fe349360e2b5f8407fb4ba) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Prefer self-explanatory code across all agent projections by emphasizing clear structure over explanatory comments and reserving comments for concise context the code cannot express.

## 0.2.1

### Patch Changes

- [#235](https://github.com/agustinusnathaniel/maestria/pull/235) [`6db422d`](https://github.com/agustinusnathaniel/maestria/commit/6db422d2b22429b52f1943fca4c9ee7374f8a5c6) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Enforce a shared human-facing output contract across all agent projections. Authored responses, comments, commits, pull request metadata, and documentation must avoid Unicode U+2014 while preserving code syntax, intentional literals, quoted source text, and user-provided text.

## 0.2.0

### Minor Changes

- [#226](https://github.com/agustinusnathaniel/maestria/pull/226) [`d0364a8`](https://github.com/agustinusnathaniel/maestria/commit/d0364a8d827e058a900bf88fd6048a21eb6efa4f) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Simplify agent directives for token efficiency. Consolidate delivery autonomy around an explicit terminal-artifact rule (reviewed changes on a pushed feature branch with an open PR), add transient-delegation-failure recovery duty, carry binding user constraints through every delegation brief, trim dead skill references into compact per-role skill catalogs, and align sync-config replace anchors with the revised canonical text.

## 0.1.10

### Patch Changes

- [#213](https://github.com/agustinusnathaniel/maestria/pull/213) [`b6f3a09`](https://github.com/agustinusnathaniel/maestria/commit/b6f3a09d1be75e6f19e1d3736f71696df44f3c6d) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Bound review and repair to material blockers, preserve narrow approval boundaries, and complete routine implementation delivery autonomously.

## 0.1.9

### Patch Changes

- [#210](https://github.com/agustinusnathaniel/maestria/pull/210) [`88cc573`](https://github.com/agustinusnathaniel/maestria/commit/88cc5738ac2b1d5c381bba58f7208498087b2bfa) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Keep normal engineering sessions autonomous through continuation, scope-frozen bounded repair, and reviewable PR delivery. Incomplete specialist work is recovered or reported as a structured blocker instead of becoming an implicit user checkpoint.

## 0.1.8

### Patch Changes

- [#199](https://github.com/agustinusnathaniel/maestria/pull/199) [`2955263`](https://github.com/agustinusnathaniel/maestria/commit/2955263a3788aea829c548bc56c7f6e7ff941637) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Agent directives now calibrate effort to task risk, prefer mature ecosystem solutions, converge reviews on material blockers, deliver routine engineering work through feature branches and PRs, and clean up task-owned background processes before completion.

## 0.1.7

### Patch Changes

- [#190](https://github.com/agustinusnathaniel/maestria/pull/190) [`96f2649`](https://github.com/agustinusnathaniel/maestria/commit/96f264911f8756ee3528277699deb96e8a1bc9d7) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Clarify agent workflow contracts while preserving detailed specialist guidance. Routine validated commits on recognized feature branches remain autonomous after required review; push and later lifecycle actions stay separately gated. Add bounded repair and platform-enforcement notes, refresh generated projections, and retain explicit mode reset behavior and read-only sonar profiles where supported.

- [#194](https://github.com/agustinusnathaniel/maestria/pull/194) [`b1c67ed`](https://github.com/agustinusnathaniel/maestria/commit/b1c67eddcb46b0633166c0af25b5bfd336a33abb) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Simplify and re-align the shared agent directives around outcome, evidence, runtime authority, blind review, bounded repair, and autonomous routine work. Directives now avoid unnecessary orchestration ceremony, allow the host runtime to determine whether work is performed directly or delegated, prevent nested supervisors from duplicating scheduling and lifecycle work, and keep all generated platform projections synchronized.

## 0.1.6

### Patch Changes

- [#185](https://github.com/agustinusnathaniel/maestria/pull/185) [`79e753c`](https://github.com/agustinusnathaniel/maestria/commit/79e753c104c72a3403aded79ee6c49ed3cb2b5fe) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Streamline canonical agent directives by centralizing universal contracts, preserving orchestration behavior in compact form, and adding bounded autonomy, work-unit budgets, scope control, process lifecycle evidence, and checkpoint action boundaries.

## 0.1.5

### Patch Changes

- [#180](https://github.com/agustinusnathaniel/maestria/pull/180) [`8d77c40`](https://github.com/agustinusnathaniel/maestria/commit/8d77c4060fab81e20083ab1d8614600adfe258ee) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Make delegation more selective, keep handoffs concise, and let Sonar research
  start with the owning specialist while adding another specialist only when a
  distinct required output remains.

## 0.1.4

### Patch Changes

- [#157](https://github.com/agustinusnathaniel/maestria/pull/157) [`906f836`](https://github.com/agustinusnathaniel/maestria/commit/906f836a96a2f53e838c29d3a9e82d5c2336ba49) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Selective routing contract in the canonical orchestrator directives.

  **Three routes** - `direct` (host executes, no Maestria specialist spawn),
  `focused` (one targeted specialist, one reviewer for non-trivial
  work), and `full` (bounded recon, design, implementation, and review). The
  full pipeline is an explicit option for complex or high-risk work and for
  explicit `fein` requests, not the universal default.

  **Route guidance by task class** - explanation and discovery default to
  direct, tiny edits to direct or native builder with no automatic recon or
  review, ordinary code changes to focused, and complex or high-risk work to
  full with independent review where the host supports it. Scaling guardrails
  bound child spawns, parallel fan-out, architect/planner use, review lenses,
  and context compaction per route; they are bounds, not measured savings.

  **Explicit mode semantics** - `fein` selects the full route, `sonar` is
  research-only and does not implement, and `blitz` is an explicit
  low-risk/direct bypass that does not waive safety floors. An explicit user
  mode is honored subject to safety constraints. No platform claims to enforce
  modes identically or provide clean isolated contexts.

  **Maker/checker preserved** - every routed `@builder` change is followed by
  `@reviewer`; where the host cannot enforce separate sessions (e.g. Kimi, Pi,
  OMP, Hermes), the split is advisory and stated as such.

  **How this affects you:** Maestria no longer routes every turn through the
  full pipeline. Small explanations and tiny edits run directly or through one
  specialist; the full pipeline stays available for complex, high-risk, or
  explicitly `fein` work. No action required on your end - your agents apply
  the route contract automatically.

## 0.1.3

### Patch Changes

- [#108](https://github.com/agustinusnathaniel/maestria/pull/108) [`a2e2b8a`](https://github.com/agustinusnathaniel/maestria/commit/a2e2b8a061749c268e30eda82be43f6b1dbaf507) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Refactored all agent directive prompts for better structure, clarity, and cross-platform consistency:
  - Restructured core prompts with clearer sections and emphasis on critical rules agents must follow
  - Added structured handoff verification checklists to all specialist agents so handoffs between agents are more reliable
  - Standardized "Before reporting done" completion checks across all agents, reducing premature sign-offs
  - Added Parallelization table for safer multi-agent task execution when builders work in parallel
  - Added Multi-Lens Review Swarm capability for comprehensive code review that catches more issues
  - Made prompt instructions platform-agnostic so agents behave consistently across OpenCode, Cursor, Kimi Code, Pi, and other platforms
  - Fixed several content gaps where important behavioral rules were compressed too aggressively

## 0.1.2

### Patch Changes

- [#106](https://github.com/agustinusnathaniel/maestria/pull/106) [`ba91d36`](https://github.com/agustinusnathaniel/maestria/commit/ba91d36ba612cd2c634e3a73071047a5f50f46b4) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Updated dependencies across packages: diff ^9.0.0, zod ^4.4.3, @clack v1.x, effect beta.100, astro 7.1.3, and more

## 0.1.1

### Patch Changes

- [#92](https://github.com/agustinusnathaniel/maestria/pull/92) [`e861360`](https://github.com/agustinusnathaniel/maestria/commit/e8613603e43315b403f87e66f428dfe4c1b62def) Thanks [@iyansr](https://github.com/iyansr)! - feat: @maestria/cursor plugin v0.1 - declarative Cursor IDE and CLI plugin

  Initial release of the Cursor platform plugin:
  - **7 specialist agents** synced from core (`agents/*.md`) with Cursor-adapted tool names (Read, Glob, Grep, StrReplace, Shell, Write)
  - **Orchestrator skill** (`skills/orchestrator/SKILL.md`) with Task-based routing, handoff contracts, and maker/checker enforcement
  - **Global rules** (`rules/maestria-global.mdc`, `alwaysApply: true`)
  - **Workflow commands** - `/fein` (full pipeline), `/sonar` (research only), `/blitz` (fast implementation)
  - **Two-layer maker/checker** - `readonly: true` runtime flag on adventurer/planner/reviewer agents blocks write tools at the Cursor runtime level, with prompt-level instructions as backup
  - **CLI support** - `maestria install cursor`, `maestria update cursor`, `maestria uninstall cursor`, `maestria check cursor` via npm (`@maestria/cursor`)
  - **Documentation** - installation guide, quick start, changelog, contributing guide, and ADR-CR-001

- [#103](https://github.com/agustinusnathaniel/maestria/pull/103) [`886dbd0`](https://github.com/agustinusnathaniel/maestria/commit/886dbd0b92256110d89f1549d7a96849950a2e82) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Sync workflow mode commands (fein/sonar/blitz) through canonical source pipeline, including Hermes

## 0.1.0

### Minor Changes

- Initial release of `@maestria/cursor` - declarative Cursor plugin for IDE and CLI.
- **7 specialist agents** synced from core (`agents/*.md`)
- **Orchestrator skill** (`skills/orchestrator/SKILL.md`) with Task-based routing
- **Global rules** (`rules/maestria-global.mdc`, `alwaysApply: true`)
- **Workflow commands** - `/fein`, `/sonar`, `/blitz`, `/orchestrate`
- CLI install: `maestria install cursor` → `~/.cursor/plugins/local/maestria`
