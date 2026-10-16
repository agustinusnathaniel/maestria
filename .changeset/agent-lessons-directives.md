---
"@maestria/agent-plugins": minor
"@maestria/opencode": minor
"@maestria/pi": minor
---

Agents now reproduce a bug with the cheapest failing check before patching it, and report the evidence instead of patching when it does not reproduce. They keep that reproduction as a regression test only when it guards a real production failure existing tests miss, and every kept test names that failure and uses inputs production can produce.
