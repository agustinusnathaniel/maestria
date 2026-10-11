# Plugin Host Verification

## Purpose

Verify discovery, actual installation ownership, and complete prepared context independently of package shape. These offline probes do not require provider credentials or prove model obedience. The current component contract is eight root task profiles, three workflows, global policy, and two root utility skills.

## Claude Code native child

With Claude Code installed, run from the repository root:

```sh
node --experimental-strip-types scripts/e2e/claude-skill-preload.ts --out artifacts/claude-skill-preload-evidence.json
```

The legacy script filename is retained for reproduction, but the probe now checks complete native context rather than role-skill preloading. It launches the real CLI with temporary configuration/workspace, disabled persistence and nonessential traffic, and a local Anthropic-compatible fixture using a dummy credential. Digests and request diagnostics are recorded instead of credentials or full request prompts.

Claude Code 2.1.217 passed ten checks: native dispatch was exposed, the complete reviewer profile and canonical global policy reached the child, Write/Edit were absent from its tool schema, and the result returned to the parent. This proves the tested role's native context and tool-schema filtering. It does not prove model judgment, every specialist, shell-mediated read-only enforcement, or hosted Claude surfaces. The probe loads the checkout; separate archive checks verify the packaged resource paths.

## OMP source and archive discovery

With Bun and OMP 18.4.8 sources installed, run:

```sh
pnpm exec bun scripts/e2e/omp-plugin-discovery.ts --host-root /absolute/path/to/@oh-my-pi/pi-coding-agent --out artifacts/omp-plugin-discovery.json
```

This packs and extracts the plugin, then uses actual capability providers and installed-loader code against both the Git root and archive. Current discovery returns eight task profiles, two utilities, three commands, and one always-apply rule. The metadata registration fixture is distinct from a real installation transaction.

## OMP real isolated installation and prepared prompts

The 2026-10-11 probe uses the pinned 18.4.8 bundled CLI with a temporary host home/configuration, local archive input, and no provider configuration. Its native payload was compared between source and archive: 52 files matched. The 41 checks cover real install, disable, reinstall, local-source remote-upgrade refusal, uninstall cleanup, default installed discovery, slash argument expansion, full global-rule system-prompt injection, and all eight task-role template compositions.

The reproduction inputs and results are preserved under ignored `artifacts/omp-actual-host-proof/`: `run-proof.py`, `probe.ts`, `proof.json`, `source-archive-identity.json`, and the prepared prompt. The local setup uses `/tmp/maestria-omp-root-verification/transaction`; with that pinned host fixture available, reproduce with:

```sh
python3 /tmp/maestria-omp-root-verification/transaction/run-proof.py
```

The source SDK's direct PluginManager import hit an upstream module-resolution ambiguity; installation was exercised through the shipped bundled CLI instead. This is not treated as a Maestria failure. Prompt preparation uses native formatter/template APIs; formatting may normalize Markdown table padding.

No inference or actual task spawn occurs. Generic profiles have no `tools`, `spawns`, or model override metadata, so read-only role text remains advisory. No executable modules, hooks, custom tools, or MCP servers were discovered. These results do not establish enforcement, other host versions, or provider behavior.

## Codex multiline settings preservation

Full generated TOML prompts contain bracketed examples that a line-only editor can mistake for table headers. The repaired helper is tested against all seven actual profiles with user settings before and after their multiline instructions. Independent Python `tomllib` validation confirms 14 cases preserve top-level model, effort, service tier, and the prompt value unchanged.

```sh
node --experimental-strip-types artifacts/codex-toml-repair/reproduce.mjs
```

Evidence and baseline failing tests are under ignored `artifacts/codex-toml-repair/`. The reproduction reads the committed baseline through a temporary module rather than replacing production code. Existing installer tests cover managed instructions, model refresh, and unrelated user-file preservation. This does not test model inference or hosted Codex tasks.

## Remaining evidence boundaries

- Claude's explicit agent-file form passes strict validation; directory form is rejected. Acceptance of extra frontmatter does not establish runtime enforcement.
- Kimi native profiles, command/bootstrap resources, and size limits have package/schema evidence; live dispatch and reload remain unverified.
- Cursor, Devin, and ZCode native task execution remains unverified; static selectors and documented support do not prove live behavior.
- Codex marketplace exposes only utility skills; its complete agent/policy/mode context is supplied by the managed CLI path.
- Hermes portable installation is utility-only. Optional manual project context obeys the host's first-match precedence; delegated children require explicit context handoff.
- A doctor check or install dry-run is not proof of a plugin loading, and earlier fourteen-skill/zero-command probes describe the retired layout.

Run the completion gates as well as these probes. Regenerate affected evidence when native contexts, selectors, or installation behavior changes; unchanged source bodies and metadata-only descriptions do not require repeating provider-independent lifecycle work without a named concern.
