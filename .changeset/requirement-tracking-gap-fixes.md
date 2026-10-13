---
"@maestria/agent-plugins": patch
"@maestria/opencode": patch
"@maestria/pi": patch
---

Close behavior gaps behind frequent user corrections. Every brief and handoff now restates the original goal and acceptance criteria (pointing to an owning OpenSpec or Spec Kit spec when one exists), and completion claims are checked against them rather than the latest sub-step; reviewers flag requirement drift. Agents read user-supplied references and the original requirement in full, ask before rewriting content the user authored, meet an explicit request for comprehensive work instead of trimming to the smallest route, fix pre-existing issues in scope only when asked (otherwise report them), avoid collateral edits and deletions, take already-authorized routine next steps (commit, push, PR) without asking again, and explain results in plain language. The optional `spec-contract` skill is retired; its intent now lives in the always-on rules and the generated `handoff` skill.
