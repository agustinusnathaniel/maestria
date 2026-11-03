# @maestria/deepseek

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) bundle that adds a `maestria` agent preset: a main loop that investigates, implements, and delivers each change, with git and generated-file guards and one read-only reviewer.

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

- **The `maestria` agent preset** - the standard coding agent's tools with maestria's main loop as its persona and the global rules as a system-prompt section. Project-root `.maestria/workflow.md` and `.maestria/rules.md` are read into the context on every turn.
- **Guards** - before each `bash`, `edit`, or `write` call, the shared maestria hook policy denies git hook bypasses (`--no-verify`, a one-off `core.hooksPath`) and asks, through DeepSeek Harness's own approval prompt, before commits or pushes to protected branches, force pushes, discarding work, edits to generated files, and email addresses in commit or PR text.
- **The reviewer** - the `maestria_reviewer` tool starts a child on the `maestria-reviewer` preset, which mounts only read, search, and skill tools: no shell, edit, write, or delegation tool. Its answer returns to the main loop when it settles.
- **Skills** - the `fein`, `sonar`, and `blitz` workflow modes and maestria's method skills (`recon`, `architecture-plan`, `diagnose`, `implement`, `docs-update`, `create-pull-request`, `handoff`, `review-loop`).

## Support / Platform Notes

- **Provisional.** Verified against DeepSeek Harness `0.2.1-rc.5` with a real `dsh web` run and a local fake model; not yet against live inference. DeepSeek Harness is a developer preview, so later releases may need an update.
- The reviewer's read-only role is host-enforced: its preset mounts no tool that writes or runs commands. The guards stop or ask before the calls they classify; everything else in the methodology is guidance under DeepSeek Harness's sandbox, approval policy, and permission presets. Under an approval policy of `never`, a guard ask is rejected.
- The preset restates the rows of DeepSeek Harness's `standard` preset, because one preset cannot extend another. It does not change any other preset.
- Project files and the guards read the local filesystem, so remote or SSH workspaces are not supported yet.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/deepseek/) on the docs site
- [Runtime support matrix](https://github.com/agustinusnathaniel/maestria/blob/main/docs/runtime-support-matrix.md)

## Contributing

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## License

MIT. `cordis.patch.yml` restates rows from DeepSeek Harness's `standard` preset, Copyright (c) 2026 DeepSeek, MIT License.
