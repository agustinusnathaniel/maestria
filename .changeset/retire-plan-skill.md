---
"@maestria/agent-plugins": minor
"@maestria/opencode": minor
"@maestria/pi": minor
---

The bundled `plan` skill is removed; current models and host plan modes plan well, and the architect still writes phased plans directly. Its durable rules move into the directives: for work that spans sessions, the orchestrator keeps a tracker that closes each task with its evidence and a decision log that records settled decisions as they are made and marks superseded entries instead of rewriting them, and the architect gives every compatibility shim in a migration a removal condition or a reason to keep it. Packages now ship five skills (`handoff`, `iteration-limits`, `create-pull-request`, `docs-update`, `diagnose`), and `npx skills add agustinusnathaniel/maestria` no longer lists `plan`.
