"""Tests for project-root customization (.maestria/workflow.md, .maestria/rules.md).

Thin adapter suite: the full loader contract lives in
packages/shared/pi/tests/project-config.test.ts. This file pins the Hermes
shape: order, fail-open banners, UTF-8 decode, and trust.
"""

from __future__ import annotations

import os
import tempfile
import unittest
from unittest.mock import patch

from maestria_hermes import project_config
from maestria_hermes.hooks.pre_llm import create_pre_llm_hook
from maestria_hermes.modes import ModeManager
from maestria_hermes.project_config import (
    PROJECT_RULES_REL,
    PROJECT_WORKFLOW_REL,
    ProjectConfigError,
    ProjectSection,
    build_project_context,
    format_project_error,
    format_project_section,
    get_project_root,
    load_project_sections,
)
from maestria_hermes.session import UNKNOWN, get_trust_state


def _write(root: str, rel: str, content: str | bytes) -> str:
    full = os.path.join(root, *rel.split("/"))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    if isinstance(content, bytes):
        with open(full, "wb") as handle:
            handle.write(content)
    else:
        with open(full, "w", encoding="utf-8") as handle:
            handle.write(content)
    return full


class LoaderTests(unittest.TestCase):
    def test_order_skips_absent_and_empty(self):
        with tempfile.TemporaryDirectory() as root:
            self.assertEqual(load_project_sections(root), [])
            _write(root, PROJECT_RULES_REL, "# rules\n")
            _write(root, PROJECT_WORKFLOW_REL, "# workflow\n")
            self.assertEqual(
                load_project_sections(root),
                [
                    ProjectSection(content="# workflow\n", rel=PROJECT_WORKFLOW_REL),
                    ProjectSection(content="# rules\n", rel=PROJECT_RULES_REL),
                ],
            )
        with tempfile.TemporaryDirectory() as root:
            _write(root, PROJECT_WORKFLOW_REL, "")
            _write(root, PROJECT_RULES_REL, "# rules\n")
            self.assertEqual(
                load_project_sections(root),
                [ProjectSection(content="# rules\n", rel=PROJECT_RULES_REL)],
            )

    def test_present_but_unusable_fails_loud_with_rel_only(self):
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, ".maestria", "rules.md"))
            with self.assertRaises(ProjectConfigError) as ctx:
                load_project_sections(root)
            message = str(ctx.exception)
            self.assertIn(PROJECT_RULES_REL, message)
            self.assertIn("directory", message)
            self.assertNotIn(root, message)

        with self.assertRaises(ProjectConfigError) as ctx:
            load_project_sections(
                "/projects/acme", kind_of=lambda _candidate: "other"
            )
        message = str(ctx.exception)
        self.assertIn("not a regular file", message)
        self.assertNotIn("/projects/acme", message)

        sentinel = "sentinel-secret-content-9kqd"
        with tempfile.TemporaryDirectory() as root:
            _write(root, PROJECT_WORKFLOW_REL, sentinel)

            def _refuse(_candidate: str, _rel: str) -> str:
                raise OSError("EACCES: permission denied")

            with self.assertRaises(ProjectConfigError) as ctx:
                load_project_sections(
                    root,
                    kind_of=lambda _candidate: "file",
                    read_file=_refuse,
                    resolve_link=lambda candidate, _rel: candidate,
                )
            message = str(ctx.exception)
            self.assertIn("exists but cannot be read", message)
            self.assertNotIn(sentinel, message)
            self.assertNotIn(root, message)

        with tempfile.TemporaryDirectory() as root:
            _write(root, PROJECT_RULES_REL, b"\xff\xfe\x00binary")
            with self.assertRaises(ProjectConfigError) as ctx:
                load_project_sections(root)
            message = str(ctx.exception)
            self.assertIn("exists but cannot be read", message)
            self.assertNotIn(root, message)

    def test_symlink_escaping_root_fails_without_target_or_content(self):
        with tempfile.TemporaryDirectory() as root:
            with tempfile.TemporaryDirectory() as outside:
                target = _write(outside, "evil.md", "# evil\n")
                os.makedirs(os.path.join(root, ".maestria"), exist_ok=True)
                os.symlink(
                    target,
                    os.path.join(root, *PROJECT_RULES_REL.split("/")),
                )
                with self.assertRaises(ProjectConfigError) as ctx:
                    load_project_sections(root)
                message = str(ctx.exception)
                self.assertIn("outside the project root", message)
                self.assertNotIn(target, message)
                self.assertNotIn(outside, message)
                self.assertNotIn("# evil", message)

    def test_raw_seam_failures_redacted_no_paths_or_contents(self):
        root = "/projects/acme"
        sentinel = "sentinel-secret-content-9kqd"

        def _raw(what: str) -> OSError:
            return OSError(f"{what} {root}/.maestria/workflow.md: {sentinel}")

        def _boom(error: OSError):
            raise error

        table = [
            ({"kind_of": lambda _c: _boom(_raw("lstat"))}, "cannot be accessed"),
            (
                {"kind_of": lambda _c: "file", "resolve_link": lambda _c, _r: _boom(_raw("realpath"))},
                "cannot be resolved",
            ),
        ]
        for seams, pattern in table:
            with self.assertRaises(ProjectConfigError) as ctx:
                load_project_sections(root, **seams)
            message = str(ctx.exception)
            self.assertIn(pattern, message)
            self.assertNotIn(root, message)
            self.assertNotIn(sentinel, message)

    def test_format_and_banner(self):
        body = "# rules\n- Be careful\n"
        formatted = format_project_section(
            ProjectSection(content=body, rel=PROJECT_RULES_REL)
        )
        self.assertIn(PROJECT_RULES_REL, formatted)
        self.assertIn("subordinate", formatted)
        self.assertIn(body, formatted)
        banner = format_project_error('[maestria] Project config "x" cannot be read')
        self.assertIn("PROJECT CONFIG ERROR", banner)
        self.assertIn("STOP", banner)
        self.assertIn("never grants capability", banner)

    def test_get_project_root(self):
        previous = os.getcwd()
        with tempfile.TemporaryDirectory() as root:
            os.chdir(root)
            try:
                self.assertEqual(get_project_root(), root)
            finally:
                os.chdir(previous)
        self.assertEqual(get_project_root(), previous)
        with patch.object(project_config.os, "getcwd", side_effect=OSError("gone")):
            self.assertIsNone(get_project_root())
        self.assertEqual(build_project_context(), "")


class HookTests(unittest.TestCase):
    def make_hook(self, mode: str | None = "fein"):
        home = tempfile.TemporaryDirectory()
        self.addCleanup(home.cleanup)
        with patch.dict(os.environ, {"HERMES_HOME": home.name}, clear=False):
            manager = ModeManager()
            if mode is None:
                manager.clear_mode()
            else:
                manager.set_mode(mode)
            return create_pre_llm_hook(manager)

    def host_kwargs(self, **extra):
        """Host-style pre_llm_call payload (pinned fields, no working dir)."""
        payload = {
            "session_id": "proj-sess",
            "task_id": "task-1",
            "turn_id": "turn-1",
            "user_message": "do the thing",
            "conversation_history": [],
            "is_first_turn": False,
            "model": "test-model",
            "platform": "cli",
            "parent_session_id": "",
            "sender_id": "",
        }
        payload.update(extra)
        return payload

    def test_absent_files_leave_mode_context_unchanged(self):
        hook = self.make_hook("fein")
        with tempfile.TemporaryDirectory() as root:
            with patch.object(
                project_config, "get_project_root", return_value=root
            ):
                result = hook(**self.host_kwargs())
        self.assertIn("context", result)
        self.assertIn("fein", result["context"])
        self.assertNotIn(".maestria/", result["context"])
        self.assertEqual(get_trust_state("proj-sess"), UNKNOWN)
        neutral = self.make_hook(None)
        with tempfile.TemporaryDirectory() as root:
            with patch.object(
                project_config, "get_project_root", return_value=root
            ):
                self.assertEqual(neutral(**self.host_kwargs()), {"context": ""})

    def test_both_sections_appended_after_mode_in_order(self):
        hook = self.make_hook("sonar")
        with tempfile.TemporaryDirectory() as root:
            _write(root, PROJECT_RULES_REL, "# rules\n")
            _write(root, PROJECT_WORKFLOW_REL, "# workflow\n")
            with patch.object(
                project_config, "get_project_root", return_value=root
            ):
                result = hook(**self.host_kwargs())
        context = result["context"]
        self.assertLess(context.index("sonar"), context.index(PROJECT_WORKFLOW_REL))
        self.assertLess(
            context.index(PROJECT_WORKFLOW_REL), context.index(PROJECT_RULES_REL)
        )
        self.assertIn("# workflow", context)
        self.assertIn("# rules", context)
        self.assertIn("subordinate", context)

    def test_broken_file_surfaced_as_banner(self):
        hook = self.make_hook("fein")
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, ".maestria", "rules.md"))
            with patch.object(
                project_config, "get_project_root", return_value=root
            ):
                result = hook(**self.host_kwargs())
        context = result["context"]
        self.assertIn("PROJECT CONFIG ERROR", context)
        self.assertIn(PROJECT_RULES_REL, context)
        self.assertNotIn(root, context)
        self.assertIn("fein", context)
        self.assertEqual(get_trust_state("proj-sess"), UNKNOWN)

    def test_unexpected_loader_failure_contained_with_generic_banner(self):
        hook = self.make_hook("blitz")
        with patch.object(
            project_config,
            "build_project_context",
            side_effect=RuntimeError("boom"),
        ):
            result = hook(**self.host_kwargs())
        context = result["context"]
        self.assertIn("PROJECT CONFIG ERROR", context)
        self.assertIn("blitz", context)
        self.assertNotIn("boom", context)

    def test_hook_never_creates_trust(self):
        hook = self.make_hook("fein")
        with tempfile.TemporaryDirectory() as root:
            _write(root, PROJECT_WORKFLOW_REL, "# workflow\n")
            with patch.object(
                project_config, "get_project_root", return_value=root
            ):
                hook(**self.host_kwargs(session_id="fresh-sess"))
        self.assertEqual(get_trust_state("fresh-sess"), UNKNOWN)


if __name__ == "__main__":
    unittest.main()
