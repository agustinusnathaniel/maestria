---
"maestria": minor
---

Add read-only `maestria doctor` diagnostics for skill setup. Per platform it reports plugin install state from detection, the recorded skill selection from `skills.json`, and the tool-observed inventory from `skills list --json`, with unmanaged copy warnings, shared canonical path notes, and actionable next commands. Supports `--json` and `--quiet`; home directories in paths render as `~`. A corrupt record fails loud before any observation; unknown platforms or agents degrade honestly with a note. No installs, updates, removals, or record writes.
