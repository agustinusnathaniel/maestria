# Maestria Project Workflow

Project-specific routing for the Maestria monorepo. Use the smallest safe route: direct execution for familiar, low-risk work; reconnaissance or design when the code or approach is uncertain; full orchestration when independent stages materially reduce risk.

## Before Changing Files

1. Read the task, issue, or PR and extract acceptance evidence.
2. Read AGENTS.md for repository rules.
3. Read README.md, VISION.md, or PATTERNS.md only when the change needs that context.
4. Map the affected package and read its README or relevant ADRs.
5. Inspect recent history when the change depends on prior behavior.

Use @adventurer for unfamiliar code, cross-package changes, or reconnaissance that another stage will consume. Do not delegate context gathering for a familiar, atomic edit.

## ADRs and Design

Read relevant decisions before changing architecture, package boundaries, sync behavior, permissions, or platform integration:

| Area                                                 | ADR directory       |
| ---------------------------------------------------- | ------------------- |
| Core structure, directives, tooling, and conventions | docs/adr/core/      |
| OpenCode                                             | docs/adr/opencode/  |
| Kimi Code                                            | docs/adr/kimi-code/ |
| Cursor                                               | docs/adr/cursor/    |
| Hermes                                               | docs/adr/hermes/    |
| Pi and Oh My Pi                                      | docs/adr/pi/        |

Create an ADR for a new architectural pattern, dependency, or structural boundary. Use the required fields in the documentation format guide at ../docs/guides/doc-format.md.

## Reuse Before Adding

Before @builder changes code:

- Search for an existing utility, directive, sync transform, or package pattern.
- Check packages/core/agent-directives/ before adding methodology.
- Check the relevant sync.config.ts before adding a platform transform.
- Justify new dependencies against the lightweight, platform-independent design.

## Implement and Verify

Run the smallest gate that covers the change, then expand it when evidence requires:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

For documentation changes, also run:

```bash
pnpm --filter @maestria/docs test
pnpm --filter @maestria/docs build
git diff --check
```

After any change under packages/core/agent-directives/:

```bash
scripts/sync-all
scripts/check-sync
```

Generated projections must match the canonical source. Add tests for new behavior and verify idempotence when changing installers, sync, or mode detection.

## Commit and Documentation

Follow the commit, changeset, and pull request guidance in CONTRIBUTING.md. Split unrelated concerns into separate commits. A changeset is required for user-facing package changes.

Update documentation when behavior, architecture, or user-facing workflows change. Use the matching location:

| Change                       | Documentation                                                 |
| ---------------------------- | ------------------------------------------------------------- |
| Core methodology or pipeline | apps/docs/src/content/docs/core/                              |
| Platform behavior            | apps/docs/src/content/docs/<platform>/ and the package README |
| Architecture or boundary     | docs/adr/<area>/                                              |
| Project-wide rule or pattern | AGENTS.md, PATTERNS.md, or VISION.md                          |

## Precedence

Repository rules, host permissions, maker/checker independence, bounded retries, and commit authorization take precedence over this file. If an instruction conflicts, follow the higher-priority rule and record the constraint in the handoff.
