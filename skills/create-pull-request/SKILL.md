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

For rendered surfaces, capture, handoff, publication in the PR body, and readback are distinct stages. A local path alone does not satisfy PR-body publication.

Capture the affected screen or interaction, including relevant responsive or state variants, with an available browser or capture tool; a missing desktop display alone does not rule out headless capture. For text-only CLI output, a representative terminal transcript can be sufficient. If vision is available, inspect the capture; otherwise label it visually unverified. Preserve the local artifact at any workable path, including /tmp; do not auto-commit screenshots unless project policy requires it.

Hand off implementer evidence as paths plus captions plus coverage gaps: each artifact states what it shows and which variants remain unchecked. The reviewer checks that coverage against the changed surface before delivery.

Publish required evidence in the PR body as an attachment or accessible artifact link with a descriptive caption, using supported authorized tooling; check the delivery tool current help for upload support instead of relying on cached syntax. Capture and upload are separate capabilities. If upload is unavailable, preserve the local artifact, give its path in the handoff, and state the PR attachment limitation.

Present evidence concisely by changed screen or behavior: label each artifact with its state and relevant viewport or theme. Use a before/after table when comparison helps and a short captioned list for a single state or when tables would shrink images. Pair comparable captures with matching viewports and states, name the intended difference, and disclose missing baselines or unchecked variants without fabricating them. Keep representative captures in the main section with supplemental captures in a collapsible section when supported.

For applicable changes, report evidence captured, unavailable with the checked limitation, or unnecessary with a concrete reason. Source-only documentation edits and mechanical moves preserving rendering can use existing evidence; a refactor label or passing build alone does not establish unchanged visuals. Keep capture effort proportionate to the changed surface.

If required visual evidence is missing, mark delivery incomplete and state the checked limitation. Do not claim delivery complete until the evidence is published in the PR body and the delivery owner has read back that body to verify its inclusion; local paths, session-log references, and comments alone do not satisfy this requirement. Do not waive an explicit user or project evidence requirement because tooling is missing: provide it or report the outcome incomplete with the exact blocker. Optional PR illustration may be omitted with a reason; required evidence cannot silently become a follow-up.

## Freshness

After any push that changes the cumulative diff or verification evidence, update the title and body to match, then read back the published body to confirm accessible artifacts, captions, and current coverage before reporting delivery complete. Read back the actual PR body as delivery owner; confirm attachments render or links resolve and evidence matches the current relevant diff. When a later change affects captured appearance or behavior, replace affected captures, update captions and comparisons, and remove obsolete or redundant PR body references; keep intentional clearly labeled before baselines and never present a historical before as current. Refresh only affected evidence, not every commit or unrelated file. Readback is a delivery-owner check, not a second full review.

## Minimal fallback

If this skill is absent, disabled, or irrelevant to the project, write a sensible body with summary, file-level changes, checks, and breaking notes where applicable. A missing skill never blocks delivery and never authorizes bypassing core review or authorization.
