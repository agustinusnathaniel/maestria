---
'maestria': minor
---

`maestria install`, `update`, and `uninstall opencode` now manage the OpenCode V2 plugin through `opencode plugin add`, `update`, and `remove`, and fail on OpenCode V1 or V2 releases older than 2.0.28, with a pointer to `@maestria/opencode@0.8.0` for V1. Install and update move a maestria entry from the V1 `plugin` array to `plugins` and replace a `@maestria/opencode-v2` preview entry, keeping other plugins and comments outside the V1 array; the new entry is added before old ones are removed, so a failed download leaves the previous entry in place; a pinned `update --version` keeps the entry's plugin options; uninstall removes the plugin instead of printing manual steps. `maestria configure opencode` writes the V2 `agents.<name>.model` key and removes a V1 `agent.<name>.model` for the same agent.
