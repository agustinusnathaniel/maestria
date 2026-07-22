---
'@maestria/opencode': patch
---

fix: use module.findPackageJSON for package-root-relative path resolution

The mode prompt loader used a hardcoded relative path that resolved correctly from source but broke after bundling because the bundler flattens directory structure. Replaced with Node.js built-in `module.findPackageJSON` which finds the package root regardless of where the code is loaded from.
