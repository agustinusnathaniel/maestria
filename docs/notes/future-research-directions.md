# Future Research Directions — Tier 3

This document captures long-term, research-level directions for maestria
inspired by two recent papers on learned multi-agent coordination:

- [Evolved Orchestrator for Multi-Agent Code Generation](https://arxiv.org/abs/2512.04695)
  (ICLR 2026) — TRINITY: lightweight coordinator with Thinker/Worker/Verifier
  roles, optimized via Covariance Matrix Adaptation Evolution Strategy (CMA-ES)
- [Learning to Orchestrate Agents in Natural Language with Reinforcement
  Learning](https://arxiv.org/abs/2512.04388) (ICLR 2026) — Conductor:
  RL-trained orchestrator with recursive coordination topologies

These are **Tier 3** — speculative directions that require significant
research and infrastructure. They are not on the immediate roadmap. They
are documented here to anchor long-term thinking and to flag what we'd
need if we ever decide to pursue them.

---

## 1. Learned Router via CMA-ES

### Concept

Replace the orchestrator's hard-coded trigger-phrase matching
("bug" → `@diagnose`, "review" → `@reviewer`) with a lightweight
learned coordinator (~100M parameters) that decides which specialist
to delegate to for a given task.

The TRINITY paper shows that a small coordinator trained with CMA-ES
can outperform hand-coded routing rules: it learns patterns that
humans don't anticipate (e.g., routing certain "fix" requests to the
architect rather than the builder, because the underlying issue is
design-level).

### Research Basis

- arXiv:2512.04695 — TRINITY: lightweight coordinator (~0.6B params)
  with Thinker/Worker/Verifier roles, optimized via CMA-ES
- CMA-ES is a black-box optimization algorithm that works with
  non-differentiable objectives (cannot backpropagate through LLM
  outputs). The coordinator's parameters are sampled from a
  multivariate normal distribution, evaluated on a batch of tasks,
  and the distribution is updated toward parameter settings that
  produce better outcomes.

### What It Would Take

| Resource             | Estimate               | Notes                                                                                       |
| -------------------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| Coordinator model    | ~100M params           | Not a general LLM — a small transformer that maps task embeddings to agent selection logits |
| Training compute     | ~1-5 GPU-weeks         | CMA-ES needs hundreds of generations × population size                                      |
| Reward signal design | 3-5 engineering months | Defining and collecting the reward signal is the hard part (see below)                      |
| Training data        | 10K+ task histories    | Each: task description, delegation decision, outcome metrics                                |
| Integration          | 1-2 engineering months | Plugin changes to call coordinator instead of rule matching                                 |

### The Reward Signal Problem

The hardest open question: what is the reward? CMA-ES optimizes
toward a scalar objective, but "good delegation" has no single
definition. Candidates:

| Signal                                                 | Measurable?                   | Problem                                                        |
| ------------------------------------------------------ | ----------------------------- | -------------------------------------------------------------- |
| Task completion rate                                   | Yes                           | Coarse — doesn't distinguish "completed with 1 iteration vs 5" |
| Token cost                                             | Yes                           | Optimizes for cheap, not correct                               |
| Iteration count                                        | Yes                           | Correlated with quality but noisy                              |
| Handoff quality (LLM-judged)                           | Yes, with a judge model       | Adds complexity, judge bias                                    |
| User satisfaction (explicit)                           | No, unless we add feedback UI | Intrusive, low volume                                          |
| User satisfaction (proxied: undo rate, edit frequency) | Plausible                     | Noisy, hard to attribute to one delegation                     |
| Binary pass/fail from subsequent verification          | Partially                     | Only covers delegations that get reviewed                      |

**Minimum viable reward**: a composite of token cost + iteration
count + verifier pass/fail. This requires no user instrumentation
and captures the main axes of delegation quality.

### Where the Coordinator Would Run

| Option                                                 | Pros                                                  | Cons                                                             |
| ------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------- |
| **Local model embedded in plugin** (preferred for MVP) | Zero latency, works offline, no API cost              | ~100M params still needs ~200MB RAM; ONNX or llama.cpp inference |
| Cloud API endpoint                                     | Larger model possible, easy to update                 | Latency, cost, privacy (task descriptions leave the machine)     |
| Offline training, periodic updates                     | Simple: train on collected data, ship updated weights | No online adaptation — stale between updates                     |

**Recommended for MVP**: ONNX-runtime inference embedded in the
plugin, trained offline with periodic model updates. The coordinator
is small enough to run on-device.

### Integration with OpenCode Plugin Architecture

The `chat.message` hook (ADR-008) already intercepts user messages
for mode detection. The learned router would fire at the same point:

```typescript
// Current: rule-based trigger matching → specialist
// Future: learned coordinator → specialist

'chat.message': async (hookInput, hookOutput) => {
  // ...existing mode detection...

  // NEW: learn specialist selection
  const taskEmbedding = embedTask(textPart.text);
  const specialist = coordinator.predict(taskEmbedding);

  // Inject routing decision into orchestrator prompt
  textPart.text = `[ROUTER: ${specialist}]\n` + textPart.text;
};
```

The coordinator's output is a suggestion, not a command — the
orchestrator can override it, just as it can override trigger phrases
today. The coordinator learns from actual outcomes, so if it
suggests the wrong agent repeatedly, the reward signal corrects it.

### Minimum Viable Version

A realistic first experiment that doesn't require the full CMA-ES
infrastructure:

1. **Instrument the current router.** Log every delegation decision
   with: task snippet, agent selected, specialist output, verifier
   result (if any), iteration count, token cost. This collects the
   training dataset without changing behavior.

2. **Train a classifier on logged data.** Skip CMA-ES initially.
   Train a small classifier (logistic regression or ~10M param
   transformer) to predict the "correct" specialist from task text,
   using verifier pass/fail as the label. Compare its suggestions
   against the existing trigger-phrase rules on held-out data.

3. **If the classifier beats the rules** (higher verifier pass rate,
   lower iteration count), then invest in the CMA-ES coordinator.
   If not, the trigger-phrase rules are already near-optimal for
   this reward signal — no need for learned routing.

This phased approach avoids building the full CMA-ES pipeline for
a result that might be "the rules are good enough."

### Key Open Problems

1. **Reward signal design** — The composite reward must not optimize
   for cheap failures. How do we weight cost vs. quality?
2. **Task embedding** — How do we represent an open-ended natural
   language task as a fixed-dimensional vector for the coordinator?
   A sentence transformer? A task-type classifier?
3. **Distribution shift** — The coordinator trains on historical
   delegation patterns. When new agents are added or prompts change,
   past data becomes stale. How often must we retrain?
4. **Cold start** — With no training data (new user, new project),
   the coordinator falls back to rule-based routing. At what data
   volume does it outperform the rules?
5. **Attribution noise** — A delegation that fails is not always the
   agent's fault. A good agent with a bad briefing looks like a bad
   delegation. The coordinator learns from outcomes, not from
   "would a different agent have done better?" — counterfactuals are
   expensive to generate.

---

## 2. RL-Trained Strategy Model

### Concept

Train a small model via reinforcement learning to generate
delegation strategies: not just _which agent_ but _how to orchestrate
them_. The strategy model outputs a coordination plan — which agents
to call, in what topology (sequential, parallel, recursive, with
quality gates), with what instructions — optimized for the task.

This goes beyond the learned router (item 1), which only replaces
agent selection. The strategy model replaces the orchestrator's
entire decision procedure.

### Research Basis

- arXiv:2512.04388 — Conductor: RL-trained orchestrator with
  recursive coordination topologies. The Conductor generates a
  strategy string (a compressed coordination plan) that specifies
  agent calls, branching conditions, and iteration bounds.
- The strategy is not generated from scratch each turn — the model
  fine-tunes on successful coordination trajectories, learning
  reusable patterns.

### What Makes This Different from Learned Routing

| Dimension       | Learned Router (Item 1)                    | RL Strategy Model (Item 2)                             |
| --------------- | ------------------------------------------ | ------------------------------------------------------ |
| Output          | Single agent selection                     | Full coordination plan                                 |
| Topology        | Implicit (orchestrator still decides flow) | Explicit (plan specifies sequence, parallelism, loops) |
| Instructions    | Briefing format from ADR-004               | Strategy model generates optimized briefings           |
| Verification    | Not modeled                                | Strategy can include verification gates                |
| Training signal | Delegation outcome                         | Full trajectory reward (did the plan work?)            |

### What an RL Environment Would Look Like

Training requires an environment where the strategy model takes an
action (generate a coordination plan), the plan is executed by the
agent system, and the model receives a reward based on the outcome.

**Option A: Simulated environment (recommended for research)**

A lightweight simulator that replays historical tasks through
different coordination strategies and scores outcomes. The simulator
does not call real LLMs — it uses historical outcome data to
estimate the result of a given strategy on a given task.

```python
# Simplified simulation loop
state = TaskState(task_embedding, history)
plan = strategy_model.generate(state)  # e.g., "PARALLEL adventurer architect -> SEQUENTIAL builder reviewer"
outcome = simulate(plan, historical_data)  # Estimate pass rate, cost, iterations
reward = compute_reward(outcome)
strategy_model.update(reward)
```

This avoids the prohibitive cost of running real LLM calls during
training. The trade-off: the simulation is only as good as the
historical data.

**Option B: Online training with live LLM calls**

Run the strategy model's plans on real tasks and collect outcomes.
This gives accurate rewards but is expensive — each training step
requires 3-10 LLM calls. Budget estimate: ~$500-2000 per training
run on API-priced models.

**Recommended**: Start with the simulated environment. Only move
to online training if the simulated results are promising and the
strategy model demonstrably learns from synthetic data.

### Serving the Strategy Model

| Option                               | Viability                                                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Embedded in plugin (local inference) | Marginal for RL strategy. Strategy models tend to be larger than routers (need to generate text, not just logits).                                            |
| Plugin-side API call                 | Practical. The plugin calls a local or API endpoint that runs the strategy model. Latency acceptable since strategy is generated once per task, not per turn. |
| Orchestrator prompt integration      | The strategy model output is injected into the orchestrator's prompt as guidance — the orchestrator still has final say.                                      |

**Recommended**: Run the strategy model as a sidecar process
(spawned by the plugin or a CLI wrapper). The plugin calls it once
per task, receives a coordination strategy, and injects it into the
orchestrator's system prompt.

### Relationship to Dynamic Prompt Generation (Tier 2)

Tier 2 (dynamic prompt generation) adjusts agent prompts based on
task context — e.g., giving the builder more structured guidance for
a complex refactor. The RL strategy model subsumes this: it generates
the full coordination plan, which includes agent instructions,
briefing format, and verification criteria.

If Tier 2 is implemented first, the strategy model can treat it as a
parameter — the strategy model learns when to request a detailed
briefing vs. a minimal one. If Tier 2 is not in place, the strategy
model still works; it generates instructions from scratch instead.

### Compute Requirements

| Component                         | Estimate              | Notes                                                         |
| --------------------------------- | --------------------- | ------------------------------------------------------------- |
| Strategy model size               | 500M-1B params        | Needs to generate coherent plans, not just classifications    |
| Training (simulated env)          | 1-2 GPU-weeks         | PPO or REINFORCE with simulated rollouts                      |
| Training (online, with LLM calls) | 5-20 GPU-weeks        | Each rollout calls live LLMs — 10-100x more expensive         |
| Inference latency                 | 200-500ms             | Sidecar process, quantized model                              |
| Training data                     | 5K+ task trajectories | Each: task → strategy → outcome (pass/fail, cost, iterations) |

### Minimum Viable Version

Do not train an RL policy. Instead:

1. **Collect coordination trajectories.** Log the orchestrator's
   full decision trace: task text, which agents called in what order,
   briefing content, handoffs, verifier results, iteration counts.
   This is the same instrumentation needed for item 1, but captures
   the full flow, not just the first delegation.

2. **Train a plan classifier, not a generator.** Given a task, can a
   small model predict which coordination topology the orchestrator
   _should_ use? Topology classes:
   - Sequential (agent A → B → C)
   - Parallel fan-out (A || B → synthesize)
   - Think-verify cycle (think → work → verify [→ rework → re-verify])
   - Recursive (sub-orchestrator)
   - One-shot (single agent, no pipeline)

   Train a classifier on logged data with outcome labels. If the
   classifier can predict the right topology with >80% accuracy, the
   data contains a learnable signal. If not, the orchestrator's
   decision procedure may be too context-dependent for a static
   classifier — in which case the full RL approach is even harder.

3. **Only if the classifier shows signal**, invest in the RL
   pipeline. The classifier result de-risks the RL approach for ~1
   engineering week instead of 1-2 GPU-months.

### Key Open Problems

1. **Action space complexity** — A coordination plan is a structured
   output (sequence, hierarchy, conditions), not a single label.
   Generating valid plans is harder than classification.
2. **Credit assignment** — When a 5-step plan fails at step 4, did
   the failure originate at step 4 or earlier? The RL agent must
   attribute reward across the plan, which requires trajectory-level
   value functions.
3. **Strategy generalizability** — A strategy learned on project A
   (a Python CLI tool) may not transfer to project B (a React SPA).
   Do we need project-specific strategy models?
4. **Safety and interpretability** — An RL policy that silently
   learns to skip verification on "safe" tasks may optimize cost at
   the expense of correctness. How do we audit its decisions?
5. **Orchestrator override** — If the orchestrator can override the
   strategy model's plan, how does the strategy model learn from
   these overrides? They are implicit negative reward signals.

---

## 3. Other Research Directions

### 3a. Evolutionary Optimization of Agent Prompts

**Concept**: Use CMA-ES (same algorithm as item 1) to optimize the
prompts of individual agents — not just routing decisions but the
instructions agents receive.

**How it would work**: Each agent's prompt has tunable "knobs":
included sections, wording of critical rules, examples, iteration
limits. CMA-ES samples prompt variants, evaluates them on a
benchmark of tasks within that agent's domain (e.g., `@builder`
prompts tested on a set of implementation tasks), and evolves toward
prompts that produce better outcomes.

**What makes this hard**: Prompts are discrete text, not continuous
parameters. CMA-ES operates on continuous vectors. A prompt
embedding space would need to parameterize sections (which sections
to include, how to order them, what wording to use) as continuous
values that are decoded into text.

**Minimum viable version**: Treat prompt sections as binary knobs
(include section X or not) and order as a permutation. Use a simpler
optimizer (random search, Bayesian optimization on a few knobs)
before committing to CMA-ES. Early experiments on prompt compression
(which sections can be removed without degrading performance) may
yield quick wins without any optimization algorithm.

**Reference**: The TRINITY paper (arXiv:2512.04695) hints at this in
its ablation studies — the authors tested different prompt
formulations for the coordinator and found significant performance
differences from apparently minor wording changes.

### 3b. Self-Improving Orchestration

**Concept**: The orchestrator tracks its own delegation outcomes and
adapts its rules over time — learning from experience without a
separate training phase.

**How it would work**: The orchestrator maintains a running log of
delegation outcomes (success/failure, iteration count, token cost).
Periodically (after N delegations, or when triggered by a pattern of
failures), it analyzes the log and updates its rules: "Tasks
involving database migrations fail when delegated to `@builder`
directly. Re-route through `@architect` first."

**This is not RL**: It's a structured reasoning step that the
orchestrator performs using its own LLM. It reflects on its track
record and generates rule updates in natural language. The updates
are vetted by the user before adoption.

**Minimum viable version**: Add a periodic reflection step to the
orchestrator's prompt:

```
## Self-Improvement (Deactivated)
If enabled, the orchestrator may periodically reflect on
delegation outcomes and suggest rule updates. For now:
do NOT self-modify. Log outcomes but do not act on them.
```

This instruments the behavior without activating it. Once we have
enough logged data to analyze, we can design the reflection
mechanism.

**Relation to other items**: Self-improving orchestration could be
seen as the _manual_ version of what CMA-ES (item 1) does
_automatically_. The orchestrator introspects on failures and
adjusts rules; CMA-ES adjusts routing parameters. They could
complement each other — the orchestrator handles coarse-grained
rule adjustments (visible, auditable), while CMA-ES handles
fine-grained routing optimization (opaque but more precise).

### 3c. Multi-Model Routing

**Concept**: Route tasks to different underlying LLMs depending on
task characteristics — not just which agent, but which model the
agent runs on.

**Why this matters**: Not every task needs GPT-4 or Claude Opus.
A `@builder` fixing a typo can use a faster, cheaper model.
An `@architect` designing a complex data model benefits from the
best available reasoning. This is "model tiering" applied at
orchestration level rather than agent level.

**Current state**: Model selection is an OpenCode user config
setting per agent. The orchestrator cannot dynamically select
models — it's set in `opencode.jsonc`. Multi-model routing would
require OpenCode-level support or a workaround (e.g., registering
multiple agents with different model assignments and routing to
the right one).

**Minimum viable version**: Register tiered agents — `@builder-fast`
(cheap model) and `@builder-smart` (expensive model). The
orchestrator's trigger-phrase system already handles routing:
"quick fix" → `@builder-fast`, "complex refactor" → `@builder-smart`.
This requires no plugin or OpenCode changes — just agent definitions
and routing rules.

```markdown
| `@builder-fast` | `worker` | Typo fix, simple refactor, single-file change — known territory |
| `@builder-smart` | `worker` | Cross-module change, new feature, complex algorithm — needs quality |
```

**If OpenCode later supports per-turn model selection in the
agent config**, the tiered-agent workaround can be collapsed into
a single `@builder` agent with dynamic model assignment.

**Relation to RL strategy model (item 2)**: Multi-model routing is a
natural extension of the strategy model's output — it can decide not
just "call `@builder`" but "call `@builder` with Claude Haiku for
speed."

### Key Open Problems (All Three Sub-Items)

| Direction                 | Open Problem                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 3a (Evolutionary prompts) | How do we evaluate a prompt change in isolation? A prompt that works well on one task may fail on another. What is the benchmark? |
| 3a (Evolutionary prompts) | Prompt improvements may not transfer across LLM versions (GPT-4 → GPT-5). Are we optimizing prompts that go stale?                |
| 3b (Self-improving)       | How does the orchestrator distinguish "I chose the wrong agent" from "I gave a bad briefing"? Current logs conflate the two.      |
| 3b (Self-improving)       | User trust: would users accept an orchestrator that modifies its own rules? The vetting step mitigates this but adds friction.    |
| 3c (Multi-model)          | OpenCode does not support per-turn model overrides. Tiered agents are a workaround but multiply agent definitions.                |
| 3c (Multi-model)          | Cost-quality trade-offs are non-stationary: model pricing and capability change quarterly. Static tiered routing goes stale.      |

---

## Cross-Cutting Considerations

### Common Infrastructure Needs

All three Tier 3 directions depend on one thing we don't have yet:
**instrumentation**. Without logged delegation outcomes, none of
these approaches can train, evaluate, or adapt.

The highest-leverage thing we could do today for any Tier 3
direction is to start logging:

```
Task: task description (anonymized/embedded)
Agent selected: adventurer | architect | builder | diagnose | planner | reviewer | writer
Briefing length (tokens): N
Agent output length (tokens): N
Verifier result: pass | fail | not reviewed
Iterations: N
Total tokens consumed: N
User action after: continue | retry | undo | new task
```

This log is useful whether or not we ever pursue Tier 3. It enables
analytics, debugging, and cost tracking even without learned routing.

### Dependencies on Current ADRs

| Tier 3 Direction          | Depends On                | Why                                                                                                                                        |
| ------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Learned Router (CMA-ES)   | ADR-010 (role metadata)   | The coordinator routes by role, not just agent. Role metadata is the output space.                                                         |
| Learned Router (CMA-ES)   | ADR-011 (think-verify)    | Verifier result feeds the reward signal. Without structured verification, we lack the main quality signal.                                 |
| RL Strategy Model         | ADR-011 (think-verify)    | Iteration count and termination conditions are key reward components.                                                                      |
| RL Strategy Model         | ADR-012 (recursive)       | Recursive topologies are part of the strategy space. Without recursion, the strategy model's action space is limited to flat and parallel. |
| Evolutionary Prompts (3a) | ADR-004 (agent template)  | The template defines prompt structure — which sections are fixed vs. tunable.                                                              |
| Self-Improving (3b)       | ADR-010, ADR-011, ADR-012 | The orchestrator needs the full role/iteration/recursion framework to reflect on outcomes meaningfully.                                    |
| Multi-Model Routing (3c)  | ADR-008 (mode system)     | The mode system is the existing routing infrastructure. Multi-model routing extends it.                                                    |

### What Success Looks Like

- **Item 1 success**: A CMA-ES coordinator that matches or beats the
  trigger-phrase system on verifier pass rate while reducing token
  cost by ≥15%. The coordinator runs locally, requires no cloud
  dependencies, and improves with use.
- **Item 2 success**: An RL strategy model that recommends
  coordination plans that reduce iteration count by ≥30% compared
  to the default pipeline (for complex tasks), without reducing
  verifier pass rate.
- **Item 3 success**:
  - 3a: Prompt variants with measurably better task completion rates
    on a held-out benchmark.
  - 3b: At least one documented case where the orchestrator
    identified and corrected a systematic delegation error.
  - 3c: A tiered-agent setup in production with measurable cost
    savings (≥20%) without quality regression.

### What Failure Looks Like

- **Item 1 failure**: The trigger-phrase rules are already
  near-optimal for the reward signal we can measure. Training a
  coordinator adds complexity without improvement.
- **Item 2 failure**: Coordination strategies are too
  context-dependent to learn from historical data. Each task is too
  unique for the pattern to generalize.
- **Item 3 failure**:
  - 3a: Prompt variations do not produce consistent improvements
    across tasks — the optimal prompt depends too much on the
    specific task.
  - 3b: The orchestrator's self-reflection produces false patterns
    (seeing correlations that aren't causal), leading to worse rules.
  - 3c: Tiered agents add maintenance overhead without significant
    cost savings — model APIs are cheap enough that the complexity
    isn't worth it.

Each failure mode is informative. A clear negative result saves the
effort of building the full system.

---

## References

### Papers

- [Evolved Orchestrator for Multi-Agent Code Generation](https://arxiv.org/abs/2512.04695)
  — TRINITY: lightweight coordinator with CMA-ES optimization (ICLR 2026)
- [Learning to Orchestrate Agents in Natural Language with Reinforcement Learning](https://arxiv.org/abs/2512.04388)
  — Conductor: RL-trained orchestrator with recursive topologies (ICLR 2026)

### ADRs

- ADR-008: Keyword-Triggered Workflow Modes — current routing mechanism
- ADR-010: Role-Based Agent Metadata — Thinker/Worker/Verifier roles
- ADR-011: Iterative Think-Verify Cycles — quality-gated loops
- ADR-012: Recursive Orchestration — self-delegation for multi-level decomposition

### Project Notes

- `docs/notes/session-2026-06-12-opencode-plugin.md` — historical context on plugin evolution
- `packages/opencode/agents/orchestrator.md` — orchestrator prompt with current trigger-phrase routing
- `packages/opencode/src/index.ts` — plugin entry point, frontmatter parser, hook implementations

---

## Date

2026-06-22
