---
'@maestria/pi': patch
'@maestria/omp': patch
'@maestria/prime-agent': patch
---

Internal consolidation: share the review-model context type through the private shared-pi review core, drop the redundant omp agent-source guard (the shared core already handles it), and delegate prime-agent mode keywords, markers, and skill-section extraction to the private shared-mode package. No user-facing behavior change; generated agent and skill output is unchanged.
