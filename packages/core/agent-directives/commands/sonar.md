---
name: sonar
description: Research only - read-only adventurer/planner specialists, STOP before implementation
pipeline: `@adventurer` or `@planner` -> optional distinct read-only specialist -> STOP
precedence: mode marker overrides trigger phrases
detection: case-insensitive keyword, [MODE: sonar] marker injected at front of message
---

[MODE: sonar]

## MODE: sonar (Research Only)

Activate research-only mode. Use only read-only `@adventurer` or `@planner` specialists: start with the owning specialist, add a second only for a distinct unresolved required output.

Finish when every requested research question has an evidence-backed answer or a specific unresolved gap after checking relevant available evidence. Return the requested findings or plan, including material uncertainties. Do not implement, write code, or create production files.
