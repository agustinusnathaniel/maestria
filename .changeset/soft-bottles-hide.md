---
"@maestria/hermes": patch
---

Fix plugin loading failure due to src/ layout

Hermes plugin discovery expects `__init__.py` at the plugin root directory,
but the package uses a `src/` layout (code under `src/maestria_hermes/`).
Added a root-level `__init__.py` shim that adds `src/` to `sys.path` and
re-exports `register` from the actual package.

Without this, `hermes plugins install` silently fails to load the plugin
— none of its slash commands (`/fein`, `/sonar`, `/blitz`, etc.), hooks,
or skills are available.
