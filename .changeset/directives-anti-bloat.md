---
"@maestria/agent-plugins": minor
"@maestria/opencode": minor
"@maestria/pi": minor
---

Leaner always-on directives: the global rules and main loop carry about 16% fewer words with the same safety, authorization, and review floors. Overlapping rules are merged, procedure only some tasks need (migration cleanup, writing docs for their reader) moves into the skill that loads for it, the rerun-once and held-PR conventions are dropped, and two rules are added in place of existing text: never print secrets or anything derived from them into tool output or logs, and a later cleanup never undoes an earlier accepted review fix.
