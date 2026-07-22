# maestria

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

- [#92](https://github.com/agustinusnathaniel/maestria/pull/92) [`e861360`](https://github.com/agustinusnathaniel/maestria/commit/e8613603e43315b403f87e66f428dfe4c1b62def) Thanks [@iyansr](https://github.com/iyansr)! - feat: @maestria/cursor plugin v0.1 — declarative Cursor IDE and CLI plugin

  Initial release of the Cursor platform plugin:

  - **7 specialist agents** synced from core (`agents/*.md`) with Cursor-adapted tool names (Read, Glob, Grep, StrReplace, Shell, Write)
  - **Orchestrator skill** (`skills/orchestrator/SKILL.md`) with Task-based routing, handoff contracts, and maker/checker enforcement
  - **Global rules** (`rules/maestria-global.mdc`, `alwaysApply: true`)
  - **Workflow commands** — `/fein` (full pipeline), `/sonar` (research only), `/blitz` (fast implementation)
  - **Two-layer maker/checker** — `readonly: true` runtime flag on adventurer/planner/reviewer agents blocks write tools at the Cursor runtime level, with prompt-level instructions as backup
  - **CLI support** — `maestria install cursor`, `maestria update cursor`, `maestria uninstall cursor`, `maestria check cursor` via npm (`@maestria/cursor`)
  - **Documentation** — installation guide, quick start, changelog, contributing guide, and ADR-CR-001

## 0.6.0

### Minor Changes

- [#9](https://github.com/agustinusnathaniel/maestria/pull/9) [`17c6816`](https://github.com/agustinusnathaniel/maestria/commit/17c6816c602c9c40b96b28a1a574fc2c387cca56) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - feat: add `maestria check <platform>` command for plugin installation verification

  New subcommand that checks whether a maestria plugin is installed on a given
  platform by reading the platform's own configuration (e.g.
  `~/.config/opencode/opencode.jsonc` for OpenCode). Exits 0 if installed, 1 if
  not. Machine-readable JSON output by default — optimized for AI agent
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
