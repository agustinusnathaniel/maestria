# Install the consolidated plugin

Use `@maestria/agent-plugins` as the package artifact. Extract the npm archive or stage it with `maestria install agent-plugin`; staging validates and copies the package into a cache or requested destination. Activation belongs to the selected host.

The CLI's existing host commands install from the consolidated package: `maestria install claude-code`, `maestria install cursor`, `maestria install codex`, and `maestria install kimi-code`, `maestria install hermes`, and `maestria install omp`. The Codex install also manages native agent templates and a marked global instruction block. `maestria configure codex` changes native agent model settings. Review the CLI output and host's trust controls when activating the plugin.

For direct host installation, point the host's directory loader or marketplace at this package root. Claude Code can load a local directory with `claude --plugin-dir /absolute/path/to/plugin`. Devin accepts `devin plugins install --local /absolute/path/to/plugin`. Kimi Code accepts `/plugins install /absolute/path/to/plugin`, then `/reload` or a new session. For Cursor and ZCode, use their plugin marketplace or local-directory flow. See the host's current documentation linked in [support boundaries](docs/support.md).

Do not install both the superseded host package and this bundle into the same host namespace. The consolidated manifests retain the `maestria` plugin name.

Hermes uses the root portable manifest and shared skills. Installation does not imply activation: follow the host's explicit enable and trust flow, then discover the qualified skill namespace through `skills_list` and `skill_view`. The previous Python integration and its runtime behavior are retired.

OMP uses the root portable manifest and shared skills with no host-specific manifest: OMP parses the standard `plugin.json`, so no shim applies. `maestria install omp` stages `@maestria/agent-plugins` through `omp plugin install`. Remove the retired `@maestria/omp` native package first (`omp plugin uninstall @maestria/omp`); its session hooks, tool interception, and review-mode enforcement are retired with it, and per-agent model files no longer apply. See the [OMP integration guide](integrations/omp/README.md).

Devin local subagents do not load in cloud sessions. Kimi loads only its declared native skill and command roots; its `agents: []` avoids discovering the other hosts' profiles. Other hosts share exactly one `skills/` corpus. Claude's manifest relies on its default `skills/` scan and explicitly selects agent files so conventional root profiles are excluded.

No executable hooks, MCP servers, or recurring automations are declared. Native activation, permissions, sandboxing, delegation, and session lifecycle remain host controls. Live host loading is unverified.
