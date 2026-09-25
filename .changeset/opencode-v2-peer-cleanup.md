---
'@maestria/opencode-v2': patch
---

chore: remove unused opentui and solid peerDeps plus dead JSX flag

Peer surface keeps only @opencode-ai/plugin. No src or tests imports reference opentui or solid, no tsx or jsx files exist, and the vite entry stays src/index.ts only. Effect usage and capabilities (agents, modes, session hook, references, skills, commands) are unchanged.
