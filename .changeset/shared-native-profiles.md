---
"@maestria/agent-plugins": patch
"maestria": patch
---

Ship one profile per specialist in `agents/<role>.md` for every Markdown host, with each host's read-only control in shared frontmatter, and one set of workflow commands in `commands/`. Per-host agent and command copies, the dispatcher-only orchestrator profile, and Devin's mode skill exports are removed; Devin routes mode keywords through its always-on policy. Codex profiles are generated beside the Markdown as `agents/maestria-<role>.toml`.

Fix Kimi read-only profiles, which denied `WriteFile` and `StrReplaceFile` (names current Kimi does not use) instead of `Write` and `Edit`. ZCode research and review profiles now deny `Write` and `Edit` as well. The architect is now read-only on every host, matching OpenCode, Pi, and Codex: it returns ADR content for `@writer` to persist. Devin no longer auto-loads the OMP-specific root rule beside its own always-on `AGENTS.md`. Profiles drop `model: inherit`, which matches the hosts' default. `maestria update cursor` carries a configured model from an earlier Cursor-only profile copy onto the shared profile.

Release the CLI and plugin together: the updated CLI reads Codex profiles from `agents/maestria-<role>.toml` and configures Cursor models in `agents/<role>.md`, so run `maestria update cursor` before `maestria configure cursor` on an existing install.
