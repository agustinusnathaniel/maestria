---
"@maestria/agent-plugins": minor
"@maestria/opencode": minor
"@maestria/pi": minor
---

Re-tiered directives: the always-on rules and main loop carry about 30% fewer words, keeping only rules that must apply on every turn, and the main loop's Routing section is now one skill map with a trigger line per method skill. Task-shaped method moves into skills: the new `implement` skill holds implementation judgment, reuse, testing, and comment rules (the reviewer profile embeds it); `iteration-limits` is renamed `review-loop` and holds the reviewer briefing, triage order, and pass rules; `handoff` holds the delegation brief, failed-delegation recovery, and the cross-session tracker; `create-pull-request`, `docs-update`, `architecture-plan`, and `diagnose` take the text only their task needs. Two floors are added: a negative result counts only from a source that could have shown the positive, and people are referred to by id, count, or hash, never email or name, in PR text, evidence, logs, and messages. `handoff`, `review-loop`, and `implement` now ship in every maestria package. Load `review-loop` where you loaded `iteration-limits`.
