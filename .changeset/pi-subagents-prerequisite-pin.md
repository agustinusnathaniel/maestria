---
'maestria': minor
---

Pin the Pi subagent prerequisite to its supported range instead of installing bare latest. `pi install npm:@gotgenes/pi-subagents` tracked the registry's latest line, so a new upstream major could change what an install puts on a user's machine and put it outside the `@maestria/pi` peer range. A failure to install the prerequisite is still ignored so it cannot block the main package install.