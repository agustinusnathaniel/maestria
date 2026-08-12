---
name: sonar
description: Research only - read-only adventurer/planner specialists, STOP before implementation
pipeline: `@adventurer` or `@planner` -> optional distinct read-only specialist -> STOP
precedence: mode marker overrides trigger phrases
detection: case-insensitive keyword, [MODE: sonar] marker injected at front of message
---

[MODE: sonar]

## MODE: sonar (Research Only)

Activate research-only mode. Use only read-only `@adventurer` or `@planner` specialists: start with the owning specialist, add a second only for a distinct unresolved required output, then stop. Do not implement, write code, or create production files.
