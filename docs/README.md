# Internal documentation

This directory contains maintainer-facing records. It explains why the project is structured as it is, records dated evidence, and preserves implementation history. It is not the primary installation guide for end users.

## Choose a document by task

| Need | Read |
| --- | --- |
| Understand the project and its design patterns | [VISION.md](../VISION.md) and [PATTERNS.md](../PATTERNS.md) |
| Change or contribute to the repository | [CONTRIBUTING.md](../CONTRIBUTING.md) and [AGENTS.md](../AGENTS.md) |
| Understand the canonical agent methodology | [`packages/core/agent-directives/`](../packages/core/agent-directives/) |
| Check repository-specific agent workflow | [`.maestria/workflow.md`](../.maestria/workflow.md) and [`.maestria/rules.md`](../.maestria/rules.md) |
| Read an architecture decision | [`docs/adr/`](adr/) |
| Check runtime support evidence | [Runtime support matrix](runtime-support-matrix.md) |
| Review documentation quality and drift | [Documentation audit](documentation-audit-2026-09-02.md) and [format guide](guides/doc-format.md) |
| Read the current Hermes contract | [Hermes current reference](hermes-plugin-current.md) |
| Read historical platform design | [Hermes design record](hermes-maestria-plugin.md) or the relevant ADR under [`docs/adr/`](adr/) |
| Find historical implementation plans or session notes | [`docs/plans/`](plans/) and [`docs/notes/`](notes/) |
| Use the public documentation | [`apps/docs/`](../apps/docs/) or [maestria.sznm.dev](https://maestria.sznm.dev) |

## Authority and audience

- `packages/core/agent-directives/` is authoritative for shared agent prompts and rules. Platform projections are generated; do not edit them directly.
- `.maestria/` adds repository-specific workflow guidance. It must not contradict the canonical directives.
- ADRs record decisions and their rationale. A later amendment or a runtime source can supersede an older claim.
- The runtime support matrix records dated evidence. Treat unpinned or untested evidence as research, not a support promise.
- `apps/docs/` and package READMEs explain usage to consumers. They should link to internal rationale rather than reproduce it.
- Plans and notes are historical unless their status says otherwise. Do not treat unchecked criteria or old version references as a current work queue.

## Keeping this index useful

When adding a document, give it a clear audience and purpose. Mark historical records, dated evidence, assumptions, and next steps explicitly. Update this index when adding a new document family or changing the authoritative source for an existing topic.
