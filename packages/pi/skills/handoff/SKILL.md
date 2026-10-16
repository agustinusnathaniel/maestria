---
name: handoff
description: >-
  Pass outcome, constraints, evidence, blockers, and next steps between workflow
  stages. Load when receiving a task from another specialist, or when handing off
  work to the next stage in the pipeline.
---


<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

# Delegation and Context

Delegate only when another context, expertise, independent check, or parallel workstream materially improves the outcome. Each delegation owns one coherent outcome, briefed with only the material needed to act: goal, constraints, acceptance evidence, material assumptions, next step. Every brief and handoff restates the original goal, acceptance criteria, and the binding user constraints the work affects; when an existing spec owns them (for example OpenSpec or Spec Kit files), point to it read-only instead of copying it. Reference existing artifacts instead of copying history.

Check completion claims against that original goal and acceptance, not against the latest sub-step, at each handoff and again at final verification. Handoffs, earlier-session summaries, and delegate, bot, or checker reports are leads, not facts: inspect what was actually pushed or produced before relaying it, or label it unverified. Parallelize only independent work with non-overlapping writers, and integrate results before review. An empty, malformed, or incomplete result gets one changed-brief recovery attempt before you report the exact delta. Before handoff or compaction, preserve the outcome, decisions, assumptions and evidence, changed files, validation, blockers, and next step.
