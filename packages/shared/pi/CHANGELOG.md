# @maestria/shared-pi

## 0.4.0

### Minor Changes

- [#175](https://github.com/agustinusnathaniel/maestria/pull/175) [`6f21b47`](https://github.com/agustinusnathaniel/maestria/commit/6f21b47e4c3e03353163ad4f83e49a227a798687) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Extend the platform-agnostic shared state contract with a native-goal mirror
  containing an objective and status, including the new shape in initial state,
  persistence, and summaries.

  The `@maestria/pi` patch bundles this shared state-core update in its published
  extension artifact, so Pi recognizes and renders the new state shape.

## 0.3.0

### Minor Changes

- [#145](https://github.com/agustinusnathaniel/maestria/pull/145) [`ea3d492`](https://github.com/agustinusnathaniel/maestria/commit/ea3d4920f4d01298c9decbd3dfc80551c82bcbf3) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Enforce pure dispatcher pattern on Pi and OMP with auto-detect mode keywords

  - **Pure dispatcher enforcement**: when a workflow mode (fein/sonar/blitz) is active, the orchestrator is now restricted to only delegation tools (`maestria_subagent`/`task`). Implementation tools like `bash`, `edit`, and `write` are blocked at the tool level, enforcing the maker/checker split automatically.
  - **Auto-detect mode keywords**: type `fein do X` at the start of any message and the plugin automatically strips the keyword and injects the mode prompt inline. No slash command needed.
  - **Refactor Pi and OMP plugins** to share common infrastructure behind the scenes, ensuring consistent behavior across both platforms.

## 0.2.0

### Minor Changes

- [#133](https://github.com/agustinusnathaniel/maestria/pull/133) [`8ed34dd`](https://github.com/agustinusnathaniel/maestria/commit/8ed34ddbbe42b1bfe8b8dda8a91f61ac779a078a) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Extract shared state-core module (state types, transforms, persistence, review, render) and agent-deployment utilities from OMP and PI into @maestria/shared-pi. Deepen OMP and PI monolithic state modules into focused sub-modules with clear separation of concerns.
