# @maestria/deepseek

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) bundle that adds a `maestria` agent preset: an orchestrator that routes work through seven specialist subagents with independent review.

> This package is part of the maestria project. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope.

## Installation

```bash
# Recommended: via the maestria CLI
pnpx maestria@latest install deepseek

# Manual: DeepSeek Harness's own bundle installer
dsh plugin --profile web add @maestria/deepseek
```

Both install into the shipped `web` profile, the one that mounts agent presets. Restart `dsh web`, then choose **maestria** in the preset picker for a new session, or make it the default in settings. Uninstall with `pnpx maestria@latest uninstall deepseek` or `dsh plugin --profile web remove @maestria/deepseek`.

## What It Provides

- **The `maestria` agent preset** - the standard coding agent's tools with maestria's orchestrator as its persona and the global rules as a system-prompt section.
- **Specialist delegation tools** - `maestria_adventurer`, `maestria_architect`, `maestria_builder`, `maestria_diagnose`, `maestria_planner`, `maestria_reviewer`, and `maestria_writer`, each starting a one-shot child with that specialist's complete role.
- **Skills** - the `fein`, `sonar`, and `blitz` workflow modes, the `handoff` and `iteration-limits` utilities, and the bundled `create-pull-request` and `docs-update` skills.

## Support / Platform Notes

- **Provisional.** Verified against DeepSeek Harness `0.2.0-rc.2` with a real `dsh web` run and a local fake model; not yet against live inference. DeepSeek Harness is a developer preview, so later releases may need an update.
- Specialist tool filters are host-enforced: `adventurer`, `planner`, and `reviewer` keep only `read`, `glob`, `grep`, and `skill` (plus the host's `subagent` tool, which cannot delegate further), and `architect` and `diagnose` keep everything except `edit` and `write`. Everything else in the methodology is guidance under DeepSeek Harness's sandbox, approvals, and permission presets.
- The preset restates the rows of DeepSeek Harness's `standard` preset, because a bundle cannot extend another preset. It does not change any other preset.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/deepseek/) on the docs site
- [Runtime support matrix](https://github.com/agustinusnathaniel/maestria/blob/main/docs/runtime-support-matrix.md)

## Contributing

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## License

MIT. `cordis.patch.yml` restates rows from DeepSeek Harness's `standard` preset, Copyright (c) 2026 DeepSeek, MIT License.
