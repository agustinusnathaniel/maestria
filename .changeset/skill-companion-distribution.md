---
"maestria": minor
---

Install, update, and reconcile the `create-pull-request` methodology skill through the official `skills` CLI instead of bundling skill bodies into plugins. `install` and `update` accept `--skills` (CSV, or `none`), `--exclude-skills` (CSV), and `--yes`; per-platform selections persist only after actual success, independently installed copies are never adopted or deleted, and shared native skill directories are preserved while another owned platform still uses them.
