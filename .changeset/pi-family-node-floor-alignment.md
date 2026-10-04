---
"@maestria/omp": patch
"@maestria/prime-agent": patch
---

Raise the Node.js engine floor to `>=22.19.0` across the Pi-family packages as a conservative alignment with the Pi host line's requirement. The floor is provisional rather than host-derived: `@oh-my-pi/pi-coding-agent` declares only a Bun engine and no `node` key, and Prime Agent has no published host manifest to confirm it against.