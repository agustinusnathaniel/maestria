---
"@maestria/opencode": patch
---

Remove Vite+-specific CLI references from plugin agents and rules

Replace hard-coded `vp check` / `vp test` references with generic
validation language so the plugin is toolchain-agnostic.
