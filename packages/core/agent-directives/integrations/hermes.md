## Hermes Integration

Hermes consumes the portable root Agent Plugins v1 manifest and the eight root skills (`handoff`, `review-loop`, `implement`, `create-pull-request`, `docs-update`, `diagnose`, `recon`, and `architecture-plan`). Enable the package with the host's plugin flow, then discover the qualified skill names using `skills_list` and load them using `skill_view`; the namespace depends on the Hermes version, so do not assume one.

Portable installation supplies only the skills. It does not activate routing, modes, or specialist agents. For optional manual host context, this file, the package's `hermes.context.md`, holds the always-on core and this note; add it through a supported Hermes project-context file, since installing the package does not inject it. Hermes owns tools, permissions, delegation, and lifecycle.

See [Hermes portable packages](https://hermes-agent.nousresearch.com/docs/developer-guide/plugins#portable-agent-plugins-v1-packages).
