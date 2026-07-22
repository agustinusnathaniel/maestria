# OMP Platform Detection Reference

## Path Layout

OMP v17 stores npm packages differently from Pi:

| Platform | Package path                                             | CLI check   |
| -------- | -------------------------------------------------------- | ----------- |
| Pi       | `~/.pi/agent/npm/node_modules/@maestria/pi/package.json` | `which pi`  |
| OMP      | `~/.omp/plugins/node_modules/@maestria/omp/package.json` | `which omp` |

The OMP path uses `plugins/` not `agent/npm/`. This differs from Pi's convention and was the cause of a detection bug (the handler was initially hardcoded to `agent/npm/node_modules/`).

## `npm:` Prefix Self-Alias Loop

### Problem

Using `npm:@maestria/omp` instead of `@maestria/omp` causes bun to store a self-alias:

```json
"@maestria/omp": "npm:@maestria/omp"
```

This creates a dependency loop because the package name key (`@maestria/omp`) matches the resolved npm package name (`@maestria/omp`).

### Error Signature

```
error: Package "@maestria/omp@0.2.3" has a dependency loop
 Resolution: "@maestria/omp@0.2.1"
 Dependency: "@maestria/omp@npm:@maestria/omp@latest"
```

### Fix

Use bare package names without the `npm:` prefix:

- `omp plugin install @maestria/omp` (correct)
- `omp plugin install npm:@maestria/omp` (incorrect - causes self-alias)

The `npm:` prefix is never used in OMP's official documentation and is a parser compatibility shim, not a documented CLI feature.

### Remediation for existing installations

```bash
cd ~/.omp/plugins && bun install @maestria/omp
```

This replaces the stale alias with a normal semver range like `"^0.2.3"`.

## Install/Update Commands

All OMP package operations delegate to the `omp` CLI:

| Operation | Command | Notes |
| --- | --- | --- |
| Install | `omp plugin install @maestria/omp` | No subagent prerequisite needed (unlike Pi) |
| Update | `omp plugin install @maestria/omp@<version>` | Version tag appended to package name |
| Uninstall | `omp plugin uninstall @maestria/omp` | Delegates entirely to omp |

The `omp` CLI handles all npm resolution internally via `bun install`.

## History

- OMP platform handler was added to `apps/maestria-cli/src/lib/platforms.ts` alongside Cursor support
- Initial `isInstalled` path used `agent/npm/` (copied from Pi pattern) which was incorrect for OMP v17
- Initial install/update commands used `npm:` prefix which caused bun self-alias loop
- Both issues fixed in PR #120 (`fix/omp-npm-alias-loop`)
