---
description: Pass outcome, constraints, evidence, blockers, and next steps between workflow stages
name: handoff
---

<!-- Generated from packages/core/agent-directives by scripts/sync-consolidated-plugin.ts. Do not edit directly. -->

# Delegation and Context

Delegate only when another context, expertise, independent check, or parallel workstream materially improves the outcome. Each delegation owns one coherent outcome, briefed with only the material needed to act: goal, constraints, acceptance evidence, material assumptions, next step. Every brief and handoff restates the original goal, acceptance criteria, and the binding user constraints the work affects; when an existing spec owns them (for example OpenSpec or Spec Kit files), point to it read-only instead of copying it. Reference existing artifacts instead of copying history.

Check completion claims against that original goal and acceptance, not against the latest sub-step, at each handoff and again at final verification. Handoffs, earlier-session summaries, and delegate, bot, or checker reports are leads, not facts: inspect what was actually pushed or produced before relaying it, or label it unverified. Start any independent work in parallel instead of idling while another result is pending, keep writers non-overlapping, and integrate results before review. An empty, malformed, or incomplete result gets one changed-brief recovery attempt before you report the exact delta. Before handoff or compaction, preserve the outcome, decisions, assumptions and evidence, changed files, validation, blockers, unanswered user questions, and next step.
