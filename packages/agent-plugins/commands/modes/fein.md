<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

---
name: fein
description: Full pipeline - recon, design, implement, review
pipeline: thinker (recon/design/plan) -> worker (implementation) -> verifier (review)
precedence: mode marker overrides trigger phrases
detection: case-insensitive keyword, [MODE: fein] marker injected at front of message
---

[MODE: fein]

## MODE: fein (Full Pipeline)

Activate the `full` route. Use the dynamic thinker -> worker -> verifier pipeline and required review floors.
