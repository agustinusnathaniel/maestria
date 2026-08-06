# @maestria/hermes

Maestria methodology plugin for [Hermes Agent](https://hermes-agent.ai).

Brings maestria's proven agent methodology -- pipeline composition, maker/checker split, specialist delegation, and mode-based workflows -- to the general-purpose Hermes AI agent.

Hermes starts with no explicit Maestria mode, so the root session remains direct by default. Explicit `/fein`, `/sonar`, and `/blitz` selections persist per session identity. Fein and sonar restrict the root to dispatch tools, sonar is read-only for all sessions, and blitz is direct execution with no Maestria child during execution. If a blitz artifact will land, it transitions to an independent reviewer before shipping.

## Installation

```bash
hermes plugins install agustinusnathaniel/maestria/packages/hermes --enable
```

This clones the maestria monorepo, extracts `packages/hermes/`, and enables the plugin. See the [user-facing docs](https://maestria.sznm.dev/hermes/getting-started/installation/) for details.

## Documentation

- [User-facing docs](https://maestria.sznm.dev/hermes/) -- installation, commands, quick start
- [Design doc](https://github.com/agustinusnathaniel/maestria/blob/main/docs/hermes-maestria-plugin.md) -- architecture and implementation plan
