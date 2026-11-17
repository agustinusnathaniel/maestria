---
"maestria": minor
---

Remove obsolete CLI compatibility code. `maestria doctor` is removed. `update` and `uninstall` no longer remove skill copies installed by CLI versions before 2026-10-13; remove those copies by hand with the `skills` CLI. `install`, `update`, and `uninstall` no longer move OpenCode V1 `plugin` entries; the CLI manages only the V2 `plugins` array and still requires OpenCode 2.0.28 or later.
