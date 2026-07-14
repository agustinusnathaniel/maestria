---
'maestria': minor
---

Enhanced interactive prompts with grouped multiselect and `a` key toggle-all

The `update` and `install` commands now use a grouped multiselect prompt
with an "All platforms" toggle header and a visible `a` keyboard shortcut
to select/deselect all options at once.

Fixed `maestria install kimi-code` and related commands: the old
`kimi plugins` CLI subcommand was removed in Kimi Code v0.23.6. The
installer now writes plugin files directly to disk and uses the
`installed.json` registry format documented in Kimi Code's plugin store.
