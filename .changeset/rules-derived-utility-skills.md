---
"@maestria/agent-plugins": patch
"@maestria/opencode": patch
"@maestria/pi": patch
---

Generate the `handoff` and `iteration-limits` utility skills from their global rules sections (`Delegation and Context`, `Bounded Repair and Fail-Loud Behavior`) instead of separate hand-written text, so the skills always match the policy. The global rules now state the stop conditions only the skill carried before: define a verifiable termination condition before looping, treat only `[fix]` blockers as repair work, and run final verification then stop instead of restarting a full review for a small fix. Pi's `handoff` skill description no longer claims a seven-field contract.
