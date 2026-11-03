---
description: Brief a delegate, recover a failed delegation, and keep a cross-session tracker. Use when briefing another agent or session, writing a handoff document for another session, host, or person, receiving a delegated task, retrying an empty, failed, or cancelled delegation, or tracking work that spans sessions.
name: handoff
---

# Handoff

## Brief a delegate

Each delegation owns one coherent outcome, briefed for the delegate's task with only the material needed to act: the original goal, acceptance criteria and evidence, binding user constraints, any hold or approval gate (a gate sent in a later message usually arrives after the delegate has acted), material assumptions, the method skills to load, and the next step. Mark what you verified apart from what you only believe: an unverified "X is done" becomes the delegate's premise. Reference specs (for example OpenSpec or Spec Kit) and other artifacts read-only by path or URL instead of copying them or the history, and only ones the delegate can reach from where it runs. Pass a long brief as a file, never interpolated into a shell command, where backticks and `$` silently mangle it. The brief is ready when a fresh agent could act on it cold without asking you to re-explain.

## Recover a failed delegation

An empty, malformed, or incomplete result, or a cancelled or failed delegation, is not a verdict or lost authorization: make one recovery attempt with a changed brief, then report the exact delta. User-initiated or intentional platform cancellation is terminal.

## Track work across sessions

For work that spans sessions, keep a tracker that closes each task with its evidence (commit, checks run, where the behavior was observed) and a decision log that marks superseded entries instead of rewriting them. A done mark holds only while its evidence is present and its acceptance check passes; when the user reports missing work, another session wrote the tracker, or a done task fails, audit every done item in scope, reopen what fails, and correct the tracker.
