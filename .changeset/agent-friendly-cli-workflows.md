---
"maestria": minor
---

Agent-friendly CLI improvements

- `--compact` flag for minimal machine-friendly text output (all commands)
- `--version` flag on root command
- `--json` flag on root `maestria` command
- `--quiet` flag on `status` command (decoupled from `--json`)
- Enhanced `--help` with EXAMPLES, EXIT CODES, and TIP FOR AI AGENTS sections
- Proper exit codes: 0 (success), 1 (error), 130 (cancelled)
- Non-TTY guards on `install` and `update` — clear error instead of hanging prompt
