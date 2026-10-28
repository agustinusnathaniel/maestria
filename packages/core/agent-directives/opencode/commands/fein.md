---
name: fein
description: Full method - recon, design, implement, review
pipeline: recon and architecture-plan skills -> implementation in the main loop -> required blind review
precedence: mode marker overrides trigger phrases
detection: 'case-insensitive keyword, [MODE: fein] marker injected at front of message'
---

[MODE: fein]

## MODE: fein (Full Method)

Load `recon` and `architecture-plan` before implementing, implement in the main loop, and require one blind `@reviewer` pass with the review floors.
