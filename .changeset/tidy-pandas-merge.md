---
'@maestria/opencode': patch
---

Fix plugin `config` hook dropping user-set agent config. The hook shallow-merged its bundled agents over the user's config (`{ ...input.agent, ...agents }`), replacing each of the 8 maestria agent entries wholesale and losing user-set keys (`model`, `variant`, `temperature`) from `opencode.jsonc`. It now deep-merges (es-toolkit `merge`), so per-agent `model`/`variant` config takes effect - subagents use their configured model instead of inheriting the primary agent's.
