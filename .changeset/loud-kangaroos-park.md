---
'maestria': patch
---

fix opencode install, add uninstall command, resolve typecheck warnings

- Use `sh()` instead of `execFile` for opencode plugin install — fixes
  failures when the binary is only reachable through a shell-initialized PATH.
- Capture stderr in `CommandError` messages — reveals the actual error instead
  of generic "Command failed: ...".
- Remove `--force` flag from install — `opencode plugin` doesn't support it on
  first install.
- Use `-g` flag on install — defaults to global scope.
- Add `maestria uninstall` command — supports positional, `--all`, and
  interactive modes.
- Replace hardcoded version string with `^/package.json` import — `maestria --version`
  now reflects the real package version.
- Fix `unbound-method` typecheck warnings in pi extension tests.
