# @maestria/pi

A [Pi coding agent](https://pi.software/) extension that brings Maestria's structured agent orchestration - specialist delegation, workflow modes, and maker/checker review - to Pi.

> This package is part of the Maestria project. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope.

## Installation

```bash
# Recommended: via the maestria CLI (installs the peer dependency too)
pnpx maestria@latest install pi

# Manual: install the required peer dependency first, then the extension
pi install npm:@gotgenes/pi-subagents
pi install npm:@maestria/pi
```

Uninstall via `pnpx maestria@latest uninstall pi`. The `@gotgenes/pi-subagents` peer dependency is shared with other Pi extensions; only remove it separately if nothing else needs it.

## What It Provides

- **4 methodology skills** - orchestrator dispatcher, global agent rules, handoff contract, and iteration limits, injected into every session.
- **3 workflow modes** - `/fein` (full pipeline), `/sonar` (research only), `/blitz` (fast implementation).
- **Compaction preservation** - session state survives compaction with structured summaries.
- **Subagent dispatch** - delegation to specialist subagents via the `@gotgenes/pi-subagents` peer package.
- **Maker/checker split** - `/review` mode blocks destructive tools where Pi supports it.
- **Root project customization** - `.maestria/workflow.md` then `.maestria/rules.md` from the session directory, injected every turn as subordinate guidance (never waives safety, authorization, or host permissions).

## Root Project Customization

Place optional `.maestria/workflow.md` (sequencing) and `.maestria/rules.md` (rules) at the root of the directory you open the session in. Scope is root-only: no ancestor scan, no nested inheritance, and the root is the host-selected session cwd read live each turn (never a process-global). Files are re-read in full on every `before_agent_start` turn, so additions, edits, and deletions apply on the next turn with no restart; nothing is persisted to session entries or compaction state, and post-compaction turns pick up the same fresh read. Absent or empty files leave the prompt unchanged. A present-but-unusable file (directory, special file, unreadable, unresolvable, or a symlink escaping the root) surfaces via a UI notification plus a STOP banner in the system prompt telling the model to report the error and wait, instead of running with silently absent config. Diagnostics name only the relative file and the failure kind. Whether subagent turns automatically receive the same injection is unverified, so delegation briefs still carry the active constraints. Limitation: the Pi host swallows `before_agent_start` handler exceptions, so a broken file cannot cancel the model call itself; the notification plus banner is the loudest supported signal.

## Support / Platform Notes

- Subagent dispatch depends on the `@gotgenes/pi-subagents` peer package; the maestria CLI installs it for you.
- The methodology is advisory prompt guidance; the maker/checker split is enforced at the tool level only where Pi supports review-mode tool blocking.
- Pi-specific: `@maestria/omp` is a separate package for Oh My Pi.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/pi-omp/) on the docs site (shared with `@maestria/omp`)
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/pi/CHANGELOG.md)

## Contributing

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## License

MIT
