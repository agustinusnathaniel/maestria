# Changesets

## How it works

1. When you make changes, run `pnpm changeset` to create a changeset
2. Choose the bump type (major, minor, patch)
3. Write a description of your changes
4. Commit the changeset file
5. When merged to `main`, the release workflow will:
   - Version bump all packages
   - Update CHANGELOG.md files
   - Publish packages to npm
   - Create a GitHub release
