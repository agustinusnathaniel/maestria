---
"@maestria/agent-plugins": minor
"@maestria/opencode": minor
"@maestria/pi": minor
---

Plans that span sessions keep a tracker with evidence per task, and the orchestrator treats done marks as claims: it audits every done item in scope before resuming when the user reports missing work, another session wrote the tracker, or a done task fails.
