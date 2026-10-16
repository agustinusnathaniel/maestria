---
"@maestria/agent-plugins": minor
"@maestria/opencode": minor
"@maestria/pi": minor
---

Agents now reproduce a bug with the cheapest failing check before patching it, and report the evidence instead of patching when it does not reproduce. They keep that reproduction as a regression test only when it guards a real production failure existing tests miss, and every kept test names that failure and uses inputs production can produce.

Plans list their PRs before any code (fixes first, refactors last, shared-behavior changes never riding along with a feature) with each PR's pre-merge and post-merge steps, and record settled decisions in the plan's decision log. PR bodies gain an optional `## Merge steps` section, a ready check runs before a PR is marked ready, and the title and body are re-read against the new head after every push.
