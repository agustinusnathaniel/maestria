---
"maestria": minor
---

Stop installing the `create-pull-request` and `docs-update` skills through the `skills` CLI: every maestria package now bundles them. `install`, `update`, and `setup` no longer accept `--skills`, `--exclude-skills`, or `--maestria-skills` and fail with a pointer if one is passed. `update` and `uninstall` remove the copies earlier CLI versions installed, using the existing ownership record, and leave copies you installed yourself alone; `doctor` reports any copies that remain. `setup --skill-source` still installs external skill repositories such as `agustinusnathaniel/skills`.
