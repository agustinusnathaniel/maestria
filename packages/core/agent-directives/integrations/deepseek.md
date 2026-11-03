## DeepSeek Harness Integration

The `maestria` agent preset composes this methodology into DeepSeek Harness: the main loop is the persona, the global rules are a system-prompt section, and project-root `.maestria/workflow.md` and `.maestria/rules.md` are re-read into the context every turn, so the Workflow step is already done.

`@reviewer` is the `maestria_reviewer` tool. It starts a child on the `maestria-reviewer` preset, whose final answer returns as a notice when it settles; its tools are `read`, `read_image`, `glob`, `grep`, `skill`, and the host's `working_directory`: it has no shell, edit, write, or delegation tool. Pass the requirements, acceptance criteria, and diff in the prompt, because the child does not see this conversation.

A maestria plugin checks each `bash`, `edit`, and `write` call before it runs: it denies git hook bypasses and asks before risky git commands, edits to generated files, and email addresses in commit or PR text. An ask uses DeepSeek Harness's own approval prompt; DeepSeek Harness's sandbox, approval policy, and permission presets still decide everything else.

Workflow modes are the `fein`, `sonar`, and `blitz` skills: when a message starts with a mode keyword, load the matching skill before acting.

See [DeepSeek Harness plugins](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/).
