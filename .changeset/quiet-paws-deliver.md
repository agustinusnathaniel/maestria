---
'@maestria/pi': patch
'@maestria/omp': patch
---

Move @maestria/shared-pi to devDependencies

Reclassify the internal `@maestria/shared-pi` dependency from `dependencies` to
`devDependencies` in both the pi and omp packages. This shared package is bundled
into `dist/extension.mjs` at build time and is never published to npm.

**Why this matters:** Without this fix, users updating pi or omp encounter npm
install failures because `@maestria/shared-pi` is a private package. This is
solely a dependency classification fix — no behavioral change for end users.
