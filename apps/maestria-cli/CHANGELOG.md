# maestria

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
