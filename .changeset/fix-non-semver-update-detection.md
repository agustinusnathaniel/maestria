---
'maestria': patch
---

fix(cli): treat non-semver latest versions as incomparable in update --all detection

The hermes platform handler intentionally reports `see GitHub releases` as its
latest version (a display sentinel). `compareVersions` previously fell through
to `localeCompare` for non-semver strings, so `update --all` always flagged
hermes as needing an update and reported a fake success. Non-semver values are
now incomparable (`compareVersions` returns `null`), and
`isVersionDifferent` treats an incomparable pair as not different.
