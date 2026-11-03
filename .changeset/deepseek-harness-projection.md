---
'@maestria/deepseek': minor
'maestria': minor
---

Add `@maestria/deepseek`, a DeepSeek Harness bundle for `0.2.1-rc.5` with a `maestria` agent preset: the main loop as its persona, the global rules as a system-prompt section, project-root `.maestria/` files on every turn, and a `tools/pre-execute` guard that denies git hook bypasses and asks before risky git commands, generated-file edits, and email addresses in commit or PR text. Its `maestria_reviewer` tool starts a child on a `maestria-reviewer` preset with only read, search, and skill tools. It ships the workflow-mode and method skills. `maestria install deepseek` installs it into the `web` profile with `dsh plugin add`.
