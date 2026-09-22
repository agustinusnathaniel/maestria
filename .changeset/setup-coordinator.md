---
"maestria": minor
---

Add optional `maestria setup` coordinator across ecosystem tools and skills. Detection stays read-only (platforms, record, doctor snapshot, binary `--version` probes, xtarterize PATH lookup); mutations run only after the review screen plus final confirm. Ecosystem tools report detected or manual steps and are never auto-installed; xtarterize runs `add agent/skills-install --json --cwd <dir>` gated on the JSON status field with `.gitignore` changes reported; skill sources install per-source project/global scope via the skills CLI transport; Maestria skills reuse the existing selection record and `--skills`/`--exclude-skills` semantics with no other state writes. Non-TTY requires full flags plus `--yes`; reports are per action with resume guidance and idempotent reruns.
