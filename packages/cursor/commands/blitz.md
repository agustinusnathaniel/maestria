---
name: blitz
description: Fast Maestria implementation via builder (skip recon/design unless unknown)
---

[MODE: blitz]

## MODE: blitz (Fast Implementation)

Execute fast implementation via **builder** directly.

- Skip reconnaissance and design unless the codebase is genuinely unknown.
- Skip review unless the result needs validation (or the user asks).

Load the `orchestrator` skill if coordination is needed. Prefer a single `Task` to `builder` with a clear handoff.

If the user provided a goal after `/blitz`, implement that goal now.
