---
description: Trace a bug, regression, failure, or crash to an evidence-backed root cause, then fix it or hand off the diagnosis. Use when the cause is unknown or disputed, when repeated fixes have not held, or when auditing where the same defect recurs.
name: diagnose
---

# Diagnose

Start from the observed failure and run the next check that distinguishes the plausible causes; skip any step below that cannot tell them apart. Stop investigating once evidence supports the root cause and the affected contract. A read-only assignment, or a host that does not permit edits, ends with the diagnosis and recommended repair for the implementer; otherwise continue through the fix and its verification.

## 1. Reproduce at the source

Map the error to its source file, line, and function, not dist or minified output; search unique strings when a stack trace is minified. Reproduce it at the smallest boundary and record the exact command, input, and output. When it does not reproduce, report what would reproduce it; a defensive fix the user still wants is labeled unverified.

## 2. Rule out the environment

When symptoms suggest configuration or runtime differences, check recent dependency manifest and lockfile changes, `.env` against `.env.example` (variable names only), runtime and package-manager versions, and working-directory assumptions. Record what you ruled out.

## 3. Read the history

To locate a regression, `git blame` the line and read the commit and its diff, considering source, caller, dependency, configuration, and environment changes. An old line alone does not date the failure; report the uncertainty when history cannot establish the trigger.

## 4. Measure the blast radius

When the cause is a shared defect or the task is an audit, search for the same pattern and report each site as safe or unsafe with its evidence, how real the risk is, and what to do, on the scales in the global Reporting rules. Use a table when comparison helps.

## 5. Fix the root cause

Fix the cause, not the symptom, with the smallest correct repair rather than the fewest lines.

**!!! Never present broken code:** re-run the reproduction to confirm the fix, run the existing tests, check for side effects, and note how to roll the change back. Consider a lint rule that would catch the pattern, and record a durable lesson in an existing knowledge artifact when one fits; create one only when the finding has lasting value or the user or project requires a record.

## Report

State what was investigated and ruled out, the root cause with its evidence, the fix or recommended repair, verification, prevention, and assumptions tagged `[verified]` or `[inferred]`.

When installed, use a browser-automation skill for browser-visible failures, a logging skill for missing or misleading logs, and a dependency skill for dependency-caused failures.
