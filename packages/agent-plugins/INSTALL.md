# Install the consolidated plugin

Use `@maestria/agent-plugins`. Extract the npm archive or run `maestria plugin install` to stage its publishable payload. Staging validates the portable manifest, skills, and optional MCP configuration; it does not validate every native host schema or activate the plugin.

For Git/local loaders, select `packages/agent-plugins/`. All host manifests and generated resources are at this directly installable root. A local npm package with explicit `files` metadata stages its npm publish selection without running lifecycle scripts. Directory-only plugins retain their legitimate resources. Existing destination directories are never silently overwritten.

Use `maestria install claude-code`, `cursor`, `codex`, `kimi-code`, `omp`, or `hermes` for the existing managed host flows. Select the matching [public host guide](https://maestria.sznm.dev/agent-plugins/) for its activation, trust, reload, update, and removal steps. Do not enable both this plugin and a superseded package in the same host namespace.

## Full methodology and utility-only installations

Claude Code, Cursor, Kimi Code, ZCode, and OMP use native workflow commands with complete context. Devin exposes the workflows through its explicitly selected compatibility skill directory. The root `skills/` contains only `handoff` and `iteration-limits`.

Codex marketplace installation supplies those two utilities. `maestria install codex` additionally installs complete native agent TOMLs and a marked global instruction block containing policy, routing, and FEIN/SONAR/BLITZ mode definitions. Invoke mode keywords or markers in the user prompt. `maestria configure codex` changes native model settings; updates preserve user-selected runtime settings and unrelated instructions. Start a new/reloaded session for changed instructions according to the host lifecycle.

Hermes and generic portable clients receive utility skills only. Hermes does not automatically load the packaged agent, command, or policy files. Its optional manual setup uses the content of `rules/hermes/context.md` in the applicable project context file, preserving existing instructions and respecting the host's context precedence. Follow the [Hermes guide](https://maestria.sznm.dev/agent-plugins/hermes/getting-started/installation/) before doing so. There is no Python adapter.

The Hermes migration disables the retired Python adapter only after replacement installation succeeds and retains legacy user data. OMP users remove the retired `@maestria/omp` executable plugin before enabling this replacement; its old hooks, mode persistence, and interception do not carry over.

## Host examples

Claude Code accepts `claude --plugin-dir /absolute/path/to/packages/agent-plugins`. Its manifest explicitly lists native agent files; a directory agent selector is rejected by the tested validator.

Devin accepts `devin plugins install --local /absolute/path/to/plugin` for a machine-local linked plugin, or the Git repository subdirectory form for personal/cloud installation. Cloud sessions do not load custom plugin agents. Kimi Code's plugin/reload flow selects only its native profile directory. Cursor and ZCode use their host marketplace or local-plugin controls.

Package inclusion, native-loader discovery, and model behavior are different verification claims. See [support boundaries](docs/support.md) and the repository [host verification record](https://github.com/agustinusnathaniel/maestria/blob/main/docs/plugin-host-verification.md) for what has actually been exercised.
