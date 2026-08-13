# ADR-CORE-014: Flue 2.0 as a Maestria Meta-Agent Runtime

## Status

Proposed (2026-08-04)

## Context

Maestria has two related but separate agent systems:

1. The interactive pipeline of one orchestrator and seven specialists. Its canonical directives live in `packages/core/agent-directives/` and are rendered into platform packages by the sync pipeline.
2. The planned meta-agent, which maintains the repository, runs quality checks, ships releases, and proposes improvements through GitHub Actions.

The current meta-agent plans deliberately use GitHub Actions, shell scripts, TypeScript utilities, and the existing monorepo toolchain. They do not require a separate agent runtime. The current plans are the baseline for this decision; an older historical proposal selected Flue before the plans were rewritten around canonical-source-sync.

Flue 2.0 is now its first stable release. The official Flue documentation describes a TypeScript runtime built around dynamic agent functions and composable hooks, including `useModel()`, `useTool()`, `useSkill()`, `useSubagent()`, `useSandbox()`, `useMcpConnection()`, `usePersistentState()`, and lifecycle hooks. A Flue agent is a capitalized function in a module marked `'use agent';`, and the function name is its durable identity. Local and CI execution use `flue run <file> --message "..."`. Hosted applications use Vite, the `flue()` plugin, and a Hono router, targeting Node.js or Cloudflare. Flue 2.0 removes the prior static `defineAgent()` and `defineWorkflow()` surfaces. [verified]

Flue is attractive for model-driven maintenance and learning because it has first-class tools, skills, subagents, durable conversations, and persistent state. It also introduces a new runtime, a Pi-based provider/runtime dependency, TypeScript agent modules, a Vite/Hono deployment shape for hosted use, and a first-stable ecosystem that needs operational evidence before becoming a foundation. The release announcement reports 200+ fixes and improvements, but that fact alone does not establish production maturity for Maestria's workload. [verified]

The decision must preserve these constraints:

- Core directives remain platform-agnostic. Flue-specific hooks and module syntax cannot enter `packages/core/agent-directives/`.
- Canonical-source-sync remains the critical data flow. A Flue experiment must not create a second source of truth or bypass `scripts/sync-all` and `scripts/check-sync`.
- The maker/checker split and PR approval boundary must remain explicit. Flue's `useSubagent()` capability must not be treated as read-only enforcement until its permission and isolation behavior is verified against the installed version.
- The current meta-agent operations are primarily deterministic repository commands. Introducing an LLM runtime is justified only where model reasoning, dynamic capabilities, or durable conversational state solve a demonstrated need.
- The decision is reversible if Flue is added as an isolated, optional target. Replacing the current runner would be a substantially less reversible architectural change.

## Decision

Retain **GitHub Actions plus the existing shell and TypeScript tooling as the meta-agent runtime**. Do not replace the current runner with Flue 2.0 and do not make Flue a dependency of the current maintenance, shipping, or self-improvement plans.

Treat Flue 2.0 as a **future optional platform target**, not as the meta-agent substrate. A separate Flue adapter may be proposed later if a concrete requirement emerges for Flue-native agents, dynamic hook composition, or durable agent conversations. Such an adapter must be additive and must satisfy a bounded spike before implementation:

1. Pin and verify the Flue version and the exact `useSubagent()`, tool, skill, sandbox, state, and CI behaviors required by the adapter.
2. Keep all methodology prose in `packages/core/agent-directives/`. The adapter may generate Flue TypeScript wrappers or modules from canonical Markdown, but it must not make TypeScript the canonical content format.
3. Add a Flue-owned sync configuration or renderer rather than modifying the core sync semantics for one platform. `scripts/check-sync` must cover the new output and remain a blocking gate.
4. Prove that each of the eight canonical agent identities can be represented without losing handoff contracts, iteration limits, routing modes, or maker/checker boundaries. Any permission guarantee must be demonstrated by an executable test or documented Flue contract, not by prompt wording alone.
5. Run the adapter with the repository's supported Node version in local execution and GitHub Actions. A hosted Vite/Hono deployment is out of scope unless a real HTTP consumer is identified.
6. Keep the adapter opt-in and independently releasable. Failure or removal of the Flue target must not affect the existing packages or the meta-agent workflows.

The current recommendation is therefore: **Option A for the meta-agent now; Option B only as a gated future experiment; reject Option C.**

## Weighted Decision Matrix

Scores are from 1 (poor) to 5 (strong). For burden criteria, a high score means lower burden. Weighted total is the sum of `weight x score`, shown out of 500 and normalized to 100.

| Criterion | Weight | A: Current GitHub Actions runner | B: Flue as additional platform target | C: Flue replacing the current runner |
| --- | --: | --: | --: | --: |
| Fit with canonical-source-sync | 25 | 5 | 4 | 2 |
| Platform independence and package boundaries | 15 | 5 | 4 | 2 |
| Maintenance and operational burden | 15 | 5 | 3 | 2 |
| Feature fit: tools, skills, subagents, hooks, state | 15 | 2 | 5 | 5 |
| Local, CI, and cloud operations | 10 | 5 | 4 | 4 |
| Maturity and ecosystem evidence | 10 | 5 | 2 | 2 |
| Migration cost and reversibility | 10 | 5 | 5 | 1 |
| **Weighted total** | **100** | **455 / 500 (91)** | **390 / 500 (78)** | **255 / 500 (51)** |

### Matrix interpretation

- **A: Current runner** wins because it already matches the repository's governance, has no new runtime dependency, runs directly in the checked-out repository, and keeps all operations transparent in workflow YAML and logs. Its feature score is lower because it does not provide a model-agent runtime, but that is not currently a requirement for the deterministic maintenance operations.
- **B: Flue target** is technically viable and materially better than A for Flue-native interactive agents. Its additive shape makes it reversible. Its costs are a seventh platform adaptation, a new generated representation, additional release and CI surface, and uncertainty about permission enforcement and first-stable operational behavior.
- **C: Flue substrate** has the strongest feature fit but fails the architectural test. It replaces a simple, auditable runner with a model-mediated runtime, couples core operations to Flue APIs and lifecycle semantics, and makes failure recovery, credentials, and approval behavior depend on a new framework. The benefits do not justify that irreversible direction for the current workload.

## Consequences

### Positive

- The current plans remain internally consistent: GitHub Actions schedules work, direct commands run in the checked-out repository, and no separate application or deployment is required.
- Canonical-source-sync remains the only source flow for methodology content. No Flue-specific syntax enters core.
- Existing package boundaries, release cycles, quality gates, and PR approval behavior remain unchanged.
- Flue can still be evaluated without committing the project to a substrate migration. An isolated target can prove value through real usage rather than framework enthusiasm.
- The decision avoids treating first-stable status and a large fix count as proof of production maturity.

### Negative

- The meta-agent does not gain Flue's dynamic hooks, durable conversation model, or persistent state in the current implementation.
- A future Flue target will require an adapter from Markdown directives to TypeScript agent modules. The existing string-transform pipeline can likely support generated wrappers, but this has not been proven and must be tested in the spike. [inferred]
- If the project later needs interactive, stateful, model-driven maintenance, the current shell workflows will need an additive agent layer or a separately revisited runtime decision.
- The project continues to maintain platform-specific adaptations. A Flue target would add another package and another sync configuration rather than reducing that cost.

## Trade-offs

### Canonical source versus Flue's code-first agent model

Flue's agent identity and capability composition are expressed in TypeScript functions and hooks. Maestria's methodology is intentionally inspectable Markdown with platform-specific rendering. The adapter boundary should therefore generate Flue wrappers around canonical prose. Making Flue modules canonical would improve local Flue ergonomics but violate the project's source-purity and platform-independence decisions.

### Dynamic capability versus deterministic governance

`useTool()`, `useSkill()`, `useSubagent()`, and persistent state could express adaptive workflows more naturally than shell scripts. They also create more runtime behavior to test. Current maintenance and release operations benefit more from deterministic commands, explicit GitHub Actions logs, and PR review than from a model choosing when to call those commands. Flue becomes more compelling only when a demonstrated task needs model reasoning or durable conversational state.

### Runtime reach versus permission guarantees

Flue supports local `flue run` and hosted Node.js or Cloudflare applications, which is a broad execution story. Maestria's safety model depends on boundaries such as read-only reconnaissance and review roles. The official materials reviewed establish Flue hooks and subagent composition, but do not establish that `useSubagent()` provides the same tool-level read-only enforcement as OpenCode's `edit: deny`. That gap must be closed with version-pinned documentation and tests before a Flue target can claim equivalent maker/checker enforcement. [inferred]

### Open-source adoption versus bespoke construction

There is no reason to build a bespoke agent runtime for the current meta-agent. GitHub Actions and the existing repository scripts already provide the needed scheduler, checkout, command execution, logs, credentials, and PR boundary. Flue is a reasonable open-source option for a distinct platform target, but adopting any framework merely to host deterministic shell commands would add cost without solving a current requirement.

## Alternatives Considered

### Option A: Keep the current GitHub Actions runner (selected for the meta-agent)

Keep scheduled workflows and standard repository commands as described in the current plans.

**Why selected:** It is the smallest, most transparent, and most reversible solution. It matches the existing architecture and does not turn deterministic maintenance into an unnecessary agent-runtime problem.

**Cost:** It does not provide a stateful conversational agent or hook-based dynamic capabilities. Model-driven learning remains future work and must be added deliberately if needed.

### Option B: Add Flue as a new platform target (viable future option)

Add an isolated Flue adapter that expresses the canonical methodology as Flue agent modules while leaving current packages and meta-agent workflows intact.

**Why not selected now:** The target is additive and technically viable, but there is no current user-facing requirement that justifies another package. Flue's first-stable maturity and permission/isolation semantics need evidence from a spike. This option should be revisited when a concrete Flue consumer or stateful agent use case exists.

### Option C: Replace GitHub Actions and the current runner with Flue (rejected)

Build `apps/maestria-agent/` as the primary runtime, using Flue tools, subagents, durable conversations, and `flue run` from GitHub Actions.

**Why rejected:** It introduces a framework dependency into work that currently needs only checked-out files and commands; it creates a new operational and credential surface; it risks weakening or obscuring maker/checker enforcement; and it makes the current plan's simple, provider-independent runtime contingent on a first-stable framework.

### Option D: Build a bespoke agent runtime (rejected)

Create a Maestria-specific runtime for tools, state, scheduling, and subagents.

**Why rejected:** This duplicates capabilities already supplied by GitHub Actions and existing platform runtimes. It would create the highest maintenance burden and would not improve canonical-source-sync. If a future requirement exceeds GitHub Actions, an existing open-source runtime should be evaluated before building one.

### Option E: Adopt another general-purpose open-source agent framework (deferred)

Evaluate frameworks such as Mastra, LangGraph, or an equivalent runtime if a concrete model-driven application requirement appears.

**Why deferred:** This ADR is about Flue 2.0 and the current Maestria workload. No evidence in the current plans requires a general runtime, and introducing another framework would face the same source-boundary, permission, operational, and migration questions. A future comparison should use the same matrix and official documentation rather than assuming feature parity.

## Assumptions

- [verified] The current meta-agent plans define GitHub Actions, shell scripts, TypeScript utilities, and existing monorepo tooling as the runtime, with no separate framework. Confirmed in `docs/plans/README.md`, `docs/plans/architecture.md`, and `docs/plans/implementation-plan.md`.
- [verified] Canonical directives are authored in Markdown under `packages/core/agent-directives/` and derived through per-package `sync.config.ts` files and `scripts/sync-all` / `scripts/check-sync`. Confirmed in ADR-CORE-005 and the current scripts/configs.
- [verified] Flue 2.0 uses capitalized agent functions in `'use agent';` modules, hook-based capability composition, `flue run` for local/CI execution, and Vite/Hono for hosted Node.js or Cloudflare applications. Confirmed against the official Flue 2.0 announcement and getting-started guide.
- [verified] Flue 2.0 is the first stable release and reports 200+ fixes and improvements. Confirmed in the official Flue 2.0 announcement.
- [inferred] The current maintenance, release, and sync operations are sufficiently deterministic that a framework runtime would not add proportional value today. Rationale: the current architecture describes them as direct commands and quality gates, and no current phase requires conversational state or dynamic capability selection.
- [inferred] A Flue adapter can remain additive and reversible if its generated outputs, package, and workflows are isolated. Rationale: the sync pipeline already discovers packages by `sync.config.ts`, and existing platform packages have independent release surfaces. This must be validated by implementation rather than assumed.
- [inferred] Flue's subagent and hook APIs do not automatically provide Maestria's existing tool-level maker/checker guarantees. Rationale: the official materials reviewed name the APIs but do not document equivalent per-role permission enforcement. Treat this as a spike acceptance criterion.
- [inferred] First-stable ecosystem maturity is insufficient evidence for making Flue the substrate. Rationale: a stable release and fix count show project activity, not long-term compatibility, operational history, or a verified permission model for this repository.

## Recommendation

Approve the status quo for the meta-agent: GitHub Actions plus the existing scripts remain the runtime. Do not add Flue to the current implementation plan as a replacement framework.

Record Flue 2.0 as a viable future platform target only. If a concrete Flue consumer or stateful agent requirement appears, run the bounded adapter spike described in the Decision section and revisit this ADR with evidence. Until then, the feature fit of Flue is not enough to outweigh its added dependency, maturity uncertainty, and governance risk.

**Plan impact:** None required for the current plans. Flue remains a deferred, optional target.

## Related Decisions

- [ADR-CORE-000: ADR structure](./ADR-CORE-000-adr-structure.md)
- [ADR-CORE-002: Plugin architecture](./ADR-CORE-002-plugin-architecture.md)
- [ADR-CORE-005: Shared agent directives via core-sync bridge](./ADR-CORE-005-shared-agent-directives-core-sync.md)
- [ADR-CORE-011: Eliminate questions - mid-phase autonomy with boundary checkpoints](./ADR-CORE-011-eliminate-questions-autonomy.md)
- [ADR-CORE-012: Access list discipline, blind review, and fail-loud iteration exit](./ADR-CORE-012-deterministic-review-signals-fail-loud-exit.md)
- [ADR-CORE-013: Selective routing by task and model economics](./ADR-CORE-013-model-tier-adaptive-pipeline.md)

## References

- [Flue 2.0 announcement](https://flueframework.com/blog/flue-2/)
- [Flue getting started](https://flueframework.com/docs/guide/getting-started/index.md)
- [Flue start guide](https://flueframework.com/start.md)
- [Maestria design patterns](../../../PATTERNS.md)
- [Maestria vision](../../../VISION.md)
- [Current meta-agent architecture plan](../../plans/architecture.md)
- [Current meta-agent implementation plan](../../plans/implementation-plan.md)

## Date

2026-08-04
