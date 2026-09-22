---
description: Carry persistent spec intent across delegation steps to reduce rework risk. Use when a multi-step task has evolving requirements, when handoffs lose prior decisions, or when an external spec already owns truth. Do not use for tiny single-step edits with no follow-on work.
name: spec-contract
---

# Spec Contract

You are the agent keeping one lightweight intent contract alive across steps. Advisory guidance only, separate from state: it never replaces the owning spec and never auto-syncs anything.

## 1. Detect the owning truth, do not duplicate it

First match wins: if `openspec/specs` or `openspec/changes` exists, it owns truth, reference it read-only; elif `specs/<feature>` plus a constitution file exists, it owns truth, reference it read-only; else use the inline 7-slot header below. Never modify truth files without the owning workflow.

## 2. Carry the 7-slot header

Keep intent, requirements, constraints, decisions, acceptance, current task, refs/blockers. Omit empty slots, mark unknowns `[inferred]`, and keep each slot to one or two lines.

## 3. Borrowed patterns

Mark ambiguity explicitly; analyze read-only at the owning source; converge with append-only notes, never rewrites; point the review step at the owning checklist; split work into phased tasks; frame each step as current truth plus delta plus verified implementation equals updated truth.

## 4. Workflow sketches

Tiny: header stays in the task thread, no file. Ordinary: one header carried across two to three steps. Complex: header plus phased tasks with per-phase acceptance. Architectural: header plus a decision record reference before building. Bug fix: header records symptom, cause, and regression check. Refactor (no behavior change): header pins unchanged acceptance. Research-only: header only, stops without implementing. Existing external spec: header is pointers to the owning spec, no copied content.

## 5. Example

- Intent: fix checkout total rounding [inferred]
- Requirements: totals match line items
- Acceptance: existing rounding tests pass
- Current task: reproduce with one failing case
- Refs: openspec/changes/fix-rounding (owns truth)

OpenSpec-detected shape: header slots map to the change proposal fields, proposal owns truth. Spec Kit-detected shape: header slots map to spec plus constitution fields, those files own truth.

## 6. Keep it cheap

Tiny changes stay cheap: no mandatory dependency, no auto-sync, no vendored schemas. Proportional process only: outcome over activity, minimal context, portable and vendor independent, loaded only when relevant.
