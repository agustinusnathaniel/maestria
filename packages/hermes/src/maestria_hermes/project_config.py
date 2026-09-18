"""Project-root customization loader for the maestria Hermes plugin.

Reads the user-approved project files ``.maestria/workflow.md`` (delegation
sequencing) and ``.maestria/rules.md`` (project rules) from the session
project root, in that deterministic order, and formats them as subordinate
model guidance for ``pre_llm_call`` injection.

Scope and trust notes:

- Root only: exactly the two relative paths under the resolved root are
  read. No ancestor search and no nested lookup apply.
- The root is the host-selected session working directory at call time
  (``os.getcwd()`` read fresh on every call, never cached). The pinned
  ``pre_llm_call`` payload (session_id, task_id, turn_id, user_message,
  conversation_history, is_first_turn, model, platform, parent_session_id,
  sender_id) carries no working-directory field, and concurrent gateway
  sessions share one process directory, so this is the closest supported
  root signal; CLI session resume retargets the process directory to the
  session's recorded dir before turns run.
- Project Markdown is subordinate guidance only: it may replace
  configurable workflows but never waives safety, authorization, or host
  permissions, and it never grants capability or executes. The trust and
  capability registry (session.py, permissions.py) is untouched.
- Fresh read every turn: contents are never cached, so additions, edits,
  and deletions take effect on the next call with no stale snapshot. Full
  file contents are used; nothing is truncated or summarized.
- Fail visible: a present-but-unusable file (directory, special file,
  unreadable, unresolvable link, a link escaping the root, or a link
  whose resolved target is not a regular file) raises
  ``ProjectConfigError`` naming only the relative path and the failure
  kind. File contents and absolute paths never appear in messages or logs.
  The ``pre_llm`` hook converts that failure into an injected STOP banner
  (report the error and wait for the file to be fixed) because the host
  runs ``pre_llm_call`` fail-open (per-callback exceptions are logged and
  skipped, and only ``{"context": ...}`` or string returns reach the
  model), so raising cannot prevent the turn and would only drop the mode
  context with it. The banner advises stopping, it does not enforce
  cancellation. Checks observe the filesystem at call time; they are not
  an atomic snapshot.
"""

from __future__ import annotations

import logging
import os
import stat
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

logger = logging.getLogger(__name__)

PROJECT_WORKFLOW_REL = ".maestria/workflow.md"
PROJECT_RULES_REL = ".maestria/rules.md"

# Deterministic load order: workflow sequencing first, then project rules,
# matching the canonical orchestrator guidance and the OpenCode projection.
PROJECT_CONFIG_REL_PATHS = (PROJECT_WORKFLOW_REL, PROJECT_RULES_REL)


class ProjectConfigError(Exception):
    """A project file is present but unusable (fail visible, fail loud)."""


@dataclass(frozen=True)
class ProjectSection:
    """One loaded project file: its content plus its root-relative path."""

    content: str
    rel: str


def get_project_root() -> str | None:
    """Return the session project root for this call, or None.

    The root is the host-selected session working directory read fresh on
    every call. An undeterminable directory is treated as absent (normal,
    unchanged behavior), never as an error naming paths.
    """
    try:
        cwd = os.getcwd()
    except OSError:
        logger.debug("maestria project root unavailable (cwd unreadable)")
        return None
    if not cwd:
        return None
    return cwd


def _entry_kind(candidate: str) -> str:
    """Classify *candidate* without following symlinks.

    Returns "missing", "file", "directory", or "other". A dangling symlink
    classifies as "file" here (lstat does not follow it); the strict
    resolution step then fails visibly. A stat failure other than a missing
    path raises ProjectConfigError without leaking the absolute path.
    """
    try:
        st = os.lstat(candidate)
    except FileNotFoundError:
        return "missing"
    except OSError as exc:
        raise ProjectConfigError(
            f'[maestria] Project config "{_rel_for(candidate)}" cannot be accessed'
        ) from exc
    mode = st.st_mode
    if stat.S_ISDIR(mode):
        return "directory"
    if stat.S_ISREG(mode) or stat.S_ISLNK(mode):
        return "file"
    return "other"


def _rel_for(candidate: str) -> str:
    """Recover the contract rel path for a joined candidate (suffix match)."""
    for rel in PROJECT_CONFIG_REL_PATHS:
        if candidate.endswith(os.sep + rel) or candidate.endswith(rel):
            return rel
    return os.path.basename(candidate)


def _resolve_link(candidate: str, rel: str) -> str:
    """Strictly resolve *candidate* (symlinks included) or raise visibly."""
    try:
        return str(Path(candidate).resolve(strict=True))
    except (OSError, RuntimeError) as exc:
        raise ProjectConfigError(
            f'[maestria] Project config "{rel}" cannot be resolved'
        ) from exc


def _escapes_root(root: str, resolved: str) -> bool:
    """Return True when *resolved* lies outside *root*."""
    relative = os.path.relpath(resolved, root)
    return (
        relative == os.pardir
        or relative.startswith(os.pardir + os.sep)
        or os.path.isabs(relative)
    )


def _read_text(candidate: str, rel: str) -> str:
    """Read *candidate* as UTF-8 text or raise visibly (never leak content)."""
    try:
        with open(candidate, encoding="utf-8") as handle:
            return handle.read()
    except (OSError, UnicodeDecodeError) as exc:
        raise ProjectConfigError(
            f'[maestria] Project config "{rel}" exists but cannot be read'
        ) from exc


def load_project_sections(
    root: str,
    *,
    kind_of: Callable[[str], str] = _entry_kind,
    read_file: Callable[[str, str], str] = _read_text,
    resolve_link: Callable[[str, str], str] = _resolve_link,
) -> list[ProjectSection]:
    """Load project customization sections for *root* in contract order.

    Missing files are normal and skipped; empty files carry no instructions
    and are skipped. Anything present but unusable raises
    ProjectConfigError naming only the relative path and the failure kind.
    The *kind_of*, *read_file*, and *resolve_link* seams exist for
    deterministic tests; production uses the real filesystem boundary.
    """
    if not isinstance(root, str) or not root:
        return []
    normalized_root = os.path.realpath(root)
    sections: list[ProjectSection] = []

    for rel in PROJECT_CONFIG_REL_PATHS:
        candidate = os.path.join(normalized_root, rel)
        try:
            kind = kind_of(candidate)
        except ProjectConfigError:
            raise
        except (OSError, RuntimeError) as exc:
            raise ProjectConfigError(
                f'[maestria] Project config "{rel}" cannot be accessed'
            ) from exc
        if kind == "missing":
            continue
        if kind == "directory":
            raise ProjectConfigError(
                f'[maestria] Project config "{rel}" is a directory, expected a file'
            )
        if kind != "file":
            raise ProjectConfigError(
                f'[maestria] Project config "{rel}" is not a regular file'
            )

        try:
            resolved = resolve_link(candidate, rel)
        except ProjectConfigError:
            raise
        except (OSError, RuntimeError) as exc:
            raise ProjectConfigError(
                f'[maestria] Project config "{rel}" cannot be resolved'
            ) from exc
        if _escapes_root(normalized_root, resolved):
            raise ProjectConfigError(
                f'[maestria] Project config "{rel}" resolves outside the project root'
            )
        # Validate the resolved target before reading: a symlink to a FIFO,
        # directory, or other special file must fail here rather than block
        # the event loop (FIFO open waits for a writer) or misread. The
        # resolved path contains no symlinks, so this observes the target.
        try:
            target_mode = os.stat(resolved).st_mode
        except OSError as exc:
            raise ProjectConfigError(
                f'[maestria] Project config "{rel}" cannot be accessed'
            ) from exc
        if stat.S_ISDIR(target_mode):
            raise ProjectConfigError(
                f'[maestria] Project config "{rel}" is a directory, expected a file'
            )
        if not stat.S_ISREG(target_mode):
            raise ProjectConfigError(
                f'[maestria] Project config "{rel}" is not a regular file'
            )
        try:
            content = read_file(candidate, rel)
        except ProjectConfigError:
            raise
        except (OSError, UnicodeDecodeError, RuntimeError) as exc:
            raise ProjectConfigError(
                f'[maestria] Project config "{rel}" exists but cannot be read'
            ) from exc
        if content != "":
            sections.append(ProjectSection(content=content, rel=rel))

    return sections


def format_project_section(section: ProjectSection) -> str:
    """Format one section for user-message injection.

    The header keeps the subordinate status visible at the point of use.
    The body is project-authored content, never executed.
    """
    return (
        f"Project customization from {section.rel} (subordinate guidance: "
        "it may replace configurable workflows but never waives safety, "
        "authorization, or host permissions):\n"
        f"{section.content}"
    )


def format_project_error(message: str) -> str:
    """Format a visible config-failure banner for user-message injection.

    *message* must already be limited to the relative path and failure
    kind (see ProjectConfigError); contents and absolute paths never appear.
    The banner advises STOP/report/wait: an unreadable file may shadow
    workflow guidance, so the turn must not proceed as if the guidance
    were absent. The hook cannot cancel the turn itself (the host runs
    ``pre_llm_call`` fail-open), so this advisory banner, not enforcement,
    is the loudest supported signal.
    """
    return (
        "[MAESTRIA PROJECT CONFIG ERROR] "
        f"{message}. STOP: do not run with potentially overridden "
        "configuration; report this error and wait for the file to be "
        "fixed. Project guidance never grants capability or executes."
    )


def build_project_context() -> str:
    """Load and format project context for this turn, or "" when absent.

    A present-but-unusable file returns a visible error banner instead of
    silently absent config. Never raises for filesystem state; unexpected
    failures are the caller's to contain (see pre_llm).
    """
    root = get_project_root()
    if root is None:
        return ""
    try:
        sections = load_project_sections(root)
    except ProjectConfigError as exc:
        logger.warning("maestria project customization unavailable: %s", exc)
        return format_project_error(str(exc))
    return "\n\n".join(format_project_section(section) for section in sections)
