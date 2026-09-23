# @maestria/omp

## 0.5.14

### Patch Changes

- [#327](https://github.com/agustinusnathaniel/maestria/pull/327) [`52159b0`](https://github.com/agustinusnathaniel/maestria/commit/52159b0a901c193dbd960d1d8d000b6c29d3dd12) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Clarify delegation terminology as contract-driven delegation (historical alias Spec-Driven Delegation): spec-aware but format-agnostic handoffs with optional persistent intent refs via the spec-contract skill. Docs clarification only, no behavior change.

- [#322](https://github.com/agustinusnathaniel/maestria/pull/322) [`971ff4b`](https://github.com/agustinusnathaniel/maestria/commit/971ff4b7378ddd8654b97196cd19fce4343185ed) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add the `docs-update` methodology skill as a standalone root skill and distribute it through the existing skills CLI selection. Fresh installs default to `create-pull-request` plus `docs-update`; recorded per-platform choices (including `[]`) are preserved exactly, and updates of legacy installs without a record infer only `create-pull-request`, never silently adding the new skill. The selection record moves to version 2 only with per-skill observed source/path; reconcile, preflight, removal guards, and uninstall now operate per skill with partial successes recorded recoverably and failed skills never marked installed. Interactive update still reviews skills with final confirmation when plugins are already current. Core keeps only a short docs obligation plus the skill pointer.

- [#319](https://github.com/agustinusnathaniel/maestria/pull/319) [`05cfdfa`](https://github.com/agustinusnathaniel/maestria/commit/05cfdfa1451ab91c3ac220269776e3784919d0b2) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Load project-root `.maestria/workflow.md` then `.maestria/rules.md` as subordinate guidance on every host. OpenCode injects full fresh content on every model call through `experimental.chat.system.transform` with no restart; Pi, OMP, and Prime re-read both files on every `before_agent_start` turn from the session cwd with a notify plus STOP banner on errors; Hermes re-reads both files on every `pre_llm_call` turn with a visible error banner; declarative hosts read the project-root files with host tools when not already supplied. Absent or empty files leave defaults unchanged; present-but-unusable files never run silently. Project content may replace configurable workflows but never waives safety, authorization, or host permissions.

- [#320](https://github.com/agustinusnathaniel/maestria/pull/320) [`6430ee9`](https://github.com/agustinusnathaniel/maestria/commit/6430ee95ed03908e535e2e069e0672fda4e5eaef) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Install, update, and reconcile the `create-pull-request` methodology skill through the official `skills` CLI instead of bundling skill bodies into plugins. `install` and `update` accept `--skills` (CSV, or `none`), `--exclude-skills` (CSV), and `--yes`; per-platform selections persist only after actual success, independently installed copies are never adopted or deleted, and shared native skill directories are preserved while another owned platform still uses them. The visual-evidence procedure lives once in the root skill, with the core and integration routers pointing at it.

## 0.5.13

### Patch Changes

- [#316](https://github.com/agustinusnathaniel/maestria/pull/316) [`7a9334b`](https://github.com/agustinusnathaniel/maestria/commit/7a9334b3c020d8cbd91441e1ced33495a75b6f7a) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Restore a consistent PR delivery contract.
  
  - Titles use explicit Conventional Commits; bodies use literal ## headings in order (Summary, Changes, Verification, plus Visual evidence and Breaking changes when applicable), respecting explicit project templates.
  - Changes carries the Work Results table (File, What changed, Why); Verification carries checks, results, and unresolved gaps.
  - Pushes that change the cumulative diff or verification evidence update the PR title and body with a published-body readback. Acceptance classifies visual evidence as required or not applicable with reason, carries it through briefs, checks rendered coverage in review, reads back the published body at delivery, and treats an open PR as complete only with its applicable evidence.
  
  Also restores proportional documentation assessment: internal docs, user-facing docs, changelog/release notes, and required changesets are assessed separately, only affected categories are updated, plausible unaffected categories note a reason, and required docs carry through briefs to reconciliation.

## 0.5.12

### Patch Changes

- [#314](https://github.com/agustinusnathaniel/maestria/pull/314) [`811e6c2`](https://github.com/agustinusnathaniel/maestria/commit/811e6c25c9643ee9e8ffb04731da5cededc4ba9f) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Tighten the visual delivery evidence contract: capture, handoff, publication in the PR body, and delivery-owner readback are distinct stages. Local paths and session-log references no longer count as PR-body evidence, missing required evidence is incomplete with the checked limitation, and final reconciliation calls out PR-body evidence with readback. PR presentation stays concise and comparable without fabricated baselines, and affected evidence is refreshed with obsolete PR body references removed before delivery or re-delivery.

## 0.5.11

### Patch Changes

- [#312](https://github.com/agustinusnathaniel/maestria/pull/312) [`998a9dd`](https://github.com/agustinusnathaniel/maestria/commit/998a9dd615ada84b85c8c266415e58f10885af31) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Clarify when Sonar research is complete: each requested question needs an evidence-backed answer or a specific unresolved gap. Blitz now reuses valid context and checks, switches routes when investigation or design is needed, and continues through verification, review, and delivery.

## 0.5.10

### Patch Changes

- [#304](https://github.com/agustinusnathaniel/maestria/pull/304) [`93e4b3c`](https://github.com/agustinusnathaniel/maestria/commit/93e4b3c6fd991d3ce44dd769b95eae4d8811d560) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Clarify rendered verification and visual delivery evidence, including documentation sites, CLI output, headless capture, and unavailable uploads. Keep required artifacts and verification gaps in handoffs, reconcile accepted requirements before completion, and apply independent review to meaningful direct implementation.

## 0.5.9

### Patch Changes

- [#300](https://github.com/agustinusnathaniel/maestria/pull/300) [`7b1c09e`](https://github.com/agustinusnathaniel/maestria/commit/7b1c09e4a7c0d41ed1f418377988e37042773f94) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Internal consolidation: share the review-model context type through the private shared-pi review core, drop the redundant omp agent-source guard (the shared core already handles it), and delegate prime-agent mode keywords, markers, and skill-section extraction to the private shared-mode package. No user-facing behavior change; generated agent and skill output is unchanged.

## 0.5.8

### Patch Changes

- [#293](https://github.com/agustinusnathaniel/maestria/pull/293) [`5e3046e`](https://github.com/agustinusnathaniel/maestria/commit/5e3046ee97c9223c8a184aa6ad63a33b52286c94) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Internal consolidation: share more host seams with the private shared packages and remove dead adapters, barrels, and exports. No user-facing behavior change; generated agent and skill output is unchanged.

## 0.5.7

### Patch Changes

- [#282](https://github.com/agustinusnathaniel/maestria/pull/282) [`2394993`](https://github.com/agustinusnathaniel/maestria/commit/239499367ab8abc3094be5800c0ad61f86e388b6) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Stop publishing generated JavaScript sourcemaps from the CLI and platform packages to reduce published package sizes while keeping the compiled runtime artifacts unchanged.

## 0.5.6

### Patch Changes

- [#281](https://github.com/agustinusnathaniel/maestria/pull/281) [`5c5729b`](https://github.com/agustinusnathaniel/maestria/commit/5c5729b0f70d54f4181b2a5a2f1aad87fe0a92af) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Fix stale skill references so prescribed skills resolve at load time: planner skill guidance no longer names the removed `to-issues` and `to-prd` skills, and the duplicated Kimi orchestrator skill prescription (which restated canonical skill governance and drifted stale) is removed so `sync.config.ts` only adapts toward the plugin runtime. Clarify in the orchestrator's Role-Based Pipeline that `@diagnose` analyzes the bug, applies the minimal fix, and verifies the repair instead of grouping it with analyze-only thinkers. Correct the canonical agent-directives README index to count 8 pipeline agents (orchestrator + 7 specialists) and list `orchestrator.md`.

- [#280](https://github.com/agustinusnathaniel/maestria/pull/280) [`7c038cd`](https://github.com/agustinusnathaniel/maestria/commit/7c038cd28448149f4154510ee0866f0a3ef523f8) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Make agent investigation, verification, skill loading, and output structure proportional to the task. Preserve complete assignment ownership and delivery, allow necessary in-scope regression coverage, and keep downstream instructions independent of Maestria repository paths.

## 0.5.5

### Patch Changes

- [#275](https://github.com/agustinusnathaniel/maestria/pull/275) [`56351de`](https://github.com/agustinusnathaniel/maestria/commit/56351debf73a97c24eb10826517e0d9aabeaca6b) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Refine specialist engineering judgment around trust-boundary normalization, feature-local seams, shared-interface compatibility, executable sources of truth, staged migrations, durable diagnostic knowledge, and operational documentation.

## 0.5.4

### Patch Changes

- [#269](https://github.com/agustinusnathaniel/maestria/pull/269) [`ef07bf7`](https://github.com/agustinusnathaniel/maestria/commit/ef07bf78a8e5f676c76b55680301bc7c839b68a9) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add conditional visual-evidence guidance for PR delivery: confirm the project targets GitHub with authenticated gh --attach support and an available capture tool before attaching a screenshot or short video for visual or behavioral changes. Vision is optional verification only, not a precondition.

- [#269](https://github.com/agustinusnathaniel/maestria/pull/269) [`ef07bf7`](https://github.com/agustinusnathaniel/maestria/commit/ef07bf78a8e5f676c76b55680301bc7c839b68a9) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add a global testing-judgment rule (test artifacts are opt-in, behavior over implementation shape, mocks only at external seams) and align reviewer and diagnose guidance with it.

## 0.5.3

### Patch Changes

- [#250](https://github.com/agustinusnathaniel/maestria/pull/250) [`085f7fe`](https://github.com/agustinusnathaniel/maestria/commit/085f7fe61263aedf458a8a14d518e4f1c15bf675) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Share neutral mode and skill validation logic through the hybrid package topology.

## 0.5.2

### Patch Changes

- [#246](https://github.com/agustinusnathaniel/maestria/pull/246) [`e4b5d86`](https://github.com/agustinusnathaniel/maestria/commit/e4b5d867365aec4617fe349360e2b5f8407fb4ba) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Prefer self-explanatory code across all agent projections by emphasizing clear structure over explanatory comments and reserving comments for concise context the code cannot express.

## 0.5.1

### Patch Changes

- [#235](https://github.com/agustinusnathaniel/maestria/pull/235) [`6db422d`](https://github.com/agustinusnathaniel/maestria/commit/6db422d2b22429b52f1943fca4c9ee7374f8a5c6) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Enforce a shared human-facing output contract across all agent projections. Authored responses, comments, commits, pull request metadata, and documentation must avoid Unicode U+2014 while preserving code syntax, intentional literals, quoted source text, and user-provided text.

## 0.5.0

### Minor Changes

- [#226](https://github.com/agustinusnathaniel/maestria/pull/226) [`d0364a8`](https://github.com/agustinusnathaniel/maestria/commit/d0364a8d827e058a900bf88fd6048a21eb6efa4f) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Simplify agent directives for token efficiency. Consolidate delivery autonomy around an explicit terminal-artifact rule (reviewed changes on a pushed feature branch with an open PR), add transient-delegation-failure recovery duty, carry binding user constraints through every delegation brief, trim dead skill references into compact per-role skill catalogs, and align sync-config replace anchors with the revised canonical text.

## 0.4.5

### Patch Changes

- [#213](https://github.com/agustinusnathaniel/maestria/pull/213) [`b6f3a09`](https://github.com/agustinusnathaniel/maestria/commit/b6f3a09d1be75e6f19e1d3736f71696df44f3c6d) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Bound review and repair to material blockers, preserve narrow approval boundaries, and complete routine implementation delivery autonomously.

## 0.4.4

### Patch Changes

- [#210](https://github.com/agustinusnathaniel/maestria/pull/210) [`88cc573`](https://github.com/agustinusnathaniel/maestria/commit/88cc5738ac2b1d5c381bba58f7208498087b2bfa) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Keep normal engineering sessions autonomous through continuation, scope-frozen bounded repair, and reviewable PR delivery. Incomplete specialist work is recovered or reported as a structured blocker instead of becoming an implicit user checkpoint.

## 0.4.3

### Patch Changes

- [#199](https://github.com/agustinusnathaniel/maestria/pull/199) [`2955263`](https://github.com/agustinusnathaniel/maestria/commit/2955263a3788aea829c548bc56c7f6e7ff941637) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Agent directives now calibrate effort to task risk, prefer mature ecosystem solutions, converge reviews on material blockers, deliver routine engineering work through feature branches and PRs, and clean up task-owned background processes before completion.

## 0.4.2

### Patch Changes

- [#192](https://github.com/agustinusnathaniel/maestria/pull/192) [`512b6b8`](https://github.com/agustinusnathaniel/maestria/commit/512b6b81925349d64a4be60498150e5a328807c0) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix: restore orchestrator autonomy while keeping maker/checker split

  The pure-dispatcher enforcement blocked ALL orchestrator tools (read,
  grep, bash, edit) when a workflow mode was active. When specialist
  dispatch timed out or the model omitted the agent name, the orchestrator
  had zero fallback and aborted - the reported "lacks autonomy, behaves
  weirdly" symptom.
  - Orchestrator regains read-only tools (read, glob, grep, lsp, webfetch,
    read-only bash, tests) for routing and verification; mutations remain
    denied and delegated.
  - Dispatch failure is no longer an idle state: one corrected-brief retry,
    then read-only recon + precise blocked-state reporting. Never mutates
    directly, never waives route/review floors.
  - maestria_subagent now requires `agent` and `task` and returns an
    actionable message listing valid agents instead of throwing an opaque
    "Unknown agent: undefined".
  - Subagent poll timeout raised 60s -> 180s.
  - OpenCode projection: orchestrator permission frontmatter updated to
    allow read-only tools; sync regenerated all platform projections.

- [#190](https://github.com/agustinusnathaniel/maestria/pull/190) [`96f2649`](https://github.com/agustinusnathaniel/maestria/commit/96f264911f8756ee3528277699deb96e8a1bc9d7) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Clarify agent workflow contracts while preserving detailed specialist guidance. Routine validated commits on recognized feature branches remain autonomous after required review; push and later lifecycle actions stay separately gated. Add bounded repair and platform-enforcement notes, refresh generated projections, and retain explicit mode reset behavior and read-only sonar profiles where supported.

- [#194](https://github.com/agustinusnathaniel/maestria/pull/194) [`b1c67ed`](https://github.com/agustinusnathaniel/maestria/commit/b1c67eddcb46b0633166c0af25b5bfd336a33abb) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Simplify and re-align the shared agent directives around outcome, evidence, runtime authority, blind review, bounded repair, and autonomous routine work. Directives now avoid unnecessary orchestration ceremony, allow the host runtime to determine whether work is performed directly or delegated, prevent nested supervisors from duplicating scheduling and lifecycle work, and keep all generated platform projections synchronized.

- [#187](https://github.com/agustinusnathaniel/maestria/pull/187) [`2479f32`](https://github.com/agustinusnathaniel/maestria/commit/2479f32886ec033ed545a576e0175f9e3ffe64a2) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix: record file reads/edits and specialist delegation in session state

## 0.4.1

### Patch Changes

- [#185](https://github.com/agustinusnathaniel/maestria/pull/185) [`79e753c`](https://github.com/agustinusnathaniel/maestria/commit/79e753c104c72a3403aded79ee6c49ed3cb2b5fe) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Streamline canonical agent directives by centralizing universal contracts, preserving orchestration behavior in compact form, and adding bounded autonomy, work-unit budgets, scope control, process lifecycle evidence, and checkpoint action boundaries.

## 0.4.0

### Minor Changes

- [#175](https://github.com/agustinusnathaniel/maestria/pull/175) [`6f21b47`](https://github.com/agustinusnathaniel/maestria/commit/6f21b47e4c3e03353163ad4f83e49a227a798687) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Mirror OMP's native goal state into Maestria session state by observing the
  public goal events. Goal lifecycle transitions are handled safely across
  session switches, branches, tree navigation, and restoration, using valid
  public mode data or resetting to unknown when no trustworthy event exists.

  Model goal-tool behavior remains fail-closed when native tool provenance cannot
  be established. Maestria does not activate native goal mode or invoke OMP goal
  commands.

### Patch Changes

- [#180](https://github.com/agustinusnathaniel/maestria/pull/180) [`8d77c40`](https://github.com/agustinusnathaniel/maestria/commit/8d77c4060fab81e20083ab1d8614600adfe258ee) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Make delegation more selective, keep handoffs concise, and let Sonar research
  start with the owning specialist while adding another specialist only when a
  distinct required output remains.

## 0.3.2

### Patch Changes

- [#171](https://github.com/agustinusnathaniel/maestria/pull/171) [`d4d6f44`](https://github.com/agustinusnathaniel/maestria/commit/d4d6f44ea5ef7657727016e5e91f5bb0b33595e5) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - handoff skill now documents the 7-field contract (including Assumptions documented); handoff and iteration-limits skills are generated from canonical sources in @maestria/core

- [#169](https://github.com/agustinusnathaniel/maestria/pull/169) [`d219a87`](https://github.com/agustinusnathaniel/maestria/commit/d219a87394c87bf9b680ef59395cb6eb96a3e0f5) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Align `/handoff` command output with the 7-field `HANDOFF_FIELDS` contract.

  The shared handoff validator (`@maestria/shared-pi/subagent-utils`) already required 7 fields including **Assumptions documented**, but the `/handoff` command in `pi` and `omp` still generated a 6-field prompt - so handoffs produced by the command could fail validation. The command now emits the **Assumptions documented** section (with `[inferred]` tagging guidance) before Success criteria, matching the validator and the handoff SKILL.md contract.

## 0.3.1

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

## 0.3.0

### Minor Changes

- [#145](https://github.com/agustinusnathaniel/maestria/pull/145) [`ea3d492`](https://github.com/agustinusnathaniel/maestria/commit/ea3d4920f4d01298c9decbd3dfc80551c82bcbf3) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Enforce pure dispatcher pattern on Pi and OMP with auto-detect mode keywords
  - **Pure dispatcher enforcement**: when a workflow mode (fein/sonar/blitz) is active, the orchestrator is now restricted to only delegation tools (`maestria_subagent`/`task`). Implementation tools like `bash`, `edit`, and `write` are blocked at the tool level, enforcing the maker/checker split automatically.
  - **Auto-detect mode keywords**: type `fein do X` at the start of any message and the plugin automatically strips the keyword and injects the mode prompt inline. No slash command needed.
  - **Refactor Pi and OMP plugins** to share common infrastructure behind the scenes, ensuring consistent behavior across both platforms.

## 0.2.8

### Patch Changes

- [#138](https://github.com/agustinusnathaniel/maestria/pull/138) [`28f1520`](https://github.com/agustinusnathaniel/maestria/commit/28f15209400e79a7691c923fa63188861199e624) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Move @maestria/shared-pi to devDependencies

  Reclassify the internal `@maestria/shared-pi` dependency from `dependencies` to
  `devDependencies` in both the pi and omp packages. This shared package is bundled
  into `dist/extension.mjs` at build time and is never published to npm.

  **Why this matters:** Without this fix, users updating pi or omp encounter npm
  install failures because `@maestria/shared-pi` is a private package. This is
  solely a dependency classification fix - no behavioral change for end users.

## 0.2.7

### Patch Changes

- [#136](https://github.com/agustinusnathaniel/maestria/pull/136) [`0bee77c`](https://github.com/agustinusnathaniel/maestria/commit/0bee77ca5d09b3f4000795d761eda473ec12d4bc) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Rule-override conditions and communication conventions for agent directives.

  **When to Break the Rules** - Added 6 explicit override conditions to the
  orchestrator prompt (user skip request, safety, mode override, frustration
  escalation, rule conflicts, explanation requests). This prevents rule
  rigidity by documenting when and how to deviate from defaults.

  **Communication conventions** - Two new shared rules adopted from
  established communication practice: report errors matter-of-factly
  (state problem, cause, and fix without hedging or drama) and lead with
  the action (first line actionable, context follows).

  **Review-commit handoff** - Review Triage now chains directly into the
  commit flow after approval (guarded against unresolved `[fix]` and
  `[escalate]` items), replacing the separate "Stop & Report" step.

  **How this affects you:** Agents now have clearer guidance on when to
  flex the rules and how to communicate. Error messages are more direct.
  Responses lead with something actionable rather than preamble. No action
  required on your end - your agents handle the new conventions automatically.

## 0.2.6

### Patch Changes

- [#129](https://github.com/agustinusnathaniel/maestria/pull/129) [`7dc3df1`](https://github.com/agustinusnathaniel/maestria/commit/7dc3df17dce1707b80a018437bbf0c263c106bc0) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Blind review and fail-loud iteration exit for the review protocol.

  **Blind review** - The reviewer agent no longer receives the builder's
  handoff notes or self-assessment. It now evaluates only the diff,
  requirements, and acceptance criteria. This removes a bias: the reviewer
  was previously primed by the builder's own narrative about what changed,
  rather than judging the code against the spec directly.

  **Fail-loud iteration exit** - When the review loop runs 3 cycles with
  unresolved issues, instead of silently documenting the gap and proceeding,
  the pipeline now stops and escalates. It produces a structured report of
  what's still blocking and requires your explicit override to continue.

  **How this affects you:** Reviews are more objective now. If a review
  stalls, you'll get a clear report of what's blocking it rather than a
  quiet pass. No action required on your end - your agents handle the new
  protocol automatically.

## 0.2.5

### Patch Changes

- [#133](https://github.com/agustinusnathaniel/maestria/pull/133) [`8ed34dd`](https://github.com/agustinusnathaniel/maestria/commit/8ed34ddbbe42b1bfe8b8dda8a91f61ac779a078a) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Extract shared state-core module (state types, transforms, persistence, review, render) and agent-deployment utilities from OMP and PI into @maestria/shared-pi. Deepen OMP and PI monolithic state modules into focused sub-modules with clear separation of concerns.

- Updated dependencies [[`8ed34dd`](https://github.com/agustinusnathaniel/maestria/commit/8ed34ddbbe42b1bfe8b8dda8a91f61ac779a078a)]:
  - @maestria/shared-pi@0.2.0

## 0.2.4

### Patch Changes

- [#120](https://github.com/agustinusnathaniel/maestria/pull/120) [`5c18e3c`](https://github.com/agustinusnathaniel/maestria/commit/5c18e3c6abb32a439a6ae705422f2ab3ce2c305d) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix: remove npm: prefix from omp package specifiers to avoid bun self-alias dependency loop

## 0.2.3

### Patch Changes

- [#108](https://github.com/agustinusnathaniel/maestria/pull/108) [`a2e2b8a`](https://github.com/agustinusnathaniel/maestria/commit/a2e2b8a061749c268e30eda82be43f6b1dbaf507) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Refactored all agent directive prompts for better structure, clarity, and cross-platform consistency:
  - Restructured core prompts with clearer sections and emphasis on critical rules agents must follow
  - Added structured handoff verification checklists to all specialist agents so handoffs between agents are more reliable
  - Standardized "Before reporting done" completion checks across all agents, reducing premature sign-offs
  - Added Parallelization table for safer multi-agent task execution when builders work in parallel
  - Added Multi-Lens Review Swarm capability for comprehensive code review that catches more issues
  - Made prompt instructions platform-agnostic so agents behave consistently across OpenCode, Cursor, Kimi Code, Pi, and other platforms
  - Fixed several content gaps where important behavioral rules were compressed too aggressively

## 0.2.2

### Patch Changes

- [#113](https://github.com/agustinusnathaniel/maestria/pull/113) [`183b4b8`](https://github.com/agustinusnathaniel/maestria/commit/183b4b8e11f39298e8236b24d22747de02a917c6) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: defer module-level file I/O to prevent fatal-yet-silent plugin loading failures

  Module-level readFileSync and homedir() calls across opencode, pi, and omp
  platforms could crash the entire plugin at import time if files were missing
  or the runtime lacked the required API (e.g., findPackageJSON in Bun).

  Changes:
  - opencode: lazy-load mode prompts via Proxy with error fallback
  - pi/omp: lazy-load mode prompts via getModePrompt() cache
  - pi/omp: defer homedir() from module scope to function body
  - opencode: add import-from-dist smoke test
  - CI: add Bun smoke test job to catch runtime incompatibilities early

## 0.2.1

### Patch Changes

- [#106](https://github.com/agustinusnathaniel/maestria/pull/106) [`ba91d36`](https://github.com/agustinusnathaniel/maestria/commit/ba91d36ba612cd2c634e3a73071047a5f50f46b4) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Updated dependencies across packages: diff ^9.0.0, zod ^4.4.3, @clack v1.x, effect beta.100, astro 7.1.3, and more

## 0.2.0

### Minor Changes

- [#104](https://github.com/agustinusnathaniel/maestria/pull/104) [`040f23a`](https://github.com/agustinusnathaniel/maestria/commit/040f23ad223a455b8095cb1edc9dca0a7a0a1fc7) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - feat: add Oh My Pi (omp) platform plugin

  New `@maestria/omp` package adds maestria support for the Oh My Pi coding agent:
  - 7 specialist agents (adventurer, architect, builder, diagnose, planner, reviewer, writer)
  - Workflow mode commands: /fein, /sonar, /blitz
  - Review mode with tool blocking and dangerous pattern detection
  - Session state tracking and compaction preservation
  - Structured handoff via /handoff command
  - CLI integration: `maestria install omp`, `maestria update omp`
  - Agent methodology synced from canonical core source
