#!/usr/bin/env python3
"""Sync plugin manifest versions from each package.json after `changeset version`.

`changeset version` bumps the version in each package's package.json - the
single source of truth for the published artifact. Platform plugin manifests
that ship with those packages (and the Hermes Python _version.py used for
PyPI builds) must mirror that version so the published artifact never drifts
from the npm metadata.

Run without arguments to sync every manifest. Run with --check to verify
parity without writing and exit non-zero on drift (wired into `pnpm check` /
`pnpm check:ci`).

Failure behavior is fail-closed: a missing package.json, a package.json
without a version or with a non-string/invalid semver version, or a
malformed manifest is reported as an ERROR and exits non-zero in BOTH
modes. A missing manifest is reported as DRIFT in --check mode and ERROR
in write mode - either way it exits non-zero. In --check mode, drift
between a manifest and its package.json also exits non-zero. Sync mode
repairs drift but never silently skips a required target.

A manifest with duplicate top-level JSON ``version`` keys is reported as
an ERROR in both modes: ``json.loads`` silently keeps the last occurrence
while most other readers keep the first, so the synchronizer refuses to
guess which one is authoritative instead of reporting a false success.
The package.json source of truth is held to the same rule, and a JSON
document with anything but whitespace after its top-level object is
malformed and rejected rather than silently truncated.

Targets
-------
- @maestria/hermes       packages/hermes/package.json
                         -> src/maestria_hermes/_version.py
                         -> plugin.yaml
- @maestria/claude-code  packages/claude-code/package.json
                         -> .claude-plugin/plugin.json
"""

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION_PY_HEADER = '"""Package version -- single source of truth."""'

# SemVer 2.0.0 (https://semver.org): package.json versions are published as
# semver, so anything else is a release-pipeline bug and must fail loudly.
SEMVER_RE = re.compile(
    r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?"
    r"(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?"
)

# (package dir, list of manifest paths relative to the package dir)
TARGETS: list[tuple[Path, list[Path]]] = [
    (
        ROOT / "packages" / "hermes",
        [
            Path("src") / "maestria_hermes" / "_version.py",
            Path("plugin.yaml"),
        ],
    ),
    (
        ROOT / "packages" / "claude-code",
        [
            Path(".claude-plugin") / "plugin.json",
        ],
    ),
]


def _display(path: Path) -> Path:
    """Return the repo-relative path when possible, else the path itself."""
    try:
        return path.relative_to(ROOT)
    except ValueError:
        return path


def read_manifest_version(path: Path) -> str | None:
    """Return the version declared by a manifest, or None if undeclared.

    JSON manifests are located via the top-level token walk, so a duplicate
    top-level "version" key raises ValueError instead of returning the value
    that ``json.loads`` happens to keep.
    """
    if path.suffix == ".py":
        match = re.search(r'__version__\s*=\s*"([^"]+)"', path.read_text(encoding="utf-8"))
        return match.group(1) if match else None
    if path.suffix in (".yaml", ".yml"):
        match = re.search(r"^version:\s*(\S+)", path.read_text(encoding="utf-8"), re.MULTILINE)
        return match.group(1) if match else None
    if path.suffix == ".json":
        text = path.read_text(encoding="utf-8")
        span = _top_level_json_value_span(text, "version")
        if span is None:
            return None
        return json.loads(text[span[0] : span[1]])
    raise ValueError(f"unsupported manifest format: {path.suffix}")


def _top_level_json_value_span(text: str, key: str) -> tuple[int, int] | None:
    """Locate the raw ``[start, end)`` span of the top-level object's ``key`` value.

    Walks the top-level JSON object token-by-token so a nested ``key`` (e.g.
    inside an earlier ``meta`` object) is never mistaken for the top-level
    field. The returned span covers the raw value text only, so the rest of
    the file - indentation, spacing, ordering - is preserved verbatim.
    Returns None when the key is absent, and raises ValueError on malformed
    or non-object JSON. A top-level ``key`` that appears more than once is
    ambiguous - ``json.loads`` keeps the last occurrence while most other
    readers keep the first - so it raises ValueError instead of letting the
    caller guess at which one is authoritative. Content other than whitespace
    after the top-level object is also rejected: ``raw_decode`` only consumes
    a prefix, so the object walk verifies the document ends at the closing
    brace instead of silently truncating trailing garbage.
    """
    decoder = json.JSONDecoder()
    n = len(text)

    def skip_ws(i: int) -> int:
        while i < n and text[i] in " \t\r\n":
            i += 1
        return i

    i = skip_ws(0)
    if i >= n or text[i] != "{":
        raise ValueError("top-level value is not a JSON object")
    i += 1  # consume '{'
    first_span: tuple[int, int] | None = None

    def finish(i: int) -> tuple[int, int] | None:
        """Return the collected span, rejecting anything past the closing brace."""
        tail = skip_ws(i + 1)
        if tail < n:
            raise ValueError("trailing content after top-level JSON object")
        return first_span

    while True:
        i = skip_ws(i)
        if i >= n:
            raise ValueError("unterminated JSON object")
        if text[i] == "}":
            return finish(i)
        if text[i] != '"':
            raise ValueError("expected object key string")
        k, end = decoder.raw_decode(text, i)
        if not isinstance(k, str):
            raise ValueError("expected string key")
        i = end
        i = skip_ws(i)
        if i >= n or text[i] != ":":
            raise ValueError("expected ':' after key")
        i += 1  # consume ':'
        i = skip_ws(i)
        if i >= n:
            raise ValueError("unterminated JSON object")
        value, end = decoder.raw_decode(text, i)
        if k == key:
            if first_span is not None:
                raise ValueError(f'duplicate top-level "{key}" key in JSON object')
            first_span = (i, end)
        i = end  # skip the whole nested value, whatever its shape
        i = skip_ws(i)
        if i >= n:
            raise ValueError("unterminated JSON object")
        if text[i] == ",":
            i += 1
            continue
        if text[i] == "}":
            return finish(i)
        raise ValueError("expected ',' or '}' in JSON object")


def write_manifest_version(path: Path, version: str) -> None:
    """Rewrite the version field of a manifest, preserving its formatting."""
    if path.suffix == ".py":
        path.write_text(f'{VERSION_PY_HEADER}\n__version__ = "{version}"\n', encoding="utf-8")
        return
    if path.suffix in (".yaml", ".yml"):
        text = path.read_text(encoding="utf-8")
        text, count = re.subn(
            r"^version:\s*\S+.*$",
            f"version: {version}",
            text,
            count=1,
            flags=re.MULTILINE,
        )
        if count == 0:
            raise RuntimeError(f'no "version" field found in {path}')
        path.write_text(text, encoding="utf-8")
        return
    if path.suffix == ".json":
        text = path.read_text(encoding="utf-8")
        span = _top_level_json_value_span(text, "version")
        if span is None:
            raise RuntimeError(f'no top-level "version" field found in {path}')
        start, end = span
        text = text[:start] + json.dumps(version) + text[end:]
        # Fail loudly rather than corrupting the manifest.
        json.loads(text)
        path.write_text(text, encoding="utf-8")
        return
    raise ValueError(f"unsupported manifest format: {path.suffix}")


def sync_target(package_dir: Path, manifests: list[Path], check: bool) -> list[str]:
    """Sync one package's manifests to its package.json version.

    Returns result lines:
    - "OK: <path> (<version>)" / "OK: synced <path> to <version>"
    - "DRIFT: <path> expected <a> found <b>" / "DRIFT: <path> not found" -
      fails only check mode (drift, or a required manifest missing)
    - "ERROR: <detail>" - hard failure in both modes (missing package.json,
      missing/non-string/invalid semver version, malformed package.json or
      manifest - including a duplicate top-level version key or content
      after the top-level object - or unreadable/unwritable target; a
      missing manifest in write mode)
    """
    pkg_json = package_dir / "package.json"
    if not pkg_json.exists():
        return [f"ERROR: required target {_display(pkg_json)} not found"]
    try:
        pkg_text = pkg_json.read_text(encoding="utf-8")
        pkg = json.loads(pkg_text)
        # json.loads keeps the last of duplicate keys while most other readers
        # keep the first, so the source of truth must reject a duplicate
        # top-level "version" - the same rule the manifest walk enforces.
        _top_level_json_value_span(pkg_text, "version")
    except (OSError, ValueError) as exc:
        return [f"ERROR: cannot read {_display(pkg_json)}: {exc}"]
    if not isinstance(pkg, dict) or "version" not in pkg:
        return [f"ERROR: no version field in {_display(pkg_json)}"]
    version = pkg["version"]
    if not isinstance(version, str) or not version.strip():
        return [
            f"ERROR: invalid version {version!r} in {_display(pkg_json)}: "
            "expected a non-empty string"
        ]
    if not SEMVER_RE.fullmatch(version):
        return [
            f"ERROR: invalid semver version {version!r} in {_display(pkg_json)}"
        ]

    results: list[str] = []
    for manifest in manifests:
        manifest_path = package_dir / manifest
        rel = _display(manifest_path)
        if not manifest_path.exists():
            results.append(
                f"{'DRIFT' if check else 'ERROR'}: {rel} not found"
            )
            continue
        try:
            current = read_manifest_version(manifest_path)
        except (OSError, ValueError) as exc:
            results.append(f"ERROR: cannot read {rel}: {exc}")
            continue
        if current == version:
            results.append(f"OK: {rel} ({version})")
            continue
        if check:
            results.append(f"DRIFT: {rel} expected {version} found {current}")
        else:
            try:
                write_manifest_version(manifest_path, version)
            except (OSError, ValueError, RuntimeError) as exc:
                results.append(f"ERROR: cannot sync {rel}: {exc}")
                continue
            results.append(f"OK: synced {rel} to {version}")
    return results


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Sync plugin manifest versions from package.json "
            "(see module docstring for the full target table)."
        )
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify parity without writing; exit 1 on drift or required-target errors",
    )
    args = parser.parse_args()

    had_error = False
    for package_dir, manifests in TARGETS:
        results = sync_target(package_dir, manifests, check=args.check)
        for result in results:
            print(result)
        if any(result.startswith(("DRIFT", "ERROR")) for result in results):
            had_error = True

    if had_error:
        if args.check:
            print("\nManifest versions out of sync - run: python3 scripts/sync-plugin-versions.py")
        else:
            print("\nFailed to sync plugin manifest versions - fix the reported errors and retry")
        return 1
    if args.check:
        print("\nAll plugin manifest versions are in sync")
    return 0


if __name__ == "__main__":
    sys.exit(main())
