# TRINITY & Conductor Patterns — Audit & Implementation

An honest comparison of what the papers propose, what maestria already had,
and what was actually implemented.

## What the Papers Propose

| Pattern                          | Paper     | Description                                                                                         |
| -------------------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| Learned routing (CMA-ES)         | TRINITY   | ~0.6B SLM + 10K param head trained via evolutionary optimization to select agent and role per turn  |
| Dynamic per-turn role assignment | TRINITY   | Coordinator selects both agent AND role (thinker/worker/verifier) each turn — not fixed pipeline    |
| Verifier-terminated execution    | TRINITY   | Process runs up to K=5 turns, stops when Verifier accepts. No fixed pipeline length.                |
| RL-trained strategy generation   | Conductor | 7B model trained via PPO to generate natural-language coordination plans with discovered topologies |

## What Maestria Already Had (Before POC)

These patterns existed before any TRINITY/Conductor-inspired changes and
survived the POC revert.

| Paper Pattern                     | Existing maestria equivalent                                                                           | Gap                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Thinker → Worker → Verifier roles | fein pipeline (recon → design → build → review) already sequences through these roles linearly         | Fixed order, not adaptive. Verifier is terminal step, not termination gate. |
| Centralized coordinator           | Orchestrator is hub-and-spoke — only agent with `task()` permission, has `edit: deny` and `bash: deny` | Coordinator can still analyze/synthesize itself (not pure router)           |
| Turn budget (K=5)                 | Per-agent iteration limits exist (max 3 per agent) but no global budget across the full pipeline       | No global turn budget                                                       |
| Agent pool                        | 7 specialists with defined roles                                                                       | Static pool, no dynamic subsetting                                          |
| Verifier role                     | `@reviewer` validates `@builder` output (maker/checker split)                                          | Review is final step, not termination gate                                  |
| Learned routing                   | Trigger-phrase routing is hand-coded in orchestrator prompt                                            | Hand-coded heuristics vs learned policy (Tier 3 gap)                        |
| RL strategy generation            | Orchestrator follows fixed delegation templates                                                        | Static templates vs learned strategies (Tier 3 gap)                         |

## What Was Actually Implemented (POC — Now Reverted)

The POC branch (commit `63bc476`) implemented three changes inspired by
TRINITY and Conductor. All were later reverted (`e21dd76`) to restore
clean main state. ADR-012 (Recursive Orchestration) was superseded before
the full revert due to OpenCode runtime constraints — `task()` does not
support recursive delegation.

| Change                                                 | Paper Pattern                                               | Actual Implementation                                                                                                                      | Honest Assessment                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Role frontmatter on 7 agents (thinker/worker/verifier) | TRINITY's role taxonomy                                     | Added `role:` field to agent YAML, parser validates and injects dynamic mapping, orchestrator gains Role-Based Routing section             | ✅ Pattern transfer — made roles machine-readable and routable             |
| Iterative think-verify cycle                           | TRINITY's Verifier-terminated execution + dynamic rerouting | Added Think-Verify Cycle section to orchestrator prompt: Think → Work → Verify loop with rework on rejection, max 3 iterations, escalation | ✅ Genuine pattern transfer — changes pipeline from one-pass to gated loop |
| Recursive orchestration (self-delegation)              | Conductor's recursive topologies                            | Added orchestrator to `task()` allowlist, Recursive Orchestration section with depth limit 2, scoped briefing format                       | ❌ Superseded — OpenCode runtime does not support recursive `task()` calls |
| Dynamic role sequencing                                | TRINITY's per-turn role selection                           | Orchestrator chooses next role based on state rather than fixed pipeline order                                                             | ✅ Genuine pattern transfer — changes how roles are sequenced              |

> **Update (commit d7a43f0):** Dynamic role sequencing and verifier-terminated
> execution were re-implemented after the revert. The `role:` frontmatter labels
> and recursive orchestration remain reverted.

## What Was NOT Implemented

| Pattern                        | Paper     | Reason Not Implemented                                                                                              |
| ------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------- |
| Learned routing via CMA-ES     | TRINITY   | Tier 3 — requires training infrastructure (SLM + evolutionary optimization). Not feasible in a plugin-only project. |
| RL-trained strategy generation | Conductor | Tier 3 — requires RL pipeline (7B model, PPO training). Not feasible in a plugin-only project.                      |

These are the papers' core innovations. The implementable patterns were
incremental: role metadata, quality-gated iteration loops, and adaptive
sequencing.

## Key Insight

The fein pipeline (recon → design → build → review) already embodied a
thinker → worker → verifier pattern before any TRINITY-inspired changes.
The papers' main innovations — learned routing via CMA-ES and RL-trained
strategy generation — are research-level infrastructure not feasible in
a plugin-only project. The implementable patterns were incremental:
adding machine-readable role metadata, making the verifier a termination
gate rather than a terminal step, and making role ordering adaptive
rather than fixed.

## References

- [TRINITY: Evolved Orchestrator for Multi-Agent Code Generation](https://arxiv.org/abs/2512.04695) — ICLR 2026
- [Conductor: Learning to Orchestrate Agents in Natural Language with RL](https://arxiv.org/abs/2512.04388) — ICLR 2026
