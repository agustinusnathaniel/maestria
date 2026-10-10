# Install the consolidated plugin

Use `@maestria/agent-plugins` as the package artifact. Extract the npm archive or stage it with `maestria plugin install`; staging validates and copies the package into a cache or requested destination. Activation belongs to the selected host.

The CLI's existing host commands install from the consolidated package: `maestria install claude-code`, `maestria install cursor`, `maestria install codex`, and `maestria install kimi-code`, `maestria install hermes`, and `maestria install omp`. The Codex install also manages native agent templates and a marked global instruction block. `maestria configure codex` changes native agent model settings. Review the CLI output and host's trust controls when activating the plugin.

For a repository checkout, point the host's directory loader or marketplace at `packages/agent-plugins/plugin/`. The source package directory is not an installation root. Published npm archives are already flattened, so use their extracted root. Claude Code can load a local directory with `claude --plugin-dir /absolute/path/to/plugin`. Devin accepts `devin plugins install --local /absolute/path/to/plugin` for a machine-only install; without `--local` the plugin joins the personal scope and syncs to cloud sessions and other devices. See the host's [install forms](https://docs.devin.ai/cli/extensibility/plugins/overview#installing-a-plugin). Plugin changes apply to new sessions; use Reindex plugins on the Customize page to refresh the web listing (see [indexing](https://docs.devin.ai/product-guides/plugins)). Kimi Code accepts `/plugins install /absolute/path/to/plugin`, then `/reload` or a new session. For Cursor and ZCode, use their plugin marketplace or local-directory flow. See the host's current documentation linked in [support boundaries](docs/support.md).

Do not install both the superseded host package and this bundle into the same host namespace. The consolidated manifests retain the `maestria` plugin name.

Hermes uses the root portable manifest and shared skills. Installation does not imply activation: follow the host's explicit enable and trust flow, then discover the qualified skill namespace through `skills_list` and `skill_view`. The previous Python integration and its runtime behavior are retired.

OMP uses the root portable manifest and shared skills. `maestria install omp` stages `@maestria/agent-plugins` through `omp plugin install`. Follow OMP's plugin and skill discovery flow to activate the shared methodology; portable skills do not establish a delegation API, permissions, or session lifecycle. The retired `@maestria/omp` runtime package is no longer supported. See the [OMP integration guide](integrations/omp/README.md).

Devin local subagents do not load in cloud sessions. Kimi's manifest selects the shared `skills/` corpus and Kimi-specific command aliases; `agents: []` avoids discovering other hosts' profiles. Manifests select host resources explicitly where the host supports selectors; a portable skill corpus alone does not select or activate native profiles from other integrations.

No executable hooks, MCP servers, or recurring automations are declared. Native activation, permissions, sandboxing, delegation, and session lifecycle remain host controls. See the support boundaries for the specific host-loading checks and their limits.
