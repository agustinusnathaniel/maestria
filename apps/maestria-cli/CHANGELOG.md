# maestria

## 0.12.0

### Minor Changes

- [#265](https://github.com/agustinusnathaniel/maestria/pull/265) [`4dcbf04`](https://github.com/agustinusnathaniel/maestria/commit/4dcbf0430e8d9f2143762a44e1d56729e238107d) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add a first-class Agent Plugins v1 package that exposes Maestria's methodology as a portable, skills-only plugin, plus CLI commands to validate and stage portable packages.

## 0.11.1

### Patch Changes

- [#258](https://github.com/agustinusnathaniel/maestria/pull/258) [`45ee346`](https://github.com/agustinusnathaniel/maestria/commit/45ee3463f46371725786037fc9ae061aec24865d) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor(cli): consolidate version cache path and use tmpdir for tarball handling

- [#260](https://github.com/agustinusnathaniel/maestria/pull/260) [`a49c33c`](https://github.com/agustinusnathaniel/maestria/commit/a49c33caaeb8c3fa756ff8e5255ac0c4ac761d80) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor(cli): respect XDG_CACHE_HOME and centralize cache path helpers

## 0.11.0

### Minor Changes

- [#248](https://github.com/agustinusnathaniel/maestria/pull/248) [`93ff292`](https://github.com/agustinusnathaniel/maestria/commit/93ff292b83f5659b67af4889848de454d1661206) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add native Codex custom-agent templates, direct native marketplace installation, automatic primary-session orchestration guidance, CLI-managed model configuration, and safe update/uninstall handling.

- [#248](https://github.com/agustinusnathaniel/maestria/pull/248) [`93ff292`](https://github.com/agustinusnathaniel/maestria/commit/93ff292b83f5659b67af4889848de454d1661206) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Update Kimi Code integration to use its native plugin registry, system-prompt, namespaced command, and current delegation contracts.

### Patch Changes

- [#248](https://github.com/agustinusnathaniel/maestria/pull/248) [`93ff292`](https://github.com/agustinusnathaniel/maestria/commit/93ff292b83f5659b67af4889848de454d1661206) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Align Cursor packaging and native per-agent model configuration while preserving existing user settings across plugin updates.

- [#250](https://github.com/agustinusnathaniel/maestria/pull/250) [`085f7fe`](https://github.com/agustinusnathaniel/maestria/commit/085f7fe61263aedf458a8a14d518e4f1c15bf675) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Share neutral mode and skill validation logic through the hybrid package topology.

## 0.10.2

### Patch Changes

- [#230](https://github.com/agustinusnathaniel/maestria/pull/230) [`1d18698`](https://github.com/agustinusnathaniel/maestria/commit/1d18698942c34e45b98b981c09267385805e26ae) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - feat(cli): `maestria check` detects outdated installs
  
  The check command fetched each plugin's latest published version but never compared it against the installed version, so CI and AI-agent consumers had no machine-readable staleness signal. Single-platform and --all checks now report an `outdated` flag in JSON, print an explicit update hint, show an Outdated column in the status table, and exit 3 when a newer version exists (0 = installed and current; 1 = not installed, unavailable, or unknown platform, unchanged from today; nothing exits 2).

- [#232](https://github.com/agustinusnathaniel/maestria/pull/232) [`0402671`](https://github.com/agustinusnathaniel/maestria/commit/0402671113c85866b18eeb15777100e4ec254008) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix(cli): never silently downgrade on implicit update
  
  `maestria update` (no `-V`) short-circuited only on exact version equality, so an install NEWER than the registry's latest - a local dev build or an unpublished release - sailed past the guard and was silently downgraded by `platform.update()`. Meanwhile `maestria check` correctly reported that same install as current (exit 0), so the two commands disagreed on identical machine state.
  
  Implicit updates now skip any install strictly ahead of latest with an explicit "newer than latest; skipping" message, and the interactive picker only offers platforms that are strictly behind latest. Explicit `--version` pins are honored verbatim - downgrades included. New `isVersionGt()` and `needsUpdateOf()` helpers keep check and update semantics in one place.

## 0.10.1

### Patch Changes

- [#219](https://github.com/agustinusnathaniel/maestria/pull/219) [`e5d2f3b`](https://github.com/agustinusnathaniel/maestria/commit/e5d2f3b3a8f2787b211e9d2c858fe199ecdce73e) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix(cli): exit non-zero when install/update/uninstall have partial failures

  The install, update, and uninstall commands always exited 0 even when a platform result failed, contradicting the documented exit-code contract. They now exit 1 when any per-platform result is ok:false, so CI and AI-agent consumers can detect partial failure from the exit code alone (matching the check command).

- [#215](https://github.com/agustinusnathaniel/maestria/pull/215) [`cbaef35`](https://github.com/agustinusnathaniel/maestria/commit/cbaef35dc3f9ceed38a7f04f6da567cf6f5dd7d9) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix(cli): treat non-semver latest versions as incomparable in update --all detection

  The hermes platform handler intentionally reports `see GitHub releases` as its
  latest version (a display sentinel). `compareVersions` previously fell through
  to `localeCompare` for non-semver strings, so `update --all` always flagged
  hermes as needing an update and reported a fake success. Non-semver values are
  now incomparable (`compareVersions` returns `null`), and
  `isVersionDifferent` treats an incomparable pair as not different.

## 0.10.0

### Minor Changes

- [#209](https://github.com/agustinusnathaniel/maestria/pull/209) [`47b15b5`](https://github.com/agustinusnathaniel/maestria/commit/47b15b58afa4def30f1ecfc39dbdc942779391e4) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add Maestria CLI compatibility for the Prime Agent platform (`prime-agent`). The CLI detects the
  Prime Agent binary, inspects its package registrations via `prime-agent package list`, and
  delegates install, update, status, check, and uninstall to Prime's native package commands
  (`package install`/`update`/`remove npm:@maestria/prime-agent`).

  Prime support is deliberately global (user scope only). Because Prime resolves project settings
  from the current working directory, every Prime command runs from a freshly created empty
  temporary directory - created up front (failing closed if it cannot be created) and removed on
  both success and failure - so a project's registrations are never scanned, counted as installed,
  or modified. Project-only registrations are not managed.

  Updates use Prime's latest-only package semantics, so exact version pinning is not exposed; a
  version-pinned user registration is detected up front and reported as an accurate error (even
  when the installed version already equals the latest) instead of being silently skipped or
  reported as a successful update.

## 0.9.0

### Minor Changes

- [#204](https://github.com/agustinusnathaniel/maestria/pull/204) [`2ec96b2`](https://github.com/agustinusnathaniel/maestria/commit/2ec96b28a0edf38c5d513c5d708c6694303e1676) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add Maestria CLI compatibility for the Claude Code and Codex CLI plugin packages. The CLI detects
  both hosts, stages the published npm package into a local marketplace, and delegates install,
  update, status, check, and uninstall operations to the host plugin manager.

## Next

### Prime Agent support

- Add `prime-agent` platform detection and status reporting.
- Add native package-manager-backed install, update, and uninstall handlers that delegate to
  `prime-agent package install`/`update`/`remove npm:@maestria/prime-agent`.
- Prime support is deliberately global (user scope only): every Prime command runs from a freshly
  created empty temporary directory, so project registrations are never scanned or modified, and
  the temporary directory is removed afterwards.
- Read registration state from `prime-agent package list` (user scope only) and the installed
  version from the installed package's manifest.
- Reject exact version pinning because Prime's updates always select the latest package version;
  a version-pinned user registration is reported as an error rather than silently skipped.

### Claude Code and Codex CLI support

- Add `claude-code` and `codex` platform detection and status reporting.
- Add native marketplace-backed install, update, and uninstall handlers for both plugins.
- Stage the published npm packages under `~/.cache/maestria/` without writing host configuration
  directly.
- Reject exact version pinning for these two adapters because their host marketplace update paths
  select the latest staged package.

## 0.8.1

### Patch Changes

- [`04cc0bd`](https://github.com/agustinusnathaniel/maestria/commit/04cc0bd5aa67c1474e8bedc3c3be4b05ba07b88a) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Fix `maestria uninstall pi` failing with `No matching package found for @maestria/pi`. The Pi uninstall now passes the `npm:@maestria/pi` package reference, matching the form `pi install` accepts. The shared `@gotgenes/pi-subagents` prerequisite is still left untouched.

## 0.8.0

### Minor Changes

- [#153](https://github.com/agustinusnathaniel/maestria/pull/153) [`c6176e9`](https://github.com/agustinusnathaniel/maestria/commit/c6176e9cee19e2fe07317ff1aa5eefea5dfccfa1) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add `maestria configure <platform>` for per-agent model selection on opencode, pi, and omp.
  - Interactive: group-multiselect of the 7 specialists, then a per-agent model picker with the current model pre-selected and an _Inherit (session model)_ option; model lists fetched live from the platform (`opencode models`, `pi --list-models`, `omp models --json`).
  - Non-interactive: `--set <agent>=<model>[,...]` with empty values to reset, `--global`/`--project` config levels, and `--json`/`--quiet`/`--compact` output modes.
  - Writes are surgical: opencode JSONC path edits preserve comments and the `variant` key; pi/omp frontmatter edits preserve the agent body. Models are validated against the platform's live model list before writing.
  - Bundles jsonc-parser 3.3.1 via its ESM build (the UMD entry cannot be bundled); removing a non-existent model is a no-op.

## 0.7.3

### Patch Changes

- [`7681e11`](https://github.com/agustinusnathaniel/maestria/commit/7681e11750c9f16c5f849595f278d361fa2b3bc6) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix: omp plugin command

## 0.7.2

### Patch Changes

- [#120](https://github.com/agustinusnathaniel/maestria/pull/120) [`5c18e3c`](https://github.com/agustinusnathaniel/maestria/commit/5c18e3c6abb32a439a6ae705422f2ab3ce2c305d) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix: remove npm: prefix from omp package specifiers to avoid bun self-alias dependency loop

## 0.7.1

### Patch Changes

- [#118](https://github.com/agustinusnathaniel/maestria/pull/118) [`6d95df2`](https://github.com/agustinusnathaniel/maestria/commit/6d95df21a6b92a63849ed16cc92c6811a1a3a3e1) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix: correct omp npm package detection path - omp v17 stores packages under plugins/ not agent/npm/

## 0.7.0

### Minor Changes

- [#104](https://github.com/agustinusnathaniel/maestria/pull/104) [`040f23a`](https://github.com/agustinusnathaniel/maestria/commit/040f23ad223a455b8095cb1edc9dca0a7a0a1fc7) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - feat: add Oh My Pi (omp) platform plugin

  New `@maestria/omp` package adds maestria support for the Oh My Pi coding agent:
  - 7 specialist agents (adventurer, architect, builder, diagnose, planner, reviewer, writer)
  - Workflow mode commands: /fein, /sonar, /blitz
  - Review mode with tool blocking and dangerous pattern detection
  - Session state tracking and compaction preservation
  - Structured handoff via /handoff command
  - CLI integration: `maestria install omp`, `maestria update omp`
  - Agent methodology synced from canonical core source

## 0.6.1

### Patch Changes

- [#102](https://github.com/agustinusnathaniel/maestria/pull/102) [`7634e84`](https://github.com/agustinusnathaniel/maestria/commit/7634e84cd4bace900bbfef6cf34902edfdb1b762) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: switch kimi-code to npm-based install; sync plugin manifest version
  - Switch from git-based codeload to npm-based install (`npm pack @maestria/kimi-code`)
  - Fix `maestria update kimi-code` version comparison (was always re-downloading)
  - Sync `kimi.plugin.json` version with `package.json` (0.1.0 → 0.4.6)
  - Add `publishConfig` for npm publish readiness

- [#92](https://github.com/agustinusnathaniel/maestria/pull/92) [`e861360`](https://github.com/agustinusnathaniel/maestria/commit/e8613603e43315b403f87e66f428dfe4c1b62def) Thanks [@iyansr](https://github.com/iyansr)! - feat: @maestria/cursor plugin v0.1 - declarative Cursor IDE and CLI plugin

  Initial release of the Cursor platform plugin:
  - **7 specialist agents** synced from core (`agents/*.md`) with Cursor-adapted tool names (Read, Glob, Grep, StrReplace, Shell, Write)
  - **Orchestrator skill** (`skills/orchestrator/SKILL.md`) with Task-based routing, handoff contracts, and maker/checker enforcement
  - **Global rules** (`rules/maestria-global.mdc`, `alwaysApply: true`)
  - **Workflow commands** - `/fein` (full pipeline), `/sonar` (research only), `/blitz` (fast implementation)
  - **Two-layer maker/checker** - `readonly: true` runtime flag on adventurer/planner/reviewer agents blocks write tools at the Cursor runtime level, with prompt-level instructions as backup
  - **CLI support** - `maestria install cursor`, `maestria update cursor`, `maestria uninstall cursor`, `maestria check cursor` via npm (`@maestria/cursor`)
  - **Documentation** - installation guide, quick start, changelog, contributing guide, and ADR-CR-001

## 0.6.0

### Minor Changes

- [#9](https://github.com/agustinusnathaniel/maestria/pull/9) [`17c6816`](https://github.com/agustinusnathaniel/maestria/commit/17c6816c602c9c40b96b28a1a574fc2c387cca56) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - feat: add `maestria check <platform>` command for plugin installation verification

  New subcommand that checks whether a maestria plugin is installed on a given
  platform by reading the platform's own configuration (e.g.
  `~/.config/opencode/opencode.jsonc` for OpenCode). Exits 0 if installed, 1 if
  not. Machine-readable JSON output by default - optimized for AI agent
  consumption.

## 0.5.0

### Minor Changes

- [#79](https://github.com/agustinusnathaniel/maestria/pull/79) [`9cbe617`](https://github.com/agustinusnathaniel/maestria/commit/9cbe61732f2417f8930c15e703f684284de9bd24) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Enhanced interactive prompts with grouped multiselect and `a` key toggle-all

  The `update` and `install` commands now use a grouped multiselect prompt
  with an "All platforms" toggle header and a visible `a` keyboard shortcut
  to select/deselect all options at once.

  Fixed `maestria install kimi-code` and related commands: the old
  `kimi plugins` CLI subcommand was removed in Kimi Code v0.23.6. The
  installer now writes plugin files directly to disk and uses the
  `installed.json` registry format documented in Kimi Code's plugin store.

## 0.4.1

### Patch Changes

- [#77](https://github.com/agustinusnathaniel/maestria/pull/77) [`f2e175d`](https://github.com/agustinusnathaniel/maestria/commit/f2e175dd3e8e5ef965662a8e97a4ebdf4f27d561) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Use network-first version lookup for `npm view` instead of TTL cache

  `npmViewVersion` was returning stale versions for up to 1 hour when the
  cache entry hadn't expired. Switched to network-first: always hit npm for
  the live version, falling back to cache only when the network call fails.

## 0.4.0

### Minor Changes

- [#74](https://github.com/agustinusnathaniel/maestria/pull/74) [`6fdd0ee`](https://github.com/agustinusnathaniel/maestria/commit/6fdd0ee63aed1252fb32784f62a10020ad08c264) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - feat: support comma-separated platforms, multiselect, and "All platforms" in update/install
  - `maestria update opencode,pi` and `maestria install opencode,pi` now accept comma-separated platform IDs
  - Interactive mode uses multiselect (checkboxes) instead of single-select picker
  - `maestria update` interactive mode adds an "All platforms" shortcut option
  - `maestria install` interactive mode now supports selecting multiple platforms

## 0.3.11

### Patch Changes

- [#69](https://github.com/agustinusnathaniel/maestria/pull/69) [`b778a71`](https://github.com/agustinusnathaniel/maestria/commit/b778a7156c4cae9d129ca40e28f57113211cbcd1) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix: correct Pi extension detection path for version check

## 0.3.10

### Patch Changes

- [`e898e7e`](https://github.com/agustinusnathaniel/maestria/commit/e898e7ef80eb615cf9ffaa32bf125919fdbde138) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - adjust Pi package install and uninstall

## 0.3.9

### Patch Changes

- [#57](https://github.com/agustinusnathaniel/maestria/pull/57) [`555e58f`](https://github.com/agustinusnathaniel/maestria/commit/555e58f30b2e1fa88db5124e4a8445bbeeda0799) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix: detect opencode installed version when a pinned version specifier is in config

- [#57](https://github.com/agustinusnathaniel/maestria/pull/57) [`555e58f`](https://github.com/agustinusnathaniel/maestria/commit/555e58f30b2e1fa88db5124e4a8445bbeeda0799) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - feat: add semver-compliant version comparison using localeCompare with numeric option

  Replaces string-based version comparison with localeCompare-based utilities
  that handle numeric segment ordering (0.10.0 > 0.9.0) and prerelease ordering
  (1.0.0-alpha < 1.0.0) correctly per the semver specification.

## 0.3.8

### Patch Changes

- [`6ec1c1c`](https://github.com/agustinusnathaniel/maestria/commit/6ec1c1c1fdde6acf0d4353ed664ff53c4139c61b) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix opencode install, add uninstall command, resolve typecheck warnings
  - Use `sh()` instead of `execFile` for opencode plugin install - fixes
    failures when the binary is only reachable through a shell-initialized PATH.
  - Capture stderr in `CommandError` messages - reveals the actual error instead
    of generic "Command failed: ...".
  - Remove `--force` flag from install - `opencode plugin` doesn't support it on
    first install.
  - Use `-g` flag on install - defaults to global scope.
  - Add `maestria uninstall` command - supports positional, `--all`, and
    interactive modes.
  - Replace hardcoded version string with `^/package.json` import - `maestria --version`
    now reflects the real package version.
  - Fix `unbound-method` typecheck warnings in pi extension tests.

## 0.3.7

### Patch Changes

- [`c0c1673`](https://github.com/agustinusnathaniel/maestria/commit/c0c1673a4dfe6de2c15f43abe7fd2cea1a10ffa3) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - opencode install: use `-g` flag, drop `--force`

  The `install` handler for OpenCode omitted the `-g` flag, so it tried to
  install at project level - which fails when OpenCode is configured globally.
  Also passed `--force` which the `plugin` subcommand doesn't support on first
  install, causing the command to always fail.

  Now passes `-g` only, which works both for first-time installs and upgrades.

## 0.3.6

### Patch Changes

- [`b4e1262`](https://github.com/agustinusnathaniel/maestria/commit/b4e12621826488326fd9950608719f160ab6535d) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - opencode install: always use `-g` flag

  The `install` handler for OpenCode omitted the `-g` flag, so it always tried
  to install at project level - which fails on machines where OpenCode is
  configured globally. Since `install` is a one-time setup command, it should
  default to global installation.

  Now passes `-g --force` to `opencode plugin` on install.

## 0.3.5

### Patch Changes

- [`f992fdd`](https://github.com/agustinusnathaniel/maestria/commit/f992fddc445b9caf4687dcd4451280e570e12d50) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - ci: optimize pipeline

## 0.3.4

### Patch Changes

- [`8083a57`](https://github.com/agustinusnathaniel/maestria/commit/8083a575fce127470217a83fef99a26fe542d206) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - ci: optimize pipeline

## 0.3.3

### Patch Changes

- [`63593e0`](https://github.com/agustinusnathaniel/maestria/commit/63593e051208b57e2bf17a73660a3b08b3fe7006) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - ci: ensure release is pure and fresh build

## 0.3.2

### Patch Changes

- [`b3465d7`](https://github.com/agustinusnathaniel/maestria/commit/b3465d738b63ec3e79af006a0d2e1d7a732ffeea) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Bundle CLI runtime dependencies (effect, @clack/prompts, citty, picocolors) into output instead of externalizing them. End users no longer download 8.2 MB of transitive dependencies at install time, and the `msgpackr-extract` build script warning is eliminated.

## 0.3.1

### Patch Changes

- [#44](https://github.com/agustinusnathaniel/maestria/pull/44) [`b57c259`](https://github.com/agustinusnathaniel/maestria/commit/b57c25906207c6a77ce6fb2650a53c4d759e7c1d) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Upgrade Effect dependency from 4.0.0-beta.70 to 4.0.0-beta.92 with pnpm overrides for version deduplication

## 0.3.0

### Minor Changes

- [`3d72f48`](https://github.com/agustinusnathaniel/maestria/commit/3d72f48b7e3b0b52b4968b4ff5cceede5dfec607) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Agent-friendly CLI improvements
  - `--compact` flag for minimal machine-friendly text output (all commands)
  - `--version` flag on root command
  - `--json` flag on root `maestria` command
  - `--quiet` flag on `status` command (decoupled from `--json`)
  - Enhanced `--help` with EXAMPLES, EXIT CODES, and TIP FOR AI AGENTS sections
  - Proper exit codes: 0 (success), 1 (error), 130 (cancelled)
  - Non-TTY guards on `install` and `update` - clear error instead of hanging prompt

### Patch Changes

- [`9e7f331`](https://github.com/agustinusnathaniel/maestria/commit/9e7f331c9e45deb0206081f4c0caa829972d2206) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix update checking - skip up-to-date plugins

## 0.2.1

### Patch Changes

- [`29c1a36`](https://github.com/agustinusnathaniel/maestria/commit/29c1a36818f854380c6d8cee7fb8780f25c8c495) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix: skip update when installed version already matches target

## 0.2.0

### Minor Changes

- [#39](https://github.com/agustinusnathaniel/maestria/pull/39) [`fa2353b`](https://github.com/agustinusnathaniel/maestria/commit/fa2353b294c5ea16153bd244fe8c3726f910cf60) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - feat: add maestria CLI for cross-platform plugin management

  Introduce `maestria` CLI with three subcommands:
  - install: install maestria for detected coding agent platforms
  - update: update installed maestria plugins to latest version
  - status: show installation status across platforms

  Supports OpenCode, Pi, and Kimi Code platforms.
