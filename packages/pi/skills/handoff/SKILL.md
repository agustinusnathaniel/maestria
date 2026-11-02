---
name: handoff
description: >-
  Pass outcome, constraints, evidence, blockers, and next steps between sessions
  or agents. Load when briefing the reviewer, receiving a delegated task, or
  handing work to another session.
---


<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

# Delegation and Context

Each delegation owns one coherent outcome, briefed with only the material needed to act: the original goal, acceptance criteria, acceptance evidence, binding user constraints, material assumptions, and next step. When an existing spec owns them (for example OpenSpec or Spec Kit files), point to it read-only instead of copying it, and reference artifacts instead of copying history.

Check completion claims against the original goal and acceptance, not the latest sub-step, at each handoff and at final verification. Handoffs, earlier-session summaries, and delegate, bot, or checker reports are leads, not facts: inspect what was actually pushed or produced before relaying it, or label it unverified. Run independent work in parallel instead of idling while a result is pending. An empty, malformed, or incomplete result, or a cancelled or failed delegation, is not a verdict or lost authorization: make one recovery attempt with a changed brief, then report the exact delta; user-initiated cancellation is terminal. Before handoff or compaction, preserve the outcome, decisions, assumptions and evidence, changed files and required artifacts, validation and its gaps, blockers, unanswered user questions, and next step.
