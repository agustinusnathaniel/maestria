# @maestria/prime-agent

## 0.3.15

### Patch Changes

- [#347](https://github.com/agustinusnathaniel/maestria/pull/347) [`14fb301`](https://github.com/agustinusnathaniel/maestria/commit/14fb301aaf9410baf809922797eb2f25146482d4) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Adopt behavior-first testing guidance across the generated Maestria methodology. Reject tautological and change-detector tests, require pre-code test selection, prefer E2E artifacts for complex features, and record failure-mode inventories before isolated-system implementation.

- [#346](https://github.com/agustinusnathaniel/maestria/pull/346) [`b3aa378`](https://github.com/agustinusnathaniel/maestria/commit/b3aa378700cf327ea702376e5fd475d99213bb4a) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Guide agents to commit verified implementation slices, plan reviewable PR boundaries early, and present architect or planner designs to users before dependent implementation.

## 0.3.14

### Patch Changes

- [#343](https://github.com/agustinusnathaniel/maestria/pull/343) [`ec3c94d`](https://github.com/agustinusnathaniel/maestria/commit/ec3c94d47663d3fb339ee249869071ea7795ac17) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Use the same project customization loader across the Node integrations, keeping workflow/rules ordering, live reloads, symlink checks, and error reporting consistent. Existing configuration and host behavior are unchanged.

## 0.3.13

### Patch Changes

- [#322](https://github.com/agustinusnathaniel/maestria/pull/322) [`971ff4b`](https://github.com/agustinusnathaniel/maestria/commit/971ff4b7378ddd8654b97196cd19fce4343185ed) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add the `docs-update` methodology skill as a standalone root skill and distribute it through the existing skills CLI selection. Fresh installs default to `create-pull-request` plus `docs-update`; recorded per-platform choices (including `[]`) are preserved exactly, and updates of legacy installs without a record infer only `create-pull-request`, never silently adding the new skill. The selection record moves to version 2 only with per-skill observed source/path; reconcile, preflight, removal guards, and uninstall now operate per skill with partial successes recorded recoverably and failed skills never marked installed. Interactive update still reviews skills with final confirmation when plugins are already current. Core keeps only a short docs obligation plus the skill pointer.

- [#319](https://github.com/agustinusnathaniel/maestria/pull/319) [`05cfdfa`](https://github.com/agustinusnathaniel/maestria/commit/05cfdfa1451ab91c3ac220269776e3784919d0b2) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Load project-root `.maestria/workflow.md` then `.maestria/rules.md` as subordinate guidance on every host. OpenCode injects full fresh content on every model call through `experimental.chat.system.transform` with no restart; Pi, OMP, and Prime re-read both files on every `before_agent_start` turn from the session cwd with a notify plus STOP banner on errors; Hermes re-reads both files on every `pre_llm_call` turn with a visible error banner; declarative hosts read the project-root files with host tools when not already supplied. Absent or empty files leave defaults unchanged; present-but-unusable files never run silently. Project content may replace configurable workflows but never waives safety, authorization, or host permissions.

- [#320](https://github.com/agustinusnathaniel/maestria/pull/320) [`6430ee9`](https://github.com/agustinusnathaniel/maestria/commit/6430ee95ed03908e535e2e069e0672fda4e5eaef) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Install, update, and reconcile the `create-pull-request` methodology skill through the official `skills` CLI instead of bundling skill bodies into plugins. `install` and `update` accept `--skills` (CSV, or `none`), `--exclude-skills` (CSV), and `--yes`; per-platform selections persist only after actual success, independently installed copies are never adopted or deleted, and shared native skill directories are preserved while another owned platform still uses them. The visual-evidence procedure lives once in the root skill, with the core and integration routers pointing at it.

## 0.3.12

### Patch Changes

- [#316](https://github.com/agustinusnathaniel/maestria/pull/316) [`7a9334b`](https://github.com/agustinusnathaniel/maestria/commit/7a9334b3c020d8cbd91441e1ced33495a75b6f7a) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Restore a consistent PR delivery contract.
  
  - Titles use explicit Conventional Commits; bodies use literal ## headings in order (Summary, Changes, Verification, plus Visual evidence and Breaking changes when applicable), respecting explicit project templates.
  - Changes carries the Work Results table (File, What changed, Why); Verification carries checks, results, and unresolved gaps.
  - Pushes that change the cumulative diff or verification evidence update the PR title and body with a published-body readback. Acceptance classifies visual evidence as required or not applicable with reason, carries it through briefs, checks rendered coverage in review, reads back the published body at delivery, and treats an open PR as complete only with its applicable evidence.
  
  Also restores proportional documentation assessment: internal docs, user-facing docs, changelog/release notes, and required changesets are assessed separately, only affected categories are updated, plausible unaffected categories note a reason, and required docs carry through briefs to reconciliation.

## 0.3.11

### Patch Changes

- [#314](https://github.com/agustinusnathaniel/maestria/pull/314) [`811e6c2`](https://github.com/agustinusnathaniel/maestria/commit/811e6c25c9643ee9e8ffb04731da5cededc4ba9f) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Tighten the visual delivery evidence contract: capture, handoff, publication in the PR body, and delivery-owner readback are distinct stages. Local paths and session-log references no longer count as PR-body evidence, missing required evidence is incomplete with the checked limitation, and final reconciliation calls out PR-body evidence with readback. PR presentation stays concise and comparable without fabricated baselines, and affected evidence is refreshed with obsolete PR body references removed before delivery or re-delivery.

## 0.3.10

### Patch Changes

- [#312](https://github.com/agustinusnathaniel/maestria/pull/312) [`998a9dd`](https://github.com/agustinusnathaniel/maestria/commit/998a9dd615ada84b85c8c266415e58f10885af31) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Clarify when Sonar research is complete: each requested question needs an evidence-backed answer or a specific unresolved gap. Blitz now reuses valid context and checks, switches routes when investigation or design is needed, and continues through verification, review, and delivery.

## 0.3.9

### Patch Changes

- [#304](https://github.com/agustinusnathaniel/maestria/pull/304) [`93e4b3c`](https://github.com/agustinusnathaniel/maestria/commit/93e4b3c6fd991d3ce44dd769b95eae4d8811d560) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Clarify rendered verification and visual delivery evidence, including documentation sites, CLI output, headless capture, and unavailable uploads. Keep required artifacts and verification gaps in handoffs, reconcile accepted requirements before completion, and apply independent review to meaningful direct implementation.

## 0.3.8

### Patch Changes

- [#300](https://github.com/agustinusnathaniel/maestria/pull/300) [`7b1c09e`](https://github.com/agustinusnathaniel/maestria/commit/7b1c09e4a7c0d41ed1f418377988e37042773f94) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Internal consolidation: share the review-model context type through the private shared-pi review core, drop the redundant omp agent-source guard (the shared core already handles it), and delegate prime-agent mode keywords, markers, and skill-section extraction to the private shared-mode package. No user-facing behavior change; generated agent and skill output is unchanged.

## 0.3.7

### Patch Changes

- [#293](https://github.com/agustinusnathaniel/maestria/pull/293) [`5e3046e`](https://github.com/agustinusnathaniel/maestria/commit/5e3046ee97c9223c8a184aa6ad63a33b52286c94) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Internal consolidation: share more host seams with the private shared packages and remove dead adapters, barrels, and exports. No user-facing behavior change; generated agent and skill output is unchanged.

## 0.3.6

### Patch Changes

- [#282](https://github.com/agustinusnathaniel/maestria/pull/282) [`2394993`](https://github.com/agustinusnathaniel/maestria/commit/239499367ab8abc3094be5800c0ad61f86e388b6) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Stop publishing generated JavaScript sourcemaps from the CLI and platform packages to reduce published package sizes while keeping the compiled runtime artifacts unchanged.

## 0.3.5

### Patch Changes

- [#278](https://github.com/agustinusnathaniel/maestria/pull/278) [`c770954`](https://github.com/agustinusnathaniel/maestria/commit/c7709544f12393c98fa44b966cafc452a0aa5f84) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Clarify installation paths, prerequisites, and support boundaries in package documentation. Separate contributor validation from user setup and remove stale pre-release wording.

- [#281](https://github.com/agustinusnathaniel/maestria/pull/281) [`5c5729b`](https://github.com/agustinusnathaniel/maestria/commit/5c5729b0f70d54f4181b2a5a2f1aad87fe0a92af) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Fix stale skill references so prescribed skills resolve at load time: planner skill guidance no longer names the removed `to-issues` and `to-prd` skills, and the duplicated Kimi orchestrator skill prescription (which restated canonical skill governance and drifted stale) is removed so `sync.config.ts` only adapts toward the plugin runtime. Clarify in the orchestrator's Role-Based Pipeline that `@diagnose` analyzes the bug, applies the minimal fix, and verifies the repair instead of grouping it with analyze-only thinkers. Correct the canonical agent-directives README index to count 8 pipeline agents (orchestrator + 7 specialists) and list `orchestrator.md`.

- [#280](https://github.com/agustinusnathaniel/maestria/pull/280) [`7c038cd`](https://github.com/agustinusnathaniel/maestria/commit/7c038cd28448149f4154510ee0866f0a3ef523f8) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Make agent investigation, verification, skill loading, and output structure proportional to the task. Preserve complete assignment ownership and delivery, allow necessary in-scope regression coverage, and keep downstream instructions independent of Maestria repository paths.

## 0.3.4

### Patch Changes

- [#275](https://github.com/agustinusnathaniel/maestria/pull/275) [`56351de`](https://github.com/agustinusnathaniel/maestria/commit/56351debf73a97c24eb10826517e0d9aabeaca6b) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Refine specialist engineering judgment around trust-boundary normalization, feature-local seams, shared-interface compatibility, executable sources of truth, staged migrations, durable diagnostic knowledge, and operational documentation.

## 0.3.3

### Patch Changes

- [#269](https://github.com/agustinusnathaniel/maestria/pull/269) [`ef07bf7`](https://github.com/agustinusnathaniel/maestria/commit/ef07bf78a8e5f676c76b55680301bc7c839b68a9) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add conditional visual-evidence guidance for PR delivery: confirm the project targets GitHub with authenticated gh --attach support and an available capture tool before attaching a screenshot or short video for visual or behavioral changes. Vision is optional verification only, not a precondition.

- [#269](https://github.com/agustinusnathaniel/maestria/pull/269) [`ef07bf7`](https://github.com/agustinusnathaniel/maestria/commit/ef07bf78a8e5f676c76b55680301bc7c839b68a9) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add a global testing-judgment rule (test artifacts are opt-in, behavior over implementation shape, mocks only at external seams) and align reviewer and diagnose guidance with it.

## 0.3.2

### Patch Changes

- [#246](https://github.com/agustinusnathaniel/maestria/pull/246) [`e4b5d86`](https://github.com/agustinusnathaniel/maestria/commit/e4b5d867365aec4617fe349360e2b5f8407fb4ba) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Prefer self-explanatory code across all agent projections by emphasizing clear structure over explanatory comments and reserving comments for concise context the code cannot express.

## 0.3.1

### Patch Changes

- [#235](https://github.com/agustinusnathaniel/maestria/pull/235) [`6db422d`](https://github.com/agustinusnathaniel/maestria/commit/6db422d2b22429b52f1943fca4c9ee7374f8a5c6) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Enforce a shared human-facing output contract across all agent projections. Authored responses, comments, commits, pull request metadata, and documentation must avoid Unicode U+2014 while preserving code syntax, intentional literals, quoted source text, and user-provided text.

## 0.3.0

### Minor Changes

- [#226](https://github.com/agustinusnathaniel/maestria/pull/226) [`d0364a8`](https://github.com/agustinusnathaniel/maestria/commit/d0364a8d827e058a900bf88fd6048a21eb6efa4f) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Simplify agent directives for token efficiency. Consolidate delivery autonomy around an explicit terminal-artifact rule (reviewed changes on a pushed feature branch with an open PR), add transient-delegation-failure recovery duty, carry binding user constraints through every delegation brief, trim dead skill references into compact per-role skill catalogs, and align sync-config replace anchors with the revised canonical text.

## 0.2.2

### Patch Changes

- [#213](https://github.com/agustinusnathaniel/maestria/pull/213) [`b6f3a09`](https://github.com/agustinusnathaniel/maestria/commit/b6f3a09d1be75e6f19e1d3736f71696df44f3c6d) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Bound review and repair to material blockers, preserve narrow approval boundaries, and complete routine implementation delivery autonomously.

## 0.2.1

### Patch Changes

- [#210](https://github.com/agustinusnathaniel/maestria/pull/210) [`88cc573`](https://github.com/agustinusnathaniel/maestria/commit/88cc5738ac2b1d5c381bba58f7208498087b2bfa) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Keep normal engineering sessions autonomous through continuation, scope-frozen bounded repair, and reviewable PR delivery. Incomplete specialist work is recovered or reported as a structured blocker instead of becoming an implicit user checkpoint.

## 0.2.0

### Minor Changes

- [#203](https://github.com/agustinusnathaniel/maestria/pull/203) [`5d0f411`](https://github.com/agustinusnathaniel/maestria/commit/5d0f41176c2a1868d022896ea32e67dad0c00fbe) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add `@maestria/prime-agent`: a package delivering the Maestria methodology for Prime Agent as standard Agent Skills - 7 specialist roles, orchestrator, global-rules, handoff and iteration-limits aids, and fein/sonar/blitz workflow modes - generated from the canonical directives by the root sync pipeline (`skills/<name>/SKILL.md` with required `name`/`description` frontmatter) - plus a small, verified Prime/Pi extension (`dist/extension.mjs`, `pi.extensions`) covering workflow-mode slash commands (`/fein`, `/sonar`, `/blitz`, `/mode-clear`, `/maestria-status`) and `before_agent_start` mode prompt injection with session-scoped mode state (custom session entries, no filesystem writes). Prime Agent evidence was re-verified on 2026-08-13 at immutable upstream commit `7787f07415d843b9a800f6a4720e0c739bd608e5` (see ADR-CORE-014 and the runtime support matrix): the extension uses only the public extension API of the pinned fork, performs no tool interception, and has no runtime dependency on pi packages (the Prime-compatible fork version is unpublished on npm). Native recursive-subagent (`rlm`) dispatch and JSON/RPC headless mode remain deferred - the pinned fork exposes no public JS extension bridge for `rlm` - and no sandbox/enforcement claim is made.

### Patch Changes

- [#205](https://github.com/agustinusnathaniel/maestria/pull/205) [`ca061e4`](https://github.com/agustinusnathaniel/maestria/commit/ca061e423dccf5dbe9728e291d2e943fa3deedc0) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Reuse the npm pack dry-run result across package assertions so the packaging tests do not exceed Vitest's per-test timeout.
