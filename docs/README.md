# Engineering Documentation

## Purpose

Find the current instructions, design rationale, and historical context needed to work on Maestria.

## Audience

Contributors, maintainers, and platform adapter authors. To install or use Maestria, start with the [public documentation](https://maestria.sznm.dev) or a [package README](../README.md#packages).

## Start with Your Task

| Task | Read |
| --- | --- |
| Set up the repository and submit a change | [Contributing](../CONTRIBUTING.md) |
| Understand project goals and workflow patterns | [Vision](../VISION.md) and [Patterns](../PATTERNS.md) |
| Work as an agent in this repository | [Repository instructions](../AGENTS.md) |
| Edit prompts, rules, or workflow modes | [Canonical directive ownership](../packages/core/agent-directives/README.md) |
| Check a platform's support boundary | [Runtime support matrix](runtime-support-matrix.md) |
| Choose verification for a change | [Testing philosophy](testing.md) and [completion checklist](checklist.md) |
| Write or revise documentation | [Documentation conventions](guides/doc-format.md) |
| Review documentation quality and follow-up work | [Documentation audit](documentation-audit.md) |

## Find a Design Decision

ADRs record why a design was chosen, including alternatives and trade-offs. Read the relevant record before changing architecture; use current guides and source code to confirm present behavior.

| Area                                                      | Records                          |
| --------------------------------------------------------- | -------------------------------- |
| Shared methodology, sync, tooling, and package boundaries | [Core ADRs](adr/core/)           |
| OpenCode permissions and workflow modes                   | [OpenCode ADRs](adr/opencode/)   |
| Kimi Code distribution and integration                    | [Kimi Code ADRs](adr/kimi-code/) |
| Cursor integration                                        | [Cursor ADRs](adr/cursor/)       |
| Hermes integration and orchestration                      | [Hermes ADRs](adr/hermes/)       |
| Pi and Oh My Pi ecosystem and lifecycle                   | [Pi ADRs](adr/pi/)               |

## Plans and Research

[Plans](plans/) and [notes](notes/) preserve implementation and investigation context. Check each document's status and evidence date before treating it as current guidance. The [Hermes design document](hermes-maestria-plugin.md) describes the current plugin design and architecture; use the [Hermes package README](../packages/hermes/README.md) for installation and current user guidance.

## Dated Evidence

- [verified] 2026-09-05: paths checked against the repository documentation inventory. The public site source is `apps/docs/`; this checkout has no `apps/website/`.

## Next Step

Choose the document for your task above. When adding a new engineering guide, link it here if it provides a new entry point.
