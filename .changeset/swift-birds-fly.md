---
'maestria': minor
---

feat: support comma-separated platforms, multiselect, and "All platforms" in update/install

- `maestria update opencode,pi` and `maestria install opencode,pi` now accept comma-separated platform IDs
- Interactive mode uses multiselect (checkboxes) instead of single-select picker
- `maestria update` interactive mode adds an "All platforms" shortcut option
- `maestria install` interactive mode now supports selecting multiple platforms
