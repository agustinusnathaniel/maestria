---
"maestria": patch
---

Skip redundant `maestria setup` confirmations when there is nothing to change. Selections left unchanged no longer trigger the trailing skills confirmation, fully no-op plans exit 0 with an already-set-up summary instead of prompting, and the ecosystem picker labels detected tools as already installed.
