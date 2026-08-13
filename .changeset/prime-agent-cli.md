---
"maestria": minor
---

Add Maestria CLI compatibility for the Prime Agent platform (`prime-agent`). The CLI detects the
Prime Agent binary, inspects its package registrations via `prime-agent package list`, and
delegates install, update, status, check, and uninstall to Prime's native package commands
(`package install`/`update`/`remove npm:@maestria/prime-agent`).

Prime support is deliberately global (user scope only). Because Prime resolves project settings
from the current working directory, every Prime command runs from a freshly created empty
temporary directory - created up front (failing closed if it cannot be created) and removed on
both success and failure - so a project's registrations are never scanned, counted as installed,
or modified. Project-only registrations are not managed.

Updates use Prime's latest-only package semantics, so exact version pinning is not exposed; a
version-pinned user registration is detected up front and reported as an accurate error (even
when the installed version already equals the latest) instead of being silently skipped or
reported as a successful update.
