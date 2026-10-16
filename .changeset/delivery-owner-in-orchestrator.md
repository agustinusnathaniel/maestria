---
"@maestria/agent-plugins": minor
"@maestria/opencode": patch
"@maestria/pi": patch
---

Delivery ownership moves from the global rules into the orchestrator: workflow modes, autonomous commit, push, and PR creation, PR slicing, and the PR skill pointer. Commands and always-on routing context still carry the complete policy, while each specialist profile and specialist request drops about 250 words of rules it could not act on. A specialist invoked directly, without a workflow command or the orchestrator, still follows commit and protected-branch rules but no longer pushes or opens PRs without asking. On OpenCode, the plugin keeps sending the delivery rules to OpenCode's own agents such as `build` and `plan`, so only maestria's specialist subagents drop them.
