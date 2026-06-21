---
"@maestria/opencode": patch
---

Fix ESM compatibility: add .js extensions to relative imports

Relative imports in the plugin source were missing `.js` extensions,
causing ERR_MODULE_NOT_FOUND in Node ESM environments. Added `.js`
extensions to all 5 internal imports and a build-time verification
script to catch future regressions.
