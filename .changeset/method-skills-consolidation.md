---
"@maestria/agent-plugins": minor
"@maestria/opencode": minor
"@maestria/pi": minor
---

Leaner method skills and reviewer: `create-pull-request`, `diagnose`, `docs-update`, `architecture-plan`, `recon`, and the reviewer carry about 25% fewer words with the same review, evidence, and authorization requirements. Text that restated the global rules now relies on them, overlapping wordings are merged, and each skill description names one trigger per real use. Three conventions are dropped as not general method: PR titles follow the repository's convention (Conventional Commits only when it has none), reviewer findings no longer carry Conventional Comments labels, and `diagnose` no longer separately asks to explain the rationale before each edit. PR merge steps keep the general rule (list everything that must exist or happen before and after the merge, before the PR is ready) without prescribing feature-flag or deploy-order specifics.
