---
"@maestria/agent-plugins": minor
"@maestria/opencode": minor
"@maestria/pi": minor
---

Agents now reproduce a bug with the cheapest failing check before patching it, and report the evidence instead of patching when it does not reproduce. They keep that reproduction as a regression test only when it guards a real production failure existing tests miss, and every kept test names that failure and uses inputs production can produce.

Plans list their PRs before any code (fixes first, refactors last, shared-behavior changes never riding along with a feature) with each PR's pre-merge and post-merge steps, and record settled decisions in the plan's decision log. PR bodies gain an optional `## Merge steps` section, a ready check runs before a PR is marked ready, and the title and body are re-read against the new head after every push.

Agents treat handoffs and delegate reports as leads to verify, check whether an item is already done before calling it pending, rate each finding by how real it is and what to do about it, ask one decision at a time with a concrete scenario and a recommendation, and put a requested draft last. Builders copy the shape of sibling files and challenge every guard against evidence, reviewers flag guards for impossible cases, and the orchestrator numbers brief items, gives each PR or branch one pushing owner, and verifies pushed work before reporting it.
