---
'maestria': patch
---

`maestria install` and `update opencode` no longer migrate a `@maestria/opencode-v2` preview entry; that internal preview package is deprecated in favor of `@maestria/opencode`. Remove a leftover entry with `opencode plugin remove @maestria/opencode-v2`.
