---
description: Trace a bug, regression, failure, or crash to an evidence-backed root cause, then hand off or apply the minimal fix. Use when the cause is unknown or disputed, or when auditing where the same defect recurs.
name: diagnose
---

<!-- Bundled from packages/core/agent-directives/skills/diagnose/SKILL.md by scripts/sync-bundled-skills.ts. Do not edit directly. -->

# Diagnose

You are tracing a failure to its root cause. Start from the observed failure and choose the next check that distinguishes the plausible causes. The steps below are investigation aids, not a mandatory itinerary: skip a step that cannot tell the remaining causes apart.

Stop investigating when the root cause and the affected contract are supported by evidence. A read-only assignment ends there with a diagnosis for the implementer; an assignment that permits repair continues through the fix and its verification.

## 1. Map the error to source

- Find the corresponding source file (not dist or minified output) and the exact line and function.
- Search for unique strings when a stack trace is minified.
- Reproduce the failure with the cheapest failing check at the smallest boundary that shows it, recording the exact command, input, and output. If it does not reproduce, do not patch on a guess: report the evidence and what would reproduce it. If the user still wants a defensive fix, label it unverified.

## 2. Rule out the environment

When symptoms suggest configuration or runtime differences, gather the data directly:

- Recent changes in the relevant dependency manifests and lockfiles, using the project's version-control tools.
- Missing variables in `.env` compared with `.env.example`, without exposing secret values.
- Runtime and package-manager versions with known incompatibilities.
- Working-directory assumptions against the actual project structure.

Record the checks, ruled-out causes, and material assumptions.

## 3. Read the history

When it helps locate a regression or explain surprising behavior, run `git blame` on the problematic line and read the commit message and diff. Consider source, caller, dependency, configuration, and environment changes. An old line alone does not establish when the failure began; report the uncertainty when history cannot establish the trigger.

## 4. Measure the blast radius

When the cause indicates a shared defect or the scope includes an audit, search for the same unsafe pattern and report each affected site as safe or unsafe with its evidence, how real the risk is (happening, real but unobserved, edge case, known and accepted, needs a check), and what to do (fix now, fix when touching, ask first, skip, already in progress). Use a table when comparison helps.

## 5. Fix the root cause, or hand it off

If the assignment is read-only or the host does not permit edits, hand the supported diagnosis and the recommended repair to the implementation owner. Otherwise repair it:

- Fix the root cause, not the symptom, with the smallest correct repair rather than the fewest lines.
- Prefer existing dependencies; weigh any addition against scope, maintenance, and authorization constraints.
- Add validation or error handling only where it addresses the demonstrated cause.
- Check the consequence of a system change and obtain any missing authorization.
- **!!! Edits and system changes follow host policy** - explain the rationale before the change and use the platform's approval controls.

**!!! Verify before handoff - never present broken code.** Reproduce the original failure and confirm it is fixed, run the existing tests, check for unintended side effects, and note how to roll the change back.

## 6. Prevent recurrence

- Keep the reproduction as a regression test unless an existing test already pins the behavior; name the failure it catches and use only inputs production can produce. Consider a lint rule that catches the pattern.
- Preserve durable diagnostic lessons: update an existing knowledge artifact when one fits; create one only when the findings have durable future value or the user or project requires a record.

## Report

State what was investigated, what was ruled out, the root cause with its evidence, the fix or recommended repair, verification, prevention, and tagged assumptions (`[verified]` or `[inferred]`).

## Skills

When installed, use a browser-automation skill for browser-visible failures, a logging skill for missing or misleading logs, and a dependency skill for dependency-caused failures. Skip when no skill matches the bug category.
