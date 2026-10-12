# Plugin Host Verification

## Purpose

Verify discovery, actual installation ownership, and complete prepared context independently of package shape. These offline probes do not require provider credentials or prove model obedience. The current component contract is seven shared task profiles (`agents/<role>.md`, no orchestrator), three shared workflows, per-host global policy, and two root utility skills. Results dated before 2026-10-12 that cite eight profiles describe a superseded layout.

## Claude Code native child

With Claude Code installed, run from the repository root:

```sh
node --experimental-strip-types scripts/e2e/claude-skill-preload.ts --out artifacts/claude-skill-preload-evidence.json
```

The legacy script filename is retained for reproduction, but the probe now checks complete native context rather than role-skill preloading. It launches the real CLI with temporary configuration/workspace, disabled persistence and nonessential traffic, and a local Anthropic-compatible fixture using a dummy credential. Digests and request diagnostics are recorded instead of credentials or full request prompts.

Superseded run: Claude Code 2.1.217 passed ten checks against the former per-host layout: native dispatch was exposed, the complete reviewer profile and canonical global policy reached the child, Write/Edit were absent from its tool schema, and the result returned to the parent. This proved the tested role's native context and tool-schema filtering.

**2026-10-12 (current):** on Claude Code 2.1.295 the same offline fixture loaded the reviewer from the shared `agents/reviewer.md`; Write and Edit were unavailable and the full role plus global policy reached the child context. `claude plugin validate --strict` also passes on 2.1.295. It does not prove model judgment, every specialist, shell-mediated read-only enforcement, or hosted Claude surfaces. The probe loads the checkout; separate archive checks verify the packaged resource paths.

## OMP source and archive discovery

With Bun and OMP 18.4.8 sources installed, run:

```sh
pnpm exec bun scripts/e2e/omp-plugin-discovery.ts --host-root /absolute/path/to/@oh-my-pi/pi-coding-agent --out artifacts/omp-plugin-discovery.json
```

This packs and extracts the plugin, then uses actual capability providers and installed-loader code against both the Git root and archive. On 2026-10-12 (OMP 18.4.8, archive and git root), discovery returned 7 agents, 3 commands, 1 rule, and 2 skills; `.toml` files are not loaded. The metadata registration fixture is distinct from a real installation transaction.

## OMP real isolated installation and prepared prompts (superseded layout)

The 2026-10-11 probe covered the previous eight-profile layout and was not re-run for seven. It uses the pinned 18.4.8 bundled CLI with a temporary host home/configuration, local archive input, and no provider configuration. Its native payload was compared between source and archive: 52 files matched. The 41 checks cover real install, disable, reinstall, local-source remote-upgrade refusal, uninstall cleanup, default installed discovery, slash argument expansion, full global-rule system-prompt injection, and all eight task-role template compositions.

The reproduction inputs and results are preserved under ignored `artifacts/omp-actual-host-proof/`: `run-proof.py`, `probe.ts`, `proof.json`, `source-archive-identity.json`, and the prepared prompt. The local setup uses `/tmp/maestria-omp-root-verification/transaction`; with that pinned host fixture available, reproduce with:

```sh
python3 /tmp/maestria-omp-root-verification/transaction/run-proof.py
```

The source SDK's direct PluginManager import hit an upstream module-resolution ambiguity; installation was exercised through the shipped bundled CLI instead. This is not treated as a maestria failure. Prompt preparation uses native formatter/template APIs; formatting may normalize Markdown table padding.

No inference or actual task spawn occurs. Generic profiles have no `tools`, `spawns`, or model override metadata, so read-only role text remains advisory. No executable modules, hooks, custom tools, or MCP servers were discovered. These results do not establish enforcement, other host versions, or provider behavior.

## Cursor read-only enforcement

A live probe on Cursor CLI 2026.10.01 (2026-10-12) asked read-only roles to write a file. Plugin-supplied agents did not enforce `readonly` (the write succeeded, with or without other hosts' frontmatter keys present). A project `.cursor/agents/` profile with `readonly: true` was blocked ("cannot run non read-only tools"). Other hosts' keys do not affect Cursor loading. `maestria configure cursor` at project level writes copies into `.cursor/agents/`, where the metadata is enforced. Cursor desktop was not tested. No claim that plugin `readonly` blocks write tools at runtime is supported.

## Kimi tool names

Kimi v0.38.0 and v2.1.1 source registers its tools as `Write` and `Edit`. The `WriteFile` and `StrReplaceFile` names shipped earlier matched nothing, so the read-only denylist was ineffective; profiles now use `disallowedTools: [Write, Edit]`. Kimi ignores unknown keys (`readonly`, `model`) and substitutes `$ARGUMENTS` in plugin commands. This is source inspection only; Kimi was not live-run.

The same holds in the Kimi 2.1.1 source (2026-10-12): plugin agent and command discovery reads only `.md` files (`app/plugin/manifest.ts`), unknown frontmatter fields are ignored, and plugin commands substitute `$ARGUMENTS` (`app/plugin/commands.ts`). A live run on Kimi CLI 2.1.1 was not possible: the account has no Kimi Code subscription (403), and the configured OpenCode Go route is rejected by the CLI.

## Devin plugin discovery

Devin CLI 3000.11.3 (2026-10-12): `devin plugins install --local -y ./packages/agent-plugins`, then `devin plugins info maestria`. It listed seven agents (`maestria:adventurer` through `maestria:writer`), the two utility skills, `AGENTS.md (always on)`, and `rules/global.md`. Before `trigger: manual` was added, `rules/global.md` was listed as agent-decided, which could add a second policy copy with OMP-only dispatch text; afterwards it is listed as manual. The `.toml` profiles and the per-host rule folders were not loaded. The probe install was removed afterwards. No agent task was run.

## ZCode source

ZCode source (`zai-org/ZCode`, 2026-10-12) and the installed desktop bundle agree. The plugin loader reads `.zcode-plugin/plugin.json`; `agents`, `commands`, and `skills` selectors are directories (file-list entries are ignored), the default directories load automatically, and only `.md` agents are read, so the Codex TOMLs are skipped. There is no plugin rules component. The subagent parser reads `name`, `description`, `model`, `tools`, `disallowedTools`, `skills`, `permissionMode`, and a few display fields, and drops other keys. At runtime `disallowedTools` entries are subtracted from the subagent's tool allowlist, matched exactly against the registered `Write` and `Edit` tools; Bash and MCP tools remain. An omitted `model` inherits the parent model. Command files substitute `$ARGUMENTS`, name commands by filename, and run `` !`command` `` inline shell expansion, so shipped Markdown must never contain an exclamation mark directly before a backtick (guarded by the packed-artifact test). No live ZCode run was performed: it is desktop-only.

## Codex multiline settings preservation

Full generated TOML prompts contain bracketed examples that a line-only editor can mistake for table headers. The repaired helper is tested against all seven actual profiles with user settings before and after their multiline instructions. Independent Python `tomllib` validation confirms 14 cases preserve top-level model, effort, service tier, and the prompt value unchanged.

```sh
node --experimental-strip-types artifacts/codex-toml-repair/reproduce.mjs
```

Evidence and baseline failing tests are under ignored `artifacts/codex-toml-repair/`. The reproduction reads the committed baseline through a temporary module rather than replacing production code. Existing installer tests cover managed instructions, model refresh, and unrelated user-file preservation. This does not test model inference or hosted Codex tasks.

## Remaining evidence boundaries

- Claude's explicit agent-file form passes strict validation; directory form is rejected. Acceptance of extra frontmatter does not establish runtime enforcement.
- Kimi native profiles, command/bootstrap resources, and size limits have package/schema evidence; live dispatch and reload remain unverified.
- Cursor plugin agents do not enforce `readonly` (see above). Devin discovery is verified, but Devin and ZCode native task execution remains unverified; Devin and OMP have no denylist, so their read-only roles are prompt-level. ZCode removes `disallowedTools` from subagent tools per its source, but no live ZCode run was performed.
- Codex marketplace exposes only utility skills; its complete agent/policy/mode context is supplied by the managed CLI path.
- Hermes portable installation is utility-only. Optional manual project context obeys the host's first-match precedence; delegated children require explicit context handoff.
- A doctor check or install dry-run is not proof of a plugin loading, and earlier fourteen-skill/zero-command and eight-profile probes describe retired layouts.

Run the completion gates as well as these probes. Regenerate affected evidence when native contexts, selectors, or installation behavior changes; unchanged source bodies and metadata-only descriptions do not require repeating provider-independent lifecycle work without a named concern.
