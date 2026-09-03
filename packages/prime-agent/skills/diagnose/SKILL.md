---
description: |-
  Systematic 6-step regression tracing: from error message
  to root cause to prevention.
  Use for: cryptic errors, regressions, production bugs, unclear root causes.
name: diagnose
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

You trace bugs systematically.

## Human-Facing Output

- **!!! Human-facing output.** Apply the canonical human-facing output contract to authored responses, reports, comments/docstrings, commit messages, PR titles/bodies/descriptions, and documentation. Never emit Unicode U+2014 EM DASH. Preserve code syntax, literals, quoted source, and user-provided text.

## Phase 0: Start from First Principles

Before diving into tracing steps, strip away assumptions about what might be broken. Ask yourself: "What's the simplest, most fundamental thing that could be wrong?" Let the evidence, not prior hypotheses, guide your investigation.

## Step 1: Error -> Source Location

Translate error message into actual source code:

- Find corresponding source file (not dist/minified)
- Identify exact line and function
- Search for unique strings if stack trace is minified

## Step 1.5: Check Environment (Autonomously)

Rule out environmental causes by gathering data directly - do not ask about these:

- Check relevant dependency manifests and lockfiles for recent changes using the project's diff/version-control tools
- Check `.env.example` vs `.env` for missing vars
- Check relevant runtime and package-manager versions for known incompatibilities
- Check working directory assumptions against actual project structure Document what you checked, what you ruled out, and any assumptions you made about the environment.

## Step 2: Source -> Git History

Find when the bug was introduced:

- `git blame` on the problematic line
- Read the commit message and diff
- Was it intentional, accidental, or a refactor? If no regression commit exists (line is old): the bug was always there but never exercised (missing test coverage). Document this.

## Step 3: Git History -> Blast Radius

Find ALL similar problems in the codebase:

- Search for the same unsafe pattern
- Create an audit table: File, Line, Pattern, Safe?, Notes
- Document which are safe vs unsafe

## Step 4: Blast Radius -> Minimal Fix

Fix the root cause with minimal changes:

- Fix root cause, not symptom
- Use existing dependencies - don't add new packages
- One-line fix > rewriting the function
- Add safeguards (try-catch, validation)
- Ask "is it safe?" before any system change

## Step 5: Fix -> Prevention

Prevent similar bugs:

- Consider regression tests where a durable contract or plausible recurrence justifies them (per Global Rules testing judgment)
- Consider linting rules to catch the pattern
- **!!! Preserve durable diagnostic lessons** - update an existing knowledge artifact when one fits; create one only when the findings have durable future value or the user/project requires a record.

## Step 6: Verify Fix

Confirm it works:

- Run existing tests
- Reproduce original error (should be fixed)
- Check for unintended side effects
- Prepare rollback plan **!!! Always verify before handoff** - Never present broken code.

## Rules

- **!!! Edit and system-change permissions follow the host policy** - explain the rationale before any change and use the platform's approval controls.
- **!!! Exhaust environment data** (lockfile, env vars, version mismatch, CWD) before asking; document assumptions with supporting evidence and proceed.
- **Parallelization:** different bugs in parallel; same bug = consolidate.

## Output Format & Handoff

Document: what was investigated, ruled out, root cause, fix, prevention, and tagged assumptions (`[verified]`/`[inferred]`).

## Skills

Load on trigger: `agent-browser`, `webapp-testing`, `logging-best-practices`, `dependency-updater`. Skip when no skill matches the bug category.
