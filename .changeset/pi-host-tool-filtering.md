---
'@maestria/pi': patch
---

Stop emitting the `glob` tool name in generated Pi agent frontmatter. Pi does not register a `glob` builtin, and its frontmatter parser does not validate tool names, so the entry was an inert filter that denied nothing and granted nothing. Pi now receives only tool names its host registers; `find` and `grep` already cover glob-shaped search. Oh My Pi, where `glob` is a real builtin, is unaffected and its generated files are unchanged.