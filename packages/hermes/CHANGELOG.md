# @maestria/hermes

## 0.1.2

### Patch Changes

- [`72f6628`](https://github.com/agustinusnathaniel/maestria/commit/72f6628b1e02a8ddea20200b18ba26087109da27) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Fix plugin loading failure due to src/ layout

  Hermes plugin discovery expects `__init__.py` at the plugin root directory,
  but the package uses a `src/` layout (code under `src/maestria_hermes/`).
  Added a root-level `__init__.py` shim that adds `src/` to `sys.path` and
  re-exports `register` from the actual package.

  Without this, `hermes plugins install` silently fails to load the plugin
  — none of its slash commands (`/fein`, `/sonar`, `/blitz`, etc.), hooks,
  or skills are available.

## 0.1.1

### Patch Changes

- [#9](https://github.com/agustinusnathaniel/maestria/pull/9) [`17c6816`](https://github.com/agustinusnathaniel/maestria/commit/17c6816c602c9c40b96b28a1a574fc2c387cca56) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Initial release of @maestria/hermes — maestria methodology adapter for Hermes Agent.

  Features:
  - Mode system: fein (full pipeline), sonar (read-only), blitz (fast execution)
  - OpenCode CLI routing tool
  - Pipeline lifecycle hooks (pre-LLM, pre-tool, transform)
  - 9 specialist skill files
  - Slash commands: /fein, /sonar, /blitz, /mode, /review, /plan
