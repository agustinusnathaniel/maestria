---
description: Prepare, update, revise, or review a pull request title and body draft, including read-only drafting with no publication tool. Use when the user asks to open, prepare, update, revise, or check PR text, or when delivery needs a reviewable PR draft. Do not use for code or diff investigation without PR preparation, explicit project no-PR workflows, local-only commits, or general git help.
name: create-pull-request
---

# Create Pull Request

Shape a reviewable PR title and body. Core owns outcome, evidence, review, and authorization. This skill owns only title and body conventions.

## When to use

Use when preparing, revising, or reviewing a PR title and body draft, updating a PR after a push that changed diff or verification, or checking PR text before delivery. Read-only drafting or revision counts as in scope even when no capture, upload, or publication tool is available; report the missing-evidence limitation instead of refusing.

Do not use for code or diff investigation where no PR preparation is requested, merge/release/production decisions, or protected-branch commits. Those stay under core authorization and review rules.

Stop if explicit project opt-out forbids PR creation or PR tooling install. Do not force a PR, install tooling, or work around the opt-out. Report the opt-out as the blocker.

## Title

Write an explicit Conventional Commits title. Do not infer it from commit message format. Keep it human-readable and scoped to the user-visible outcome or maintainer benefit.

## Body structure

Use literal `##` headings in this order:

1. `## Summary`
2. `## Changes`
3. `## Verification`
4. `## Visual evidence` (only when the change has a rendered surface)
5. `## Breaking changes` (only when applicable)

Project template precedence: when the project defines an explicit PR template, follow that template while preserving the required information above. Do not impose these literal headings on a replacement template. Map content across, then confirm nothing required was dropped.

Default body template (use when no project template applies):

```markdown
## Summary

[User-visible outcome or maintainer benefit, one short paragraph or concise bullets. No session IDs or internal execution metadata.]

## Changes

| File           | What changed                        | Why           |
| -------------- | ----------------------------------- | ------------- |
| `path/to/file` | Actual change and practical purpose | Review reason |

## Verification

[Checks run, results, unresolved gaps. Note review outcome briefly, no pasted identifiers.]

## Visual evidence

[Only for rendered surfaces: published artifacts, captions, current coverage; or `Not applicable: <concrete reason>`.]

## Breaking changes

[Only when applicable: migration guidance.]
```

Rules for `## Changes`: describe the actual change and practical purpose, not the editing action. Group related files with one rationale. List only symbols that help review. Omit session IDs and internal metadata.

Rules for `## Verification`: list checks and results honestly. Carry unresolved acceptance gaps. Never claim unverified results.

## Visual evidence where required

For rendered surfaces: capture, handoff, publication in the PR body, and readback are distinct stages. A local path alone does not satisfy PR-body publication. After any push that changes diff or verification, refresh the title and body, then read back the published body to confirm accessible artifacts, captions, and current coverage before reporting delivery complete.

If required visual evidence is missing, mark delivery incomplete and state the checked limitation. Do not waive an explicit user or project evidence requirement because tooling is missing.

## Freshness

After any push that changes the cumulative diff or verification evidence, update the title and body to match, then read back the published body before reporting delivery complete.

## Minimal fallback

If this skill is absent, disabled, or irrelevant to the project, write a sensible body with summary, file-level changes, checks, and breaking notes where applicable. A missing skill never blocks delivery and never authorizes bypassing core review or authorization.
