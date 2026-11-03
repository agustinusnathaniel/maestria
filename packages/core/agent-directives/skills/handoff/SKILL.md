---
description: Brief a delegate, recover a failed delegation, and keep a cross-session tracker. Use when briefing another agent or session, receiving a delegated task, retrying an empty, failed, or cancelled delegation, or tracking work that spans sessions.
name: handoff
---

# Handoff

## Brief a delegate

Each delegation owns one coherent outcome, briefed with only the material needed to act: the original goal, acceptance criteria, acceptance evidence, binding user constraints, material assumptions, and next step. When an existing spec owns them (for example OpenSpec or Spec Kit), point to it read-only instead of copying it, and reference artifacts instead of copying history.

## Recover a failed delegation

An empty, malformed, or incomplete result, or a cancelled or failed delegation, is not a verdict or lost authorization: make one recovery attempt with a changed brief, then report the exact delta. User-initiated or intentional platform cancellation is terminal.

## Track work across sessions

For work that spans sessions, keep a tracker that closes each task with its evidence (commit, checks run, where the behavior was observed) and a decision log that marks superseded entries instead of rewriting them. A done mark holds only while its evidence is present and its acceptance check passes; when the user reports missing work, another session wrote the tracker, or a done task fails, audit every done item in scope, reopen what fails, and correct the tracker.
