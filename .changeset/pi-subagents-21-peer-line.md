---
'@maestria/pi': minor
---

Move the `@gotgenes/pi-subagents` peer to the 21.x line and reference the range through the workspace catalog. The declared `^18.0.0` peer rejected the 21.x releases that the documented install path was already installing unpinned, so a fresh `maestria install pi` produced a peer conflict. The 21.9.0 contract is unchanged for everything this package calls: `getSubagentsService`, `spawn`, `getRecord`, `abort`, the `SpawnOptions` keys passed, and the `SUBAGENT_EVENTS` names subscribed to. Its new `typebox` peer is already declared here, so the upgrade adds no second dependency.