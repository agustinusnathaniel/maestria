---
name: maestria-command-blitz
description: "Fast implementation mode: skip gates, go directly to implementation"
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

[MODE: blitz]

## MODE: blitz (Fast Implementation)

Explicit low-risk/direct bypass: skip reconnaissance and design gates for familiar, low-risk work. Go directly to builder for implementation (or direct execution where the host supports it). Only use adventurer if the codebase context is genuinely unknown (not as a default step). Skip reviewer unless the user explicitly requests review.

Safety floors still apply. Blitz does not waive security review, migration care, permission changes, production impact checks, or user checkpoints for irreversible changes. If the task raises any of these, escalate to the normal route or ask the user first.
