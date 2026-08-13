"""Focused tests for ``scripts/sync-plugin-versions.py``.

The synchronizer copies each package.json ``version`` into the platform
plugin manifests that ship with it (Hermes ``_version.py`` + ``plugin.yaml``,
Claude Code ``plugin.json``). These tests exercise it against throwaway
fixture trees under ``tempfile.TemporaryDirectory`` - they never touch the
real repo manifests, the network, or release machinery.

Run with the repo's Python test command from the repo root::

    python3 packages/hermes/tests/test_sync_plugin_versions.py
"""

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "sync-plugin-versions.py"


def _load_sync_module():
    spec = importlib.util.spec_from_file_location("sync_plugin_versions", _SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


sync = _load_sync_module()


def _make_package(root: Path, version: str | None, manifests: dict[str, str | None]):
    """Create a fixture package dir.

    ``manifests`` maps relative manifest paths to their text; a ``None`` text
    omits the file (so the synchronizer must report it missing). Returns the
    package dir and the manifest paths as passed to ``sync_target``.
    """
    pkg = root / "pkg"
    pkg.mkdir()
    pkg_json: dict[str, object] = {"name": "fixture-pkg"}
    if version is not None:
        pkg_json["version"] = version
    (pkg / "package.json").write_text(json.dumps(pkg_json, indent=2) + "\n", encoding="utf-8")
    manifest_paths: list[Path] = []
    for rel, text in manifests.items():
        path = pkg / rel
        if text is not None:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
        manifest_paths.append(Path(rel))
    return pkg, manifest_paths


class SyncTargetTests(unittest.TestCase):
    def test_in_sync_check_reports_ok(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg, manifests = _make_package(
                Path(tmp), "1.2.3", {"plugin.json": '{\n  "version": "1.2.3"\n}\n'}
            )
            results = sync.sync_target(pkg, manifests, check=True)
            self.assertEqual(len(results), 1, results)
            self.assertTrue(results[0].startswith("OK: "), results)
            self.assertTrue(results[0].endswith("plugin.json (1.2.3)"), results)

    def test_drift_check_reports_drift_and_does_not_write(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg, manifests = _make_package(
                Path(tmp), "1.2.3", {"plugin.json": '{\n  "version": "1.2.2"\n}\n'}
            )
            results = sync.sync_target(pkg, manifests, check=True)
            self.assertEqual(len(results), 1, results)
            self.assertTrue(results[0].startswith("DRIFT: "), results)
            self.assertIn("expected 1.2.3 found 1.2.2", results[0])
            self.assertIn('"version": "1.2.2"', (pkg / "plugin.json").read_text(encoding="utf-8"))

    def test_write_mode_updates_drifted_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg, manifests = _make_package(
                Path(tmp), "1.2.3", {"plugin.json": '{\n  "version": "1.2.2"\n}\n'}
            )
            results = sync.sync_target(pkg, manifests, check=False)
            self.assertEqual(len(results), 1, results)
            self.assertTrue(results[0].startswith("OK: synced "), results)
            self.assertTrue(results[0].endswith("to 1.2.3"), results)
            manifest = json.loads((pkg / "plugin.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["version"], "1.2.3")

    def test_missing_package_json_fails_in_check_and_write(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg = Path(tmp) / "pkg"
            pkg.mkdir()
            for check in (True, False):
                results = sync.sync_target(pkg, [], check=check)
                self.assertEqual(len(results), 1, results)
                self.assertTrue(results[0].startswith("ERROR: "), results)
                self.assertIn("not found", results[0])

    def test_missing_package_version_fails_in_check_and_write(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg, _ = _make_package(Path(tmp), None, {})
            for check in (True, False):
                results = sync.sync_target(pkg, [], check=check)
                self.assertEqual(len(results), 1, results)
                self.assertTrue(results[0].startswith("ERROR: "), results)
                self.assertIn("no version", results[0])

    def test_non_string_package_version_fails_in_check_and_write(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg, _ = _make_package(Path(tmp), 42, {})
            for check in (True, False):
                results = sync.sync_target(pkg, [], check=check)
                self.assertEqual(len(results), 1, results)
                self.assertTrue(results[0].startswith("ERROR: "), results)
                self.assertIn("non-empty string", results[0])

    def test_empty_package_version_fails_in_check_and_write(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg, _ = _make_package(Path(tmp), "", {})
            for check in (True, False):
                results = sync.sync_target(pkg, [], check=check)
                self.assertEqual(len(results), 1, results)
                self.assertTrue(results[0].startswith("ERROR: "), results)
                self.assertIn("non-empty string", results[0])

    def test_invalid_semver_package_version_fails_in_check_and_write(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg, _ = _make_package(Path(tmp), "not-semver", {})
            for check in (True, False):
                results = sync.sync_target(pkg, [], check=check)
                self.assertEqual(len(results), 1, results)
                self.assertTrue(results[0].startswith("ERROR: "), results)
                self.assertIn("invalid semver", results[0])

    def test_malformed_package_json_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg = Path(tmp) / "pkg"
            pkg.mkdir()
            (pkg / "package.json").write_text("{ not json", encoding="utf-8")
            for check in (True, False):
                results = sync.sync_target(pkg, [], check=check)
                self.assertEqual(len(results), 1, results)
                self.assertTrue(results[0].startswith("ERROR: "), results)

    def test_malformed_manifest_fails_in_check_and_write(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg, manifests = _make_package(Path(tmp), "1.2.3", {"plugin.json": "{ nope"})
            for check in (True, False):
                results = sync.sync_target(pkg, manifests, check=check)
                self.assertEqual(len(results), 1, results)
                self.assertTrue(results[0].startswith("ERROR: "), results)

    def test_missing_manifest_is_drift_in_check_and_error_in_write(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg, manifests = _make_package(Path(tmp), "1.2.3", {"plugin.json": None})
            check_results = sync.sync_target(pkg, manifests, check=True)
            self.assertTrue(check_results[0].startswith("DRIFT: "), check_results)
            self.assertIn("not found", check_results[0])
            write_results = sync.sync_target(pkg, manifests, check=False)
            self.assertTrue(write_results[0].startswith("ERROR: "), write_results)
            self.assertIn("not found", write_results[0])

    def test_nested_version_before_top_level_is_preserved(self):
        nested_first = '{\n  "meta": {"version": "9.9.9"},\n  "version": "1.0.0"\n}\n'
        with tempfile.TemporaryDirectory() as tmp:
            pkg, manifests = _make_package(Path(tmp), "2.0.0", {"plugin.json": nested_first})
            check_results = sync.sync_target(pkg, manifests, check=True)
            self.assertEqual(len(check_results), 1, check_results)
            self.assertIn("expected 2.0.0 found 1.0.0", check_results[0])
            sync.sync_target(pkg, manifests, check=False)
            manifest = json.loads((pkg / "plugin.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["version"], "2.0.0")
            self.assertEqual(manifest["meta"]["version"], "9.9.9")

    def test_duplicate_top_level_version_key_fails_in_check_and_write(self):
        # Last occurrence matches the package version, so a naive json.loads
        # would report OK; the synchronizer must reject the ambiguity instead.
        duplicate = '{\n  "version": "1.0.0",\n  "description": "test",\n  "version": "1.2.3"\n}\n'
        with tempfile.TemporaryDirectory() as tmp:
            pkg, manifests = _make_package(Path(tmp), "1.2.3", {"plugin.json": duplicate})
            for check in (True, False):
                results = sync.sync_target(pkg, manifests, check=check)
                self.assertEqual(len(results), 1, results)
                self.assertTrue(results[0].startswith("ERROR: "), results)
                self.assertIn("duplicate", results[0])

    def test_duplicate_top_level_version_key_never_writes(self):
        duplicate = '{\n  "version": "1.0.0",\n  "version": "1.0.0"\n}\n'
        with tempfile.TemporaryDirectory() as tmp:
            pkg, manifests = _make_package(Path(tmp), "2.0.0", {"plugin.json": duplicate})
            results = sync.sync_target(pkg, manifests, check=False)
            self.assertEqual(len(results), 1, results)
            self.assertTrue(results[0].startswith("ERROR: "), results)
            self.assertIn("duplicate", results[0])
            self.assertEqual((pkg / "plugin.json").read_text(encoding="utf-8"), duplicate)

    def test_read_manifest_version_rejects_duplicate_top_level_key(self):
        duplicate = '{\n  "version": "1.0.0",\n  "version": "1.2.3"\n}\n'
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "plugin.json"
            path.write_text(duplicate, encoding="utf-8")
            with self.assertRaises(ValueError):
                sync.read_manifest_version(path)

    def test_manifest_trailing_garbage_rejected_in_check_and_write(self):
        # raw_decode consumes only a prefix; the manifest version matches the
        # package version, so a naive reader would report OK and a naive writer
        # would rewrite the prefix. The walk must reject the trailing content
        # and leave the bytes untouched in write mode.
        trailing = '{"version": "1.2.3"} trailing\n'
        with tempfile.TemporaryDirectory() as tmp:
            pkg, manifests = _make_package(Path(tmp), "1.2.3", {"plugin.json": trailing})
            for check in (True, False):
                results = sync.sync_target(pkg, manifests, check=check)
                self.assertEqual(len(results), 1, results)
                self.assertTrue(results[0].startswith("ERROR: "), results)
                self.assertIn("trailing", results[0])
            self.assertEqual((pkg / "plugin.json").read_text(encoding="utf-8"), trailing)

    def test_duplicate_package_version_key_fails_in_check_and_write(self):
        # json.loads keeps the last occurrence, so a naive parse of this
        # package.json would succeed; the ambiguous source of truth must be
        # rejected in both modes instead.
        duplicate = (
            '{\n  "name": "fixture-pkg",\n  "version": "1.0.0",\n'
            '  "version": "1.2.3"\n}\n'
        )
        with tempfile.TemporaryDirectory() as tmp:
            pkg, manifests = _make_package(Path(tmp), None, {})
            (pkg / "package.json").write_text(duplicate, encoding="utf-8")
            for check in (True, False):
                results = sync.sync_target(pkg, manifests, check=check)
                self.assertEqual(len(results), 1, results)
                self.assertTrue(results[0].startswith("ERROR: "), results)
                self.assertIn("duplicate", results[0])

    def test_duplicate_package_version_key_never_writes(self):
        duplicate = '{\n  "version": "1.0.0",\n  "version": "1.2.3"\n}\n'
        manifest = '{\n  "version": "1.0.0"\n}\n'
        with tempfile.TemporaryDirectory() as tmp:
            pkg = Path(tmp) / "pkg"
            pkg.mkdir()
            (pkg / "package.json").write_text(duplicate, encoding="utf-8")
            (pkg / "plugin.json").write_text(manifest, encoding="utf-8")
            results = sync.sync_target(pkg, [Path("plugin.json")], check=False)
            self.assertEqual(len(results), 1, results)
            self.assertTrue(results[0].startswith("ERROR: "), results)
            self.assertIn("duplicate", results[0])
            self.assertEqual((pkg / "plugin.json").read_text(encoding="utf-8"), manifest)

    def test_json_write_preserves_manifest_formatting(self):
        original = '{\n  "name": "maestria",\n  "version": "0.1.0",\n  "description": "test"\n}\n'
        with tempfile.TemporaryDirectory() as tmp:
            pkg, manifests = _make_package(Path(tmp), "0.2.0", {"plugin.json": original})
            sync.sync_target(pkg, manifests, check=False)
            rewritten = (pkg / "plugin.json").read_text(encoding="utf-8")
            expected = (
                '{\n  "name": "maestria",\n  "version": "0.2.0",\n'
                '  "description": "test"\n}\n'
            )
            self.assertEqual(rewritten, expected)

    def test_hermes_py_and_yaml_manifests_sync(self):
        version_py = '"""Package version -- single source of truth."""\n__version__ = "0.1.12"\n'
        plugin_yaml = "name: maestria-hermes\nversion: 0.1.12\ndescription: test\n"
        with tempfile.TemporaryDirectory() as tmp:
            pkg, manifests = _make_package(
                Path(tmp),
                "0.1.13",
                {
                    "src/maestria_hermes/_version.py": version_py,
                    "plugin.yaml": plugin_yaml,
                },
            )
            results = sync.sync_target(pkg, manifests, check=False)
            self.assertEqual(len(results), 2, results)
            self.assertTrue(all(r.startswith("OK: synced ") for r in results), results)
            self.assertIn(
                '__version__ = "0.1.13"',
                (pkg / "src/maestria_hermes/_version.py").read_text(encoding="utf-8"),
            )
            self.assertIn("version: 0.1.13", (pkg / "plugin.yaml").read_text(encoding="utf-8"))


class MainWiringTests(unittest.TestCase):
    """Exit-code behavior of main() end-to-end against fixture targets."""

    def _run_main(self, pkg: Path, manifests: list[Path], *args: str) -> int:
        with patch.object(sync, "TARGETS", [(pkg, manifests)]):
            with patch("sys.argv", ["sync-plugin-versions.py", *args]):
                return sync.main()

    def test_check_in_sync_returns_zero(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg, manifests = _make_package(
                Path(tmp), "1.2.3", {"plugin.json": '{\n  "version": "1.2.3"\n}\n'}
            )
            self.assertEqual(self._run_main(pkg, manifests, "--check"), 0)

    def test_check_drift_returns_one(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg, manifests = _make_package(
                Path(tmp), "1.2.3", {"plugin.json": '{\n  "version": "1.2.2"\n}\n'}
            )
            self.assertEqual(self._run_main(pkg, manifests, "--check"), 1)

    def test_check_duplicate_version_key_returns_one(self):
        duplicate = '{\n  "version": "1.0.0",\n  "version": "1.2.3"\n}\n'
        with tempfile.TemporaryDirectory() as tmp:
            pkg, manifests = _make_package(Path(tmp), "1.2.3", {"plugin.json": duplicate})
            self.assertEqual(self._run_main(pkg, manifests, "--check"), 1)

    def test_check_missing_package_json_returns_one(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg = Path(tmp) / "pkg"
            pkg.mkdir()
            self.assertEqual(self._run_main(pkg, [], "--check"), 1)

    def test_check_missing_version_returns_one(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg, _ = _make_package(Path(tmp), None, {})
            self.assertEqual(self._run_main(pkg, [], "--check"), 1)

    def test_write_missing_package_json_returns_one(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg = Path(tmp) / "pkg"
            pkg.mkdir()
            self.assertEqual(self._run_main(pkg, []), 1)

    def test_write_missing_version_returns_one(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg, _ = _make_package(Path(tmp), None, {})
            self.assertEqual(self._run_main(pkg, []), 1)

    def test_write_mode_syncs_drift_and_returns_zero(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg, manifests = _make_package(
                Path(tmp), "1.2.3", {"plugin.json": '{\n  "version": "1.2.2"\n}\n'}
            )
            self.assertEqual(self._run_main(pkg, manifests), 0)
            manifest = json.loads((pkg / "plugin.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["version"], "1.2.3")


if __name__ == "__main__":
    unittest.main()
