"""Tests for project-root customization (.maestria/workflow.md, .maestria/rules.md).

Contract under test (mirrors the OpenCode projection cross-platform):

- Root only: the two relative paths under the session working directory,
  in deterministic workflow-then-rules order. No ancestor or nested lookup.
- Absent files leave behavior unchanged; empty files carry no instructions.
- Fresh read every turn: additions, edits, and deletions take effect on
  the next call with no stale snapshot and no duplication.
- Present-but-unusable files (directory, special file, unreadable,
  unresolvable link, link escaping the root) fail visibly: the loader
  raises ProjectConfigError and the pre_llm hook injects an error banner
  instead of running with silently absent config. Diagnostics name only
  the relative path and the failure kind, never contents or absolute paths.
- The hook never raises (the host runs pre_llm_call fail-open, so a raise
  would drop the mode context without preventing the turn) and never
  touches the trust registry: project Markdown is subordinate guidance,
  never a capability grant.

Unreadability uses a deterministic injected seam (a read_file callable
that raises), never chmod assumptions, which root ignores.
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
    def test_absent_files_load_nothing(self):
        with tempfile.TemporaryDirectory() as root:
            self.assertEqual(load_project_sections(root), [])

    def test_single_present_file_loads_alone(self):
        with tempfile.TemporaryDirectory() as root:
            _write(root, PROJECT_RULES_REL, "# rules\n")
            self.assertEqual(
                load_project_sections(root),
                [ProjectSection(content="# rules\n", rel=PROJECT_RULES_REL)],
            )

    def test_workflow_then_rules_order_regardless_of_creation_order(self):
        with tempfile.TemporaryDirectory() as root:
            _write(root, PROJECT_RULES_REL, "# rules\n")
            _write(root, PROJECT_WORKFLOW_REL, "# workflow\n")
            self.assertEqual(
                load_project_sections(root),
                [
                    ProjectSection(content="# workflow\n", rel=PROJECT_WORKFLOW_REL),
                    ProjectSection(content="# rules\n", rel=PROJECT_RULES_REL),
                ],
            )

    def test_empty_files_carry_no_instructions(self):
        with tempfile.TemporaryDirectory() as root:
            _write(root, PROJECT_WORKFLOW_REL, "")
            _write(root, PROJECT_RULES_REL, "# rules\n")
            self.assertEqual(
                load_project_sections(root),
                [ProjectSection(content="# rules\n", rel=PROJECT_RULES_REL)],
            )

    def test_add_edit_delete_visible_on_next_call_no_snapshot(self):
        with tempfile.TemporaryDirectory() as root:
            self.assertEqual(load_project_sections(root), [])
            _write(root, PROJECT_WORKFLOW_REL, "# v1\n")
            self.assertEqual(len(load_project_sections(root)), 1)
            _write(root, PROJECT_WORKFLOW_REL, "# v2\n")
            self.assertEqual(
                load_project_sections(root),
                [ProjectSection(content="# v2\n", rel=PROJECT_WORKFLOW_REL)],
            )
            os.remove(os.path.join(root, *PROJECT_WORKFLOW_REL.split("/")))
            self.assertEqual(load_project_sections(root), [])

    def test_no_ancestor_lookup(self):
        with tempfile.TemporaryDirectory() as root:
            _write(root, PROJECT_WORKFLOW_REL, "# parent workflow\n")
            child = os.path.join(root, "child")
            os.makedirs(child)
            self.assertEqual(load_project_sections(child), [])

    def test_no_nested_lookup(self):
        with tempfile.TemporaryDirectory() as root:
            _write(root, ".maestria/nested/workflow.md", "# nested\n")
            self.assertEqual(load_project_sections(root), [])

    def test_directory_fails_visibly_without_paths_or_contents(self):
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, ".maestria", "rules.md"))
            with self.assertRaises(ProjectConfigError) as ctx:
                load_project_sections(root)
            message = str(ctx.exception)
            self.assertIn(PROJECT_RULES_REL, message)
            self.assertIn("directory", message)
            self.assertNotIn(root, message)

    def test_special_file_fails_visibly(self):
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, ".maestria"), exist_ok=True)
            os.mkfifo(os.path.join(root, *PROJECT_WORKFLOW_REL.split("/")))
            with self.assertRaises(ProjectConfigError) as ctx:
                load_project_sections(root)
            message = str(ctx.exception)
            self.assertIn(PROJECT_WORKFLOW_REL, message)
            self.assertIn("not a regular file", message)
            self.assertNotIn(root, message)

    def test_unreadable_file_fails_visibly_via_deterministic_seam(self):
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

    def test_non_utf8_file_fails_visibly(self):
        with tempfile.TemporaryDirectory() as root:
            _write(root, PROJECT_RULES_REL, b"\xff\xfe\x00binary")
            with self.assertRaises(ProjectConfigError) as ctx:
                load_project_sections(root)
            message = str(ctx.exception)
            self.assertIn("exists but cannot be read", message)
            self.assertNotIn(root, message)

    def test_dangling_symlink_fails_visibly(self):
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, ".maestria"), exist_ok=True)
            os.symlink(
                os.path.join(root, "does-not-exist.md"),
                os.path.join(root, *PROJECT_WORKFLOW_REL.split("/")),
            )
            with self.assertRaises(ProjectConfigError) as ctx:
                load_project_sections(root)
            message = str(ctx.exception)
            self.assertIn("cannot be resolved", message)
            self.assertNotIn(root, message)

    def test_symlink_escaping_root_fails_visibly(self):
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

    def test_symlink_inside_root_is_accepted(self):
        with tempfile.TemporaryDirectory() as root:
            _write(root, ".maestria/shared.md", "# linked\n")
            os.symlink(
                os.path.join(root, ".maestria", "shared.md"),
                os.path.join(root, *PROJECT_WORKFLOW_REL.split("/")),
            )
            self.assertEqual(
                load_project_sections(root),
                [ProjectSection(content="# linked\n", rel=PROJECT_WORKFLOW_REL)],
            )

    def test_symlinked_root_still_loads_inside_files(self):
        with tempfile.TemporaryDirectory() as parent:
            root = os.path.join(parent, "real")
            os.makedirs(root)
            _write(root, PROJECT_WORKFLOW_REL, "# workflow\n")
            link = os.path.join(parent, "aliased")
            os.symlink(root, link)
            self.assertEqual(
                load_project_sections(link),
                [ProjectSection(content="# workflow\n", rel=PROJECT_WORKFLOW_REL)],
            )

    def test_symlink_to_directory_inside_root_fails_visibly(self):
        with tempfile.TemporaryDirectory() as root:
            target = os.path.join(root, ".maestria", "target-dir")
            os.makedirs(target)
            os.symlink(
                target,
                os.path.join(root, *PROJECT_WORKFLOW_REL.split("/")),
            )
            with self.assertRaises(ProjectConfigError) as ctx:
                load_project_sections(root)
            message = str(ctx.exception)
            self.assertIn(PROJECT_WORKFLOW_REL, message)
            self.assertIn("directory", message)
            self.assertNotIn(root, message)

    def test_symlink_to_fifo_inside_root_fails_without_blocking(self):
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, ".maestria"), exist_ok=True)
            fifo = os.path.join(root, ".maestria", "pipe")
            os.mkfifo(fifo)
            os.symlink(
                fifo,
                os.path.join(root, *PROJECT_WORKFLOW_REL.split("/")),
            )
            with self.assertRaises(ProjectConfigError) as ctx:
                load_project_sections(root)
            message = str(ctx.exception)
            self.assertIn(PROJECT_WORKFLOW_REL, message)
            self.assertIn("not a regular file", message)
            self.assertNotIn(root, message)

    def test_format_names_rel_and_marks_subordinate(self):
        body = "# rules\n- Be careful\n"
        formatted = format_project_section(
            ProjectSection(content=body, rel=PROJECT_RULES_REL)
        )
        self.assertIn(PROJECT_RULES_REL, formatted)
        self.assertIn("subordinate", formatted)
        self.assertIn(body, formatted)

    def test_error_banner_carries_message_without_granting_status(self):
        banner = format_project_error('[maestria] Project config "x" cannot be read')
        self.assertIn("PROJECT CONFIG ERROR", banner)
        self.assertIn("STOP", banner)
        self.assertIn("report", banner)
        self.assertIn("wait", banner)
        self.assertNotIn("Running without", banner)
        self.assertIn("never grants capability", banner)

    def test_get_project_root_reads_host_cwd_fresh(self):
        previous = os.getcwd()
        with tempfile.TemporaryDirectory() as root:
            os.chdir(root)
            try:
                self.assertEqual(get_project_root(), root)
            finally:
                os.chdir(previous)
        self.assertEqual(get_project_root(), previous)

    def test_get_project_root_unavailable_is_absent_not_error(self):
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

    def test_neutral_mode_and_absent_files_return_empty_context(self):
        hook = self.make_hook(None)
        with tempfile.TemporaryDirectory() as root:
            with patch.object(
                project_config, "get_project_root", return_value=root
            ):
                self.assertEqual(hook(**self.host_kwargs()), {"context": ""})

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

    def test_edits_visible_next_turn_without_duplication(self):
        hook = self.make_hook("fein")
        with tempfile.TemporaryDirectory() as root:
            with patch.object(
                project_config, "get_project_root", return_value=root
            ):
                _write(root, PROJECT_WORKFLOW_REL, "# v1\n")
                first = hook(**self.host_kwargs())["context"]
                self.assertIn("# v1", first)
                _write(root, PROJECT_WORKFLOW_REL, "# v2\n")
                second = hook(**self.host_kwargs())["context"]
                self.assertIn("# v2", second)
                self.assertNotIn("# v1", second)
                self.assertEqual(second.count(PROJECT_WORKFLOW_REL), 1)
                os.remove(os.path.join(root, *PROJECT_WORKFLOW_REL.split("/")))
                third = hook(**self.host_kwargs())["context"]
                self.assertNotIn(".maestria/", third)

    def test_broken_file_surfaced_as_banner_mode_preserved_no_raise(self):
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

    def test_escaping_link_surfaced_without_target_or_content(self):
        hook = self.make_hook("fein")
        with tempfile.TemporaryDirectory() as root:
            with tempfile.TemporaryDirectory() as outside:
                target = _write(outside, "evil.md", "# evil\n")
                os.makedirs(os.path.join(root, ".maestria"), exist_ok=True)
                os.symlink(
                    target,
                    os.path.join(root, *PROJECT_RULES_REL.split("/")),
                )
                with patch.object(
                    project_config, "get_project_root", return_value=root
                ):
                    result = hook(**self.host_kwargs())
        context = result["context"]
        self.assertIn("PROJECT CONFIG ERROR", context)
        self.assertIn("outside the project root", context)
        self.assertNotIn(target, context)
        self.assertNotIn("# evil", context)

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
