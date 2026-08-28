---
'@maestria/opencode-v2': minor
---

feat: align opencode-v2 plugin with @opencode-ai/plugin next-17444

Re-verified the V2 beta promise API against the new pin (next-16694 to next-17444 diff) and adapted the POC: global rules injection migrated from a manual system-push inside ctx.session.hook('context') to the native ctx.reference.transform() mechanism (new src/transforms/references.ts), session hooks now only handle mode keyword detection and stripping. README verdict table refreshed against current /v2 docs, upstream repo citation fixed, and the compaction non-port documented under Known limitations.
