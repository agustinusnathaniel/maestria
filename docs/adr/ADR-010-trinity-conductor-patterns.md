# ADR-010: Adopt TRINITY/Conductor-Inspired Orchestration Patterns

## Status

Accepted

## Context

TRINITY (arXiv:2512.04695) and Conductor (arXiv:2512.04388) propose
orchestration architectures for multi-agent code generation. TRINITY introduces
per-turn role assignment (thinker/worker/verifier) and verifier-terminated
execution. Conductor proposes strategy generation with discovered coordination
topologies. Both papers were published at ICLR 2026. However, their core
contributions depend on ML training infrastructure that is outside the scope
of a plugin-only project.

We audited both papers against maestria's existing fein pipeline (recon →
design → build → review) and found that the thinker→worker→verifier pattern was
already present in linear form. The implementable patterns were incremental:
role metadata, quality-gated iteration loops, and adaptive sequencing.

An initial POC on this branch (commit `63bc476`) implemented role frontmatter
and dynamic role sequencing. Dynamic sequencing and verifier-terminated execution
were refined and committed (`d7a43f0`). This ADR formalizes what we keep.

We also investigated recursive orchestration (the orchestrator delegating
to itself via task(orchestrator, ...) for nested task decomposition). This
proved not viable: OpenCode's task() grants subagents read-only tools only
(Glob, Grep, Ls, View, Sourcegraph) — they cannot delegate further, run
commands, or edit files. Self-delegation is outside the current OpenCode
plugin architecture.

## Decision

### Adopted

Three patterns inspired by the papers:

1. **Verifier-terminated pipeline** — The reviewer's acceptance signals
   pipeline completion, skipping unnecessary subsequent stages. Derived from
   TRINITY's Verifier-terminated execution, this converts the reviewer from a
   terminal step into a termination gate.

2. **Dynamic role sequencing** — The orchestrator selects the next role
   (thinker/worker/verifier) based on current state rather than following a
   fixed pipeline order. Derived from TRINITY's per-turn role assignment, this
   lets the pipeline adapt to task needs.

3. **Access list for context isolation** — Delegation handoffs explicitly
   enumerate which prior outputs a specialist may reference. This prevents bias
   and context leakage between subagents during independent analysis.

### What We Avoid

| Anti-pattern                   | Why Not                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------- |
| Fixed pipeline unconditionally | Always running all stages wastes tokens when the verifier would accept early |
| Laissez-faire handoff          | Passing full conversation history lets subagents bias each other's analysis  |

## Consequences

### Positive

- Pipeline adapts to task needs instead of always running all stages
- Verifier acceptance saves tokens by skipping unnecessary downstream stages
- Context isolation prevents cross-agent bias during independent analysis
- Audit findings are formalized in an ADR for future reference

### Negative

- Dynamic sequencing relies on LLM judgment — may produce inconsistent
  role ordering across sessions
- Access list adds one more field to each delegation handoff, increasing
  token consumption per delegation
- None of the three adopted patterns have programmatic enforcement — they
  depend on orchestrator instruction-following

### Risks

- Orchestrator prompt has grown incrementally across ADRs — cumulative
  complexity may reduce instruction-following reliability over time
- Recursive orchestration is not viable in current OpenCode. Complex
  hierarchical tasks must be flattened into sequential or parallel
  delegations by the orchestrator.

## References

- [TRINITY: Evolved Orchestrator for Multi-Agent Code Generation](https://arxiv.org/abs/2512.04695)
- [Conductor: Learning to Orchestrate Agents in Natural Language with RL](https://arxiv.org/abs/2512.04388)

## Date

2026-06-23
