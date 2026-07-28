---
'@maestria/core': minor
'@maestria/opencode': patch
'@maestria/pi': patch
'@maestria/kimi-code': patch
'@maestria/hermes': patch
'@maestria/omp': patch
---

Blind review and fail-loud iteration exit for the review protocol.

**Blind review** - The reviewer agent no longer receives the builder's
handoff notes or self-assessment. It now evaluates only the diff,
requirements, and acceptance criteria. This removes a bias: the reviewer
was previously primed by the builder's own narrative about what changed,
rather than judging the code against the spec directly.

**Fail-loud iteration exit** - When the review loop runs 3 cycles with
unresolved issues, instead of silently documenting the gap and proceeding,
the pipeline now stops and escalates. It produces a structured report of
what's still blocking and requires your explicit override to continue.

**How this affects you:** Reviews are more objective now. If a review
stalls, you'll get a clear report of what's blocking it rather than a
quiet pass. No action required on your end - your agents handle the new
protocol automatically.
