<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

---
name: blitz
description: Fast implementation - skip recon/design/review gates
pipeline: @builder directly (skip gates unless codebase genuinely unknown)
precedence: mode marker overrides trigger phrases
detection: case-insensitive keyword, [MODE: blitz] marker injected at front of message
---

[MODE: blitz]

## MODE: blitz (Fast Implementation)

Speed mode: skip reconnaissance and design gates. Go directly to @builder for implementation. Only use @adventurer if the codebase context is genuinely unknown (not as a default step). Skip @reviewer unless the user explicitly requests review.
