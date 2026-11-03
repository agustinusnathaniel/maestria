---
description: Draft, publish, or refresh a pull request title and body with its visual evidence, and check it is ready for review. Use when preparing or revising a PR, capturing or publishing evidence for a rendered change, after a push to an open PR, or before marking a PR ready.
name: create-pull-request
---

# Create Pull Request

## Scope

Drafting or revising PR text needs no capture, upload, or publishing tool. A project ban on creating PRs or installing tools stops only that operation: still draft, and report the blocked step.

For a multi-PR outcome, state each PR's scope, acceptance evidence, base branch, prerequisites, and review status in its draft, keep each description to its own diff, and check that no open PR already covers the scope.

## Title and body

Write an explicit title in the repository's convention (Conventional Commits when it has none), not inferred from commit messages, scoped to the user-visible outcome or maintainer benefit.

When the project defines a PR template, follow it, map the information below into it, and confirm nothing required was dropped. Otherwise use these literal `##` headings in this order:

```markdown
## Summary

[The user-visible outcome or maintainer benefit in a short paragraph or bullets.]

## Changes

| File           | What changed                        | Why           |
| -------------- | ----------------------------------- | ------------- |
| `path/to/file` | Actual change and practical purpose | Review reason |

## Verification

[Checks run with results, the review outcome, and unresolved acceptance gaps.]

## Visual evidence

[Only when the change touches a rendered surface: captioned captures, or `Not applicable: <concrete reason>`.]

## Breaking changes

[Only when applicable: migration guidance.]

## Merge steps

[Only when merging needs more than the merge: pre-merge and post-merge steps in order.]
```

In Changes, describe what changed and why rather than the editing action, group related files under one rationale, and name only symbols that help review. Keep session IDs and internal execution metadata out of the PR. Give the complete merge steps (everything that must exist or happen before and after the merge, in order) unasked before the PR is ready and whenever you call it ready or mergeable, never after the merge.

## Publishing

A draft-only request is complete when the title and body are usable and every outstanding item (publication, missing evidence, unchecked variants) is reported; it never presents itself as published. When asked to create or update the PR, publish with the host's existing tooling, checking its current help rather than remembered syntax, then read back the published body: it matches the current diff, attachments render, and links resolve. Report delivery only after that readback; an unavailable or forbidden publishing step leaves the outcome incomplete with the exact blocker.

## Visual evidence

A change to a rendered surface requires evidence. Capture, publication in the PR body, and readback are separate stages; a local path satisfies only the first.

- **Capture** the affected screen or interaction and its relevant responsive or state variants with an available browser or capture tool; a missing desktop display does not rule out headless capture, and a representative terminal transcript can serve for text-only CLI output. Inspect captures when vision is available, otherwise label them visually unverified. Keep artifacts at any workable path, including `/tmp`, and commit evidence files to a branch only when project policy requires it.
- **Record** each artifact as path, caption, and coverage gaps: what it shows and which variants remain unchecked. Report evidence as captured, unavailable with the checked limitation, or unnecessary with a concrete reason. Source-only documentation edits and mechanical moves that preserve rendering can reuse existing evidence; a refactor label or passing build does not establish unchanged visuals.
- **Present** evidence by changed screen or behavior, labeling each artifact's state, viewport, or theme. For UI changes default to a before/after table (Area | Before | After | What changed), or a captioned list for a single state. Pair captures with matching viewports and states, name the intended difference, disclose missing baselines instead of fabricating them, and put supplemental captures in a collapsible section when supported.
- **Publish** in the PR body as an attachment or accessible link with a caption, using authorized tooling whose upload support you checked in its current help. On GitHub, `gh pr create --attach` or `gh pr edit --attach` (recent `gh`) hosts captures on GitHub's CDN. In a PR stack, every PR carries its own evidence. If upload is unavailable, preserve the local artifact, give its path in the handoff, and state the attachment limitation.

Required evidence absent from the published body leaves delivery incomplete with the checked limitation; session-log references and comments do not count, and required evidence never silently becomes a follow-up. Optional illustration may be omitted with a reason.

## After a push

Re-read the approval and merge state, since a push can drop an approval, and re-read the title, body, and evidence against the new head: update what changed and remove what is no longer true. Replace captures whose appearance or behavior changed and update their captions and comparisons; keep intentional before baselines clearly labeled and never present a historical before as current. Refresh only affected content, not every commit or unrelated file. Then read back a published PR, or present the updated draft with its outstanding items.

## Ready check

Before marking a PR ready for review or calling it ready to merge: the branch is current with its base, the affected suites pass at the head, the whole diff has had a correctness pass, every CI check and review thread (bot threads included) is read and triaged with evidence (fixed, or answered with why not), no unresolved thread blocks merge, and the title and body are true at the head. Fix correctness findings by default; decline one only with evidence the case cannot occur (call order, locks, stored state) or a one-line known-limit reason in the body, and answer every part of a multi-part finding.
