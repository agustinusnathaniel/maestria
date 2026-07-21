---
'@maestria/kimi-code': patch
'maestria': patch
---

refactor: switch kimi-code to npm-based install; sync plugin manifest version

- Switch from git-based codeload to npm-based install (`npm pack @maestria/kimi-code`)
- Fix `maestria update kimi-code` version comparison (was always re-downloading)
- Sync `kimi.plugin.json` version with `package.json` (0.1.0 → 0.4.6)
- Add `publishConfig` for npm publish readiness
