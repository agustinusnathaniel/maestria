---
'maestria': patch
---

Fix CLI commands found broken in a full real-host sweep. `maestria update opencode` no longer fails with "Plugin is not configured" when OpenCode has not yet loaded the plugins for the current directory. `--json` and piped output no longer contain spinner frames. `uninstall` succeeds with "Not installed" when a platform has nothing to remove. `configure pi` works right after `install pi`. Text update output reports already-current platforms as up to date, host failures omit internal stack frames, `configure` failures no longer end in a bare "Canceled", and `-v` prints the version.
