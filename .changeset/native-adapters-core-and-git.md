---
"@maestria/opencode": minor
"@maestria/pi": minor
---

Native adapters apply the shared git-safety classifier. OpenCode blocks `git commit --no-verify` and `git push --no-verify` before the `shell` tool runs and asks through its permission prompt before commits or pushes to `main`, `develop`, `staging`, or `release/*`, force pushes, `git reset --hard`, `git clean -f`, `git checkout -- <path>`, `git restore <path>`, and `git stash drop`; an explicit config `deny` stays final. Pi does the same in `tool_call` and for your own `!` shell commands, asking through its confirm dialog and blocking with an approval message when there is no UI. Pi now also injects the always-on core (main loop and global rules) into every run's system prompt, where before it reached the session only when the model loaded those skills.
