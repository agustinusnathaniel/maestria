---
description: Find and update the docs a change affects, including changelogs, release notes, and changesets. Use before finishing a change to behavior, interfaces, configuration, or operator workflows; when asked to fix stale docs or reconcile docs with code; or when a decision or status recorded in a plan or ADR changed. Not for changes with no documented surface or for drafting new product copy.
name: docs-update
---

<!-- Bundled from packages/core/agent-directives/skills/docs-update/SKILL.md by scripts/sync-bundled-skills.ts. Do not edit directly. -->

# Update Documentation

## 1. Find the sources

Name the behavior change and locate what describes it: the changed code or config, its tests, and the docs that claim to cover it.

## 2. Assess each category

Assess internal docs, user-facing docs, changelog or release notes, and changesets (where the repository uses them) separately: update each or record a concise reason it needs no update. Follow the project's documentation conventions and explicit docs opt-outs. Missing docs are not permission to create a large new hierarchy. Do not invent ADRs for a trivial change or new requirements; update a plan or ADR only when a recorded decision or status changed, amending rather than rewriting history.

## 3. Edit for the reader

Write each affected source for its reader: why first, then usage with examples. In content the user authored, make the clear edits and ask about unclear parts instead of changing them. Trim before adding, and state each concept once, as the principle and how to check it rather than its origin story. Split content into another file only when a distinct reader or branch needs it. Durable docs never live only in scratch or temporary locations.

## 4. Verify

Check factual claims against current code and config, and check that links resolve, examples run, and operator scripts or checks give their expected success or failure signals, using the repository's existing tools. A local docs task completes without publishing a PR and installs no tool without user or project authorization.

## 5. Summarize

Report the edits per category, the checks run with their results, and unresolved gaps.
