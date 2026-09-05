# Installing @maestria/deepseek

Requirements: a DeepSeek Harness (`dsh`) deployment. This package targets the developer-preview runtime; expect to re-verify after `dsh` updates.

## Route 1 — skills only (no runtime integration)

DSH discovers Agent-Skills directories (`<name>/SKILL.md`) from, in precedence order: `<projectRoot>/.dsh/skills`, `<projectRoot>/.agents/skills`, configured `customSkillDirs`, `<dshHome>/skills`, and `<agentsHome>/skills` (`~/.agents/skills`). Copy the generated skills into one of those roots.

From a released npm package:

```bash
npm pack @maestria/deepseek
tar -xzf maestria-deepseek-*.tgz
mkdir -p ~/.agents/skills
cp -R package/skills/* ~/.agents/skills/
```

From a local checkout (after `scripts/sync-all`):

```bash
cp -R packages/deepseek/skills/* ~/.agents/skills/
```

This route is purely advisory: the model loads skills via the `skill` tool; no prompt sections, personas, or delegation tools are installed.

## Route 2 — Maestria agent preset (full integration)

The preset composes a complete coding agent around the Maestria pipeline. Install with the Maestria CLI:

```bash
npx maestria install deepseek
```

This stages a self-contained preset into `$DSH_HOME/.agent-presets/maestria` (default `~/.dsh/.agent-presets/maestria`):

- `agent.cordis.yml` + `preset.yml` — the composition and roster metadata
- `plugin/index.js` — the bundled Cordis plugin, referenced by the relative path `./plugin/index.js`

Then start or create a session with the `Maestria` preset (preset picker in the Web UI, or the preset selection your deployment exposes). New sessions join the preset's composition and get:

- the Maestria orchestrator persona and routing/global-rules prompt sections,
- the `maestria_<role>` subagent delegation tools (`maestria_adventurer`, `maestria_architect`, `maestria_builder`, `maestria_diagnose`, `maestria_planner`, `maestria_reviewer`, `maestria_writer`),
- the generated skill tree via the plugin's `ctx.skills` provider.

The preset requires the host composition to provide the standard registries (including the `subagents` registry with the `spawn` backend), which the shipped `standard` preset also assumes.

### Notes

- **npm-resolvable plugin alternative.** Instead of the staged relative path, a deployment can reference the published package directly by replacing the `maestria-methodology` row's `name` with `'@maestria/deepseek'` and installing the package where the harness resolves modules.
- **Enforcing read-only roles.** `maestria_adventurer`, `maestria_planner`, and `maestria_reviewer` carry advisory persona notes only. To enforce them, add a `toolFilter: { deny: [...] }` to those rows in the staged `agent.cordis.yml`; the denied tool names depend on your host composition (`bash` vs `pwsh`, filesystem editors), and unknown names fail startup.
- **Updates.** Re-run `npx maestria update deepseek` (or `install`) to refresh the staged preset and plugin.
- **Uninstall.** `npx maestria uninstall deepseek` removes the staged preset directory. Sessions already running on the preset keep running on it.
