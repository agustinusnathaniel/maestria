---
'@maestria/hermes': patch
---

Stop the plugin from claiming `/review` and `/plan`, which Hermes core owns.

Registering a command that collides with a built-in is already rejected by the
loader (`PluginManager.register_command` checks
`hermes_cli.commands.resolve_command` and skips it). The failure was quiet and
worse than the rejection: `MAESTRIA_COMMANDS` also gates
`pre_gateway_dispatch`, which runs BEFORE command resolution and returns
`{"action": "skip"}`. Typing `/review` therefore dropped the message, flipped
the plugin into fein mode, and never reached core's `/review` - an independent
review subagent - at all.

- Drop `review` and `plan` from `MAESTRIA_COMMANDS`, `register()`, and
  `plugin.yaml`. The plugin now registers 5 commands, all verified free.
- Add `test_commands_do_not_collide_with_core`, which resolves every
  registered command against the live `COMMAND_REGISTRY`. The existing
  manifest/registration equality tests read the same constant on all three
  sides, so they passed while the commands were being dropped at runtime.
- Document the collision rule so a future alias is added deliberately.

No behavior change for the five mode commands.
