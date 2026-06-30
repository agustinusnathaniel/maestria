# maestria

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
  - Non-TTY guards on `install` and `update` — clear error instead of hanging prompt

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
