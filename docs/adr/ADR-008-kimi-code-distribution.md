# ADR-008: Kimi Code Plugin Distribution — Subtree-Split Release Branch

## Status

Accepted (Revised 2026-06-18)

## Context

Kimi Code v0.13.1's plugin system only finds `kimi.plugin.json` at the root of the extracted archive. The kimi-code plugin lives at `packages/kimi-code/` in a monorepo, which Kimi Code cannot extract as a subpath. Its URL parser interprets any `/tree/<ref>/<subpath>` as a git ref, not a path. Subpath URLs are not supported; neither is npm install (Kimi Code's installer only fetches via codeload.github.com).

This ADR records the distribution mechanism chosen to ship the plugin from a monorepo. The full plugin architecture (manifest, skills, subagent mapping, orchestrator) is captured in ADR-004.

## Decision Drivers

- **Kimi Code's installer only accepts archive URLs** — it fetches via codeload.github.com, extracts the zip, and looks for `kimi.plugin.json` at the archive root. Subpath URLs and npm installs are not supported.
- **The monorepo root must stay clean** — there are multiple top-level packages (opencode, kimi-code, docs) plus ADRs and a docs site. Putting `kimi.plugin.json` at the root would make the whole repo look like a Kimi Code plugin even though it ships other consumers, and the manifest's `skills: "./skills/"` would not resolve.
- **Auto-update is the right default UX** — users should not need to track plugin versions or copy new URLs. A stable install URL that always points at the latest version is preferable to a pinned URL that needs manual updates.
- **CI complexity budget is low** — the simplest solution that satisfies the constraints is preferred, but complexity is acceptable if it buys auto-update.

## Considered Options

### Option A — Move `kimi.plugin.json` to the monorepo root

- **Pros**: No CI needed. `kimi.plugin.json` at the root would be picked up by Kimi Code's installer with the bare repo URL.
- **Cons**: Pollutes the monorepo's identity — the whole repo would look like a Kimi Code plugin even though it ships `@maestria/opencode` and a docs site. The `skills: "./skills/"` path would not resolve to `packages/kimi-code/skills/`. **Rejected.**

### Option C — Cut a separate `maestria-kimi-code` repo

- **Pros**: Cleanest. The plugin lives in its own repo. The bare repo URL works directly. No subpath, zip, or branch issues.
- **Cons**: Biggest maintenance burden — the monorepo would need to mirror the plugin back, or the plugin would have to live in two places. Cross-cutting changes (e.g., updating the orchestrator skill) require touching two repos. **Deferred.**

### Option F — Subtree split into a release branch — **CHOSEN**

- **Pros**: Best auto-update UX — a release branch can be kept current via `git subtree split`, and `/plugins install <branch-url>` follows it. Monorepo root stays clean. No zip, no GitHub Releases. A single stable install URL for the lifetime of the plugin.
- **Cons**: More complex CI — the workflow maintains a release branch with force-pushes on every release tag. The release branch is a synthetic, non-human-maintained artifact (force-pushed history is the cost of auto-update).

### Option G — CI tarball on release

- **Pros**: Simplest CI. The monorepo root stays clean. Each install is pinned to a specific tag's zip — fully reproducible.
- **Cons**: No auto-update. Each install pins to a specific tag's zip; users must re-run `/plugins install <new-url>` to upgrade. **Deferred** (F gives us the same monorepo-root cleanliness plus auto-update, at the cost of one force-push per release).

## Decision

We use **Option F: subtree split into a release branch**. A GitHub Action (`.github/workflows/release-kimi-code.yml`) triggers on push of any `@maestria/kimi-code@*` tag, runs `git subtree split --prefix=packages/kimi-code`, and force-pushes the resulting commit to a `release/kimi-code` branch where `kimi.plugin.json` sits at the root.

The subtree split hoists `packages/kimi-code/*` to the branch root, so the manifest's `skills: "./skills/"` resolves correctly without any path rewriting.

### Tag Convention

`@maestria/kimi-code@*` — mirrors the npm scoped package convention. The literal `@` in git tag names is unusual but valid. Examples:

- `@maestria/kimi-code@v0.1.0` → triggers a release branch update
- `@maestria/kimi-code@v0.2.0` → triggers a release branch update

### CI Behavior

```yaml
on:
  push:
    tags:
      - "@maestria/kimi-code@*"
```

The workflow:

1. Checks out the repo at the tag
2. Runs `git subtree split --prefix=packages/kimi-code "$GITHUB_SHA" -B split-tmp` — produces a branch whose history is the commits that touched the prefix, with paths rewritten to be at the root
3. Runs `git checkout -B release/kimi-code split-tmp` — create-or-reset the release branch to the split commit
4. Force-pushes `release/kimi-code` to origin (using `--force-with-lease`, with a `git push origin` fallback)
5. Cleans up the temporary split branch and checks out `main`

### Install URL Forms

| Form                  | URL                                                                     |
| --------------------- | ----------------------------------------------------------------------- |
| Auto-update (default) | `https://github.com/agustinusnathaniel/maestria/tree/release/kimi-code` |
| Pin to commit         | `https://github.com/agustinusnathaniel/maestria/commit/<sha>`           |
| Pin to tag            | `https://github.com/agustinusnathaniel/maestria/releases/tag/<tag>`     |

The auto-update form is the primary install URL. Re-installing picks up the latest version of the plugin from the `release/kimi-code` branch, which is rewritten on every release tag push.

## Consequences

### Positive

- **Monorepo root stays clean** — `kimi.plugin.json` lives at `packages/kimi-code/kimi.plugin.json`, not at the root
- **Auto-update UX** — users install once, then re-install to pick up the latest version. No version tracking, no URL rotation
- **Single stable install URL** — the `tree/release/kimi-code` URL works for the lifetime of the plugin
- **All 4 Kimi Code URL forms work** — `tree/<branch>` (default), `commit/<sha>` (pinned), `releases/tag/<tag>` (alternative pinning), and the raw `codeload.github.com` archive that Kimi Code fetches under the hood
- **Atomic** — pushing a tag updates the branch in one CI run; the branch is always consistent
- **No zip, no GitHub Releases** — the artifact surface is just a git branch, not a release object

### Negative

- **Release branch is synthetic** — it is not human-maintained; it is rewritten on every release tag push
- **Force-push is used** — `--force-with-lease` is safe under concurrent pushes, but anyone with a local clone of the release branch must rebase. The branch is read-only by convention
- **No version pinning at the install URL level** — users pin via commit SHA, not via version tag. This is a feature (single URL) but requires users to know that pinning means copying a SHA
- **The workflow is more complex than G's** — a few more lines of bash, a force-push, and a synthetic branch to understand

### Risks

- **Tag typo** — pushing a tag that doesn't match the pattern silently does nothing (no CI run). Mitigation: documented convention; the workflow file is the source of truth.
- **Force-push torn state** — if Kimi Code caches plugin content aggressively, an in-flight re-install could see a torn state. Mitigation: rare in practice; Kimi Code fetches the archive on each install.
- **Subtree split on large history** — `git subtree split` walks the history of the prefix; for a long-lived plugin this can be slow. Mitigation: not a problem at 0.x scale; revisit at 1.0.
- **The `manifest.ts` "no manifest" error** — if a user installs the bare repo URL by accident, Kimi Code fails with "no manifest" because the monorepo root has no `kimi.plugin.json`. Mitigation: the install docs explicitly call out the release-branch URL and link to this ADR.
- **GitHub tag UI rendering** — some git tag UIs (e.g., `git tag --list` output) may render the `@` in a way that requires quoting. Mitigation: documented; works correctly in all standard tooling.

## Future Considerations

### Layering with Option G (release tarball) — Possible

If the plugin needs version-pinning at the URL level, a second workflow job could attach a zip to each release. The branch path remains the primary install path (auto-update); the zip path becomes an opt-in pinned install path. Out of scope for now.

### Subpath support upstream — Future

If the Kimi Code team adds subpath support to its URL parser (so `/tree/<ref>/<subpath>` is interpreted as a path, not a ref), the workflow can be retired and the install URL can point directly at the monorepo's `packages/kimi-code/` subpath. Until then, the release branch is the cleanest way to satisfy the manifest-at-root constraint.

### Mirroring to a separate repo (Option C) — Possible

If the maintenance burden of the monorepo ever outweighs the cost of a separate repo, the plugin can be moved to `agustinusnathaniel/maestria-kimi-code` and the workflow can target that repo instead. The monorepo would then mirror the plugin back via the release workflow. Out of scope for now.

### Signing the release branch — Future

For supply-chain security, the workflow could sign the release-branch tip with `gpg` or `cosign`. Kimi Code v0.13.1 does not verify signatures, so this is not actionable today. Defer until Kimi Code adds signature verification.

### Auto-update via Kimi Code marketplace — Future

Kimi Code's marketplace UI shows `update <local> → <latest>` when a newer version is available (per ADR-004's "Consequences" section). This is the platform's auto-update affordance — we don't need to invent our own. The marketplace surfaces new releases once the release branch moves.

## Related Decisions

- **ADR-004** — Kimi Code plugin architecture. Documents the manifest, skills, and subagent mapping. The distribution mechanism is downstream of the manifest's "root-of-archive" constraint.
- **ADR-007** — Opensrc vs. webfetch guidance. Not directly related, but the `opensrc path <owner/repo>` pattern reads from a GitHub repository; this ADR documents how to install plugins from a GitHub repository.

## Date

2026-06-18
