---
'@maestria/prime-agent': patch
---

Reuse the npm pack dry-run result across package assertions so the packaging tests do not exceed Vitest's per-test timeout.