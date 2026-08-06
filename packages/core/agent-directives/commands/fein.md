---
name: fein
description: Full route - one thinker, worker, and reviewer
pipeline: one thinker -> one worker -> one reviewer; extra fanout only for evidenced risk
precedence: mode marker overrides trigger phrases
detection: case-insensitive keyword, [MODE: fein] marker injected at front of message
---

[MODE: fein]

## MODE: fein (Full Pipeline)

Explicit selection of the `full` route. Use one thinker suited to the concern, one worker, and one independent reviewer. The reviewer receives the original requirements, acceptance criteria, and diff, not the maker's self-assessment. Triage findings as `[fix]`, `[dismiss]`, or `[escalate]`; allow at most three bounded cycles, fail loud on unresolved `[fix]` findings, and block landing on any unresolved `[escalate]` finding until its required decision is recorded. Do not silently ship the last attempt. Add specialists or review lenses only when concrete evidence identifies additional risk. Scale expensive or slow models down to one review pass.
