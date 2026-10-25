---
"@maestria/agent-plugins": minor
"@maestria/opencode": minor
"@maestria/pi": minor
---

Directives are generalized for any project. The global em-dash ban is gone, and specialists name only the skills maestria ships (`diagnose`, `plan`, `docs-update`, `create-pull-request`), referring to any other skill by capability when one is installed. Testing guidance keeps its intent with softer absolutes: choose coverage before implementation instead of backfilling tests, and for complex features prefer end-to-end coverage with a reproducible artifact over many unit tests. A bug's reproduction is kept as a regression test unless an existing test already pins the behavior, and a bug that does not reproduce gets a defensive fix only when the user asks for one, labeled unverified.

Autonomous delivery now stops at the last allowed step when a user or project says "local only", "don't push", or "no PR", and pushes only to the existing remote. User-facing reporting (answering first, drafts, the watching line, how to ask for decisions) moves from the global rules to the orchestrator, so each specialist profile carries about 330 fewer words. Commits follow the repository's own convention, changesets are treated as one kind of release notes where a repository uses them, and the PR skill no longer contradicts itself about committing evidence files.
