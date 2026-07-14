---
'@maestria/maestria-cli': patch
---

Use network-first version lookup for `npm view` instead of TTL cache

`npmViewVersion` was returning stale versions for up to 1 hour when the
cache entry hadn't expired. Switched to network-first: always hit npm for
the live version, falling back to cache only when the network call fails.
