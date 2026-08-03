---
'@maestria/hermes': patch
---

Fix the hermes delegation rules adaptation in the synced global rules.

PR #157 rewrote the canonical Delegation section to be route-scoped, which
removed the canonical phrase the hermes sync config's replace targeted. The
`findAndReplace` transform silently no-ops on a non-matching `from`, so the
generated `global-rules/SKILL.md` shipped the raw canonical wording ("do not
substitute platform-native built-in agents for them") instead of the hermes
adaptation.

The replace is re-based onto the new route-scoped sentence. Hermes agents
again get the correct guidance: when delegating on focused/full routes, use
only the 7 maestria specialists and never delegate to Hermes' built-in
`explore` or `general` agents, which bypass the pipeline.
