---
'@maestria/omp': minor
---

Widen the `@oh-my-pi/pi-coding-agent` peer range to `>=17.0.5 <19.0.0` so the published Oh My Pi 18.x line is admitted, and move the range into the workspace catalog so the range has a single home that install, typecheck, and peer validation all read. No adapter change was required; the package typechecks and its tests pass against 18.x.