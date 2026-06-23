# ADR-010: Adopt TRINITY/Conductor-Inspired Orchestration Patterns

## Status

Accepted

## Context

TRINITY (arXiv:2512.04695) and Conductor (arXiv:2512.04388) propose
orchestration architectures for multi-agent code generation. TRINITY introduces
learned routing via CMA-ES, dynamic per-turn role assignment (thinker/worker/
verifier), and verifier-terminated execution. Conductor proposes RL-trained
strategy generation where a model learns to produce natural-language
coordination plans with discovered topologies. Both papers were published at
ICLR 2026.

We wanted to learn what patterns maestria could adopt without the ML training
infrastructure both papers depend on. An audit compared paper proposals against
maestria's existing fein pipeline (recon → design → build → review) and found
that the thinker→worker→verifier pattern was already present in linear form.
The papers' core innovations — learned routing and RL-trained strategies —
are research-level infrastructure requiring SLMs, evolutionary optimization,
and PPO training pipelines. The implementable patterns were incremental: role
metadata, quality-gated iteration loops, and adaptive sequencing.

An initial POC on this branch (commit `63bc476`) implemented role frontmatter,
recursive orchestration, and dynamic role sequencing. Recursive orchestration
was superseded when we confirmed OpenCode's `task()` does not support recursive
delegation — subagents receive read-only tools only. The POC was reverted
(commit `e21dd76`), then dynamic sequencing and verifier-terminated execution
were re-implemented (commit `d7a43f0`). This ADR formalizes what we keep and
what remains deferred.

## Decision

### Adopted

Three patterns from the papers:

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
   and context leakage between subagents during independent analysis. Derived
   from Fugu's intra-workflow agent isolation.

### Deferred to Future Research

Three patterns remain out of scope without ML infrastructure investment:

4. **Learned routing via CMA-ES** — Requires a ~0.6B SLM and evolutionary
   optimization pipeline. Not feasible in a plugin-only project.
5. **RL-trained strategy generation** — Requires a 7B model trained via PPO.
   Not feasible in a plugin-only project.
6. **Recursive orchestration** — Blocked by OpenCode runtime: `task()` grants
   subagents read-only tools, preventing orchestrator self-delegation.

### What We Avoid

| Anti-pattern                   | Why Not                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------- |
| Fixed pipeline unconditionally | Always running all stages wastes tokens when the verifier would accept early  |
| Laissez-faire handoff          | Passing full conversation history lets subagents bias each other's analysis   |
| ML-dependent routing           | Requires training infrastructure that does not exist and may never exist here |

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

- Learned routing and RL training remain deferred indefinitely without ML
  infrastructure investment
- If OpenCode adds support for recursive `task()` calls, the recursive
  orchestration design from the superseded POC could be revived
- Orchestrator prompt has grown incrementally across ADRs — cumulative
  complexity may reduce instruction-following reliability over time

## References

- [TRINITY: Evolved Orchestrator for Multi-Agent Code Generation](https://arxiv.org/abs/2512.04695)
- [Conductor: Learning to Orchestrate Agents in Natural Language with RL](https://arxiv.org/abs/2512.04388)
- [Fugu Technical Report](https://github.com/SakanaAI/fugu/blob/main/Fugu_technical_report.pdf)
- This ADR supersedes the earlier ADR-010 and ADR-011 drafts that were created
  and reverted on the `poc/trinity-conductor-pattern` branch

## Date

2026-06-23
