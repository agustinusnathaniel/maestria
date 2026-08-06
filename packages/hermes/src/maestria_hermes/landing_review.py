"""Fail-closed landing review for Hermes direct execution.

Hermes exposes the review child through its public subagent lifecycle service.
This module deliberately does not infer trust from prompt text, role markers,
or a child's prose summary.  A landing approval requires a lifecycle-owned
handle, an immutable result hash, and a typed structured verdict.
"""

from __future__ import annotations

import dataclasses
import hashlib
import json
import logging
import math
import os
import re
import shlex
import subprocess
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Optional, Sequence

from maestria_hermes.modes import ModeManager
from maestria_hermes.session import get_role_for_session

logger = logging.getLogger(__name__)

_REVIEW_PROTOCOL = "hermes-landing-review/v1"
_REVIEW_TIMEOUT_SECONDS = 120.0
_PRIMARY_BRANCHES = {"main", "master", "trunk"}
_SHIPPING_TOOL_NAMES = {
    "bash",
    "code_execution",
    "command",
    "create_pr",
    "execute_code",
    "git_commit",
    "git_push",
    "gh_pr_create",
    "open_pr",
    "opencode_route",
    "process",
    "run",
    "shell",
    "terminal",
}
_SPECIALIZED_SHIPPING_TOOL_NAMES = {
    "create_pr",
    "git_commit",
    "git_push",
    "gh_pr_create",
    "open_pr",
}
_COMMAND_CHAIN = re.compile(r"(?:&&|\|\||[;|\n`])")
_SHIPPING_WORDS = re.compile(
    r"\b(?:git(?:\s+\S+){0,8}\s+(?:add|commit|push|merge|rebase|reset|clean|branch)|"
    r"gh\s+pr\s+(?:create|edit|merge|close|delete)|hub\s+pull-request|"
    r"glab\s+mr\s+(?:create|edit|merge|close|delete))\b"
)
_ACTIVE_REVIEW_CORRELATION: ContextVar[Optional[str]] = ContextVar(
    "maestria_active_review_correlation",
    default=None,
)


@dataclass
class LandingState:
    """The single review decision associated with one direct-session artifact."""

    artifact_digest: str
    status: str
    reviewer_subagent_id: Optional[str] = None
    reviewer_result_hash: Optional[str] = None
    reason: str = ""
    changed_paths: tuple[str, ...] = ()
    worktree_manifest: tuple[tuple[str, str], ...] = ()
    root_session_id: Optional[str] = None


def compute_artifact_manifest(
    changed_paths: Sequence[str],
) -> Optional[tuple[tuple[str, str], ...]]:
    """Return a deterministic manifest of the complete current worktree."""
    if not changed_paths:
        return None

    entries: list[tuple[str, str]] = []
    try:
        raw_paths = [Path(str(path)).resolve() for path in changed_paths]
        root = Path(os.path.commonpath([str(path.parent) for path in raw_paths]))
        search_root = root
        while search_root.parent != search_root and not (search_root / ".git").exists():
            search_root = search_root.parent
        if (search_root / ".git").exists():
            root = search_root

        paths = [path for path in root.rglob("*") if ".git" not in path.parts and path.is_file()]
        if not paths:
            paths = [path for path in raw_paths if path.exists()]
        for path in sorted(set(paths), key=lambda item: item.as_posix()):
            raw_path = path.relative_to(root).as_posix()
            if path.is_file():
                content_digest = hashlib.sha256(path.read_bytes()).hexdigest()
            elif path.exists():
                content_digest = hashlib.sha256(b"other").hexdigest()
            else:
                content_digest = hashlib.sha256(b"missing").hexdigest()
            entries.append((raw_path, content_digest))
    except (OSError, UnicodeError):
        return None
    return tuple(entries)


def compute_artifact_digest(changed_paths: Sequence[str]) -> Optional[str]:
    """Return a deterministic digest of the complete content manifest."""
    manifest = compute_artifact_manifest(changed_paths)
    if manifest is None:
        return None
    return hashlib.sha256(json.dumps(manifest, separators=(",", ":")).encode()).hexdigest()


def _stable_result_hash(result: Any) -> Optional[str]:
    """Recompute Hermes' public lifecycle result hash without private imports."""
    if not dataclasses.is_dataclass(result):
        return None
    try:
        payload = dataclasses.asdict(result)
        payload.pop("result_hash", None)
        return hashlib.sha256(
            json.dumps(payload, sort_keys=True, default=str).encode()
        ).hexdigest()
    except (TypeError, ValueError):
        return None


def _handle_is_trusted(handle: Any, session_id: str, correlation_id: str) -> bool:
    """Check only lifecycle-owned identity fields, never user-controlled text."""
    return (
        handle is not None
        and getattr(handle, "contract_version", None) == 1
        and isinstance(getattr(handle, "subagent_id", None), str)
        and bool(handle.subagent_id)
        and getattr(handle, "parent_session_id", None) == session_id
        and getattr(handle, "correlation_id", None) == correlation_id
        and getattr(handle, "role", None) == "leaf"
        and getattr(handle, "depth", None) == 1
        and isinstance(getattr(handle, "capability", None), str)
        and bool(handle.capability)
    )


@contextmanager
def bind_reviewer_lifecycle(correlation_id: str):
    """Bind the next native lifecycle construction to this plugin review."""
    token = _ACTIVE_REVIEW_CORRELATION.set(correlation_id)
    try:
        yield
    finally:
        _ACTIVE_REVIEW_CORRELATION.reset(token)


def claim_reviewer_lifecycle_start(
    child_session_id: Optional[str],
    child_subagent_id: Optional[str],
    child_role: Optional[str],
) -> bool:
    """Mark a native leaf child as reviewer only during our lifecycle launch."""
    correlation_id = _ACTIVE_REVIEW_CORRELATION.get()
    if not correlation_id or child_role != "leaf" or not child_session_id:
        return False
    from maestria_hermes.session import set_role_for_session

    set_role_for_session(child_session_id, "reviewer", child_subagent_id)
    return True


class LandingReviewManager:
    """Track one fail-closed reviewer transition per session and digest."""

    def __init__(self) -> None:
        self._states: dict[str, LandingState] = {}

    def state_for(self, session_id: str) -> Optional[LandingState]:
        return self._states.get(session_id)

    def review(
        self,
        session_id: str,
        changed_paths: Sequence[str],
        lifecycle: Any,
        requirements: str = "",
    ) -> LandingState:
        """Launch exactly one lifecycle child and validate its landing verdict."""
        digest = compute_artifact_digest(changed_paths)
        manifest = compute_artifact_manifest(changed_paths)
        if not session_id or digest is None:
            return self._reject(session_id, digest or "", "missing-artifact-digest", changed_paths)

        existing = self._states.get(session_id)
        if existing and existing.artifact_digest == digest:
            return existing

        correlation_id = f"maestria-landing:{session_id}:{digest}"
        state = LandingState(
            digest,
            "pending",
            changed_paths=tuple(sorted(map(str, changed_paths))),
            worktree_manifest=manifest or (),
            root_session_id=session_id,
        )
        self._states[session_id] = state

        try:
            from agent.subagent_lifecycle import SubagentLaunchRequest
        except ImportError:
            return self._reject(
                session_id,
                digest,
                "public-lifecycle-api-unavailable",
                changed_paths,
            )

        if lifecycle is None:
            return self._reject(
                session_id,
                digest,
                "public-lifecycle-service-unavailable",
                changed_paths,
            )

        context = (
            "Review the direct-session artifact for landing. You are the sole, "
            "read-only reviewer. Do not edit files, commit, push, create, merge, "
            "or approve a different artifact. Return a typed structured verdict "
            "through the Hermes lifecycle result API.\n"
            f"Artifact digest: {digest}\n"
            f"Changed paths: {json.dumps(sorted({str(path) for path in changed_paths}))}\n"
            f"Original requirements: {requirements or '[not supplied by Hermes pre_verify]'}"
        )
        try:
            with bind_reviewer_lifecycle(correlation_id):
                handle = lifecycle.launch(
                    SubagentLaunchRequest(
                        goal=(
                            "Perform the Hermes landing review and return exactly one "
                            "structured verdict for the supplied artifact."
                        ),
                        context=context,
                        role="leaf",
                        allowed_toolsets=("file",),
                        parent_session_id=session_id,
                        correlation_id=correlation_id,
                        metadata={"protocol": _REVIEW_PROTOCOL, "artifact_digest": digest},
                    )
                )
            terminal = lifecycle.wait(handle, timeout_seconds=_REVIEW_TIMEOUT_SECONDS)
            if not getattr(terminal, "completed", False) or getattr(
                terminal, "timed_out", False
            ):
                return self._reject(
                    session_id,
                    digest,
                    "reviewer-timeout-or-incomplete",
                    changed_paths,
                )
            result = lifecycle.result(handle)
        except Exception as exc:  # Hermes plugin hooks must not break the host.
            logger.warning("Landing reviewer failed closed: %s", exc)
            return self._reject(
                session_id,
                digest,
                "reviewer-launch-or-result-error",
                changed_paths,
            )

        return self._accept_result(
            session_id,
            digest,
            correlation_id,
            handle,
            result,
            changed_paths,
        )

    def _accept_result(
        self,
        session_id: str,
        digest: str,
        correlation_id: str,
        handle: Any,
        result: Any,
        changed_paths: Sequence[str],
    ) -> LandingState:
        """Accept only a current, lifecycle-authenticated typed approval."""
        result_handle = getattr(result, "handle", None)
        terminal_state = getattr(getattr(result, "terminal_state", None), "value", None)
        if terminal_state is None:
            terminal_state = getattr(result, "terminal_state", None)
        payload = getattr(result, "structured_payload", None)
        if (
            result_handle != handle
            or not _handle_is_trusted(handle, session_id, correlation_id)
            or terminal_state != "SUCCEEDED"
            or getattr(result, "ready", False) is not True
            or not isinstance(getattr(result, "result_hash", None), str)
            or getattr(result, "result_hash", None) != _stable_result_hash(result)
            or not _valid_result_timestamps(handle, result)
            or not isinstance(payload, Mapping)
            or set(payload) != {"protocol", "verdict", "artifact_digest"}
            or payload.get("protocol") != _REVIEW_PROTOCOL
            or payload.get("verdict") != "approved"
            or payload.get("artifact_digest") != digest
        ):
            return self._reject(
                session_id,
                digest,
                "malformed-rejected-stale-or-untrusted-verdict",
                changed_paths,
            )

        state = LandingState(
            digest,
            "approved",
            reviewer_subagent_id=handle.subagent_id,
            reviewer_result_hash=result.result_hash,
            changed_paths=tuple(sorted(map(str, changed_paths))),
            worktree_manifest=compute_artifact_manifest(changed_paths) or (),
            root_session_id=session_id,
        )
        self._states[session_id] = state
        return state

    def _reject(
        self,
        session_id: str,
        digest: str,
        reason: str,
        changed_paths: Sequence[str] = (),
    ) -> LandingState:
        state = LandingState(
            digest,
            "rejected",
            reason=reason,
            changed_paths=tuple(sorted(map(str, changed_paths))),
        )
        if session_id:
            self._states[session_id] = state
        return state

    def shipping_block(
        self,
        session_id: str,
        tool_name: str,
        args: Any,
        working_directory: Optional[str] = None,
    ) -> Optional[dict]:
        """Return a block directive for unsafe or unapproved shipping."""
        specialized, command = _structured_shipping_command(tool_name, args)
        if specialized and command is None:
            return _block(
                "Shipping is blocked because the specialized shipping payload is unsupported."
            )
        if not specialized:
            command = _command_text(tool_name, args)
        if command is None:
            return None
        if not _is_shipping_command(tool_name, command):
            return None

        state = self._states.get(session_id)
        if state is not None and (
            get_role_for_session(session_id) or state.root_session_id != session_id
        ):
            return _block("Shipping is blocked for all child sessions, including reviewers.")
        if state is None or state.status != "approved":
            return _block(
                "Shipping is blocked until one trusted Hermes reviewer approves this artifact."
            )
        if _COMMAND_CHAIN.search(command):
            return _block(
                "Shipping is blocked for compound commands; use one bounded operation at a time."
            )
        if _force_push(command) or _primary_branch_push(command):
            return _block("Force pushes and pushes to main/master are always blocked.")
        branch_directory = _git_working_directory(command, working_directory)
        if _requires_non_primary_branch(command) and (
            branch_directory is None or not _current_branch_is_non_primary(branch_directory)
        ):
            return _block(
                "Shipping is blocked because the current branch could not be verified "
                "as non-primary."
            )
        current_manifest = compute_artifact_manifest(state.changed_paths)
        if current_manifest is None or current_manifest != state.worktree_manifest:
            return _block("Shipping is blocked because the approved artifact digest is stale.")
        if not _bounded_shipping_command(tool_name, command):
            return _block(
                "Only bounded commit, feature-branch push, or PR-create operations may ship."
            )
        return None


def compute_artifact_digest_from_state(state: LandingState) -> Optional[str]:
    """Recompute the digest from the paths retained by the hook state."""
    # The path list is intentionally not accepted from the shipping tool call.
    # It is attached by the pre_verify hook below, preventing a caller from
    # narrowing the digest after approval.
    return compute_artifact_digest(state.changed_paths) if state.changed_paths else None


def _block(message: str) -> dict:
    return {"action": "block", "message": message}


def _valid_result_timestamps(handle: Any, result: Any) -> bool:
    """Reject fabricated or stale lifecycle snapshots with invalid ordering."""
    created_at = getattr(handle, "created_at", None)
    started_at = getattr(result, "started_at", None)
    completed_at = getattr(result, "completed_at", None)
    if not all(
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
        for value in (created_at, started_at, completed_at)
    ):
        return False
    return created_at <= started_at <= completed_at


def _command_text(tool_name: str, args: Any) -> Optional[str]:
    if tool_name not in _SHIPPING_TOOL_NAMES:
        return None
    if tool_name in _SPECIALIZED_SHIPPING_TOOL_NAMES:
        return None
    if isinstance(args, Mapping):
        command = args.get("command") or args.get("cmd") or args.get("script")
        if tool_name == "opencode_route":
            command = command or args.get("goal") or args.get("context")
    else:
        command = args
    return command if isinstance(command, str) else None


def _shell_quote(value: str) -> str:
    return shlex.quote(value)


def _structured_shipping_command(tool_name: str, args: Any) -> tuple[bool, Optional[str]]:
    """Classify native shipping payloads before considering shell fields.

    The boolean identifies a specialized shipping tool. A missing command for
    such a tool means its payload was unsupported, not that the call was safe.
    """
    if tool_name not in _SPECIALIZED_SHIPPING_TOOL_NAMES:
        return False, None
    if not isinstance(args, Mapping):
        return True, None

    if tool_name == "git_commit":
        allowed = {"message", "all", "amend", "no_verify", "no_gpg_sign"}
        if (
            set(args) - allowed
            or not isinstance(args.get("message"), str)
            or any(
                key in args and not isinstance(args[key], bool)
                for key in {"all", "amend", "no_verify", "no_gpg_sign"}
            )
        ):
            return True, None
        command = f"git commit -m {_shell_quote(args['message'])}"
        if args.get("all") is True:
            command += " --all"
        if args.get("amend") is True:
            command += " --amend"
        if args.get("no_verify") is True:
            command += " --no-verify"
        if args.get("no_gpg_sign") is True:
            command += " --no-gpg-sign"
        return True, command

    if tool_name == "git_push":
        allowed = {"remote", "branch", "set_upstream", "force", "force_with_lease", "delete"}
        if (
            set(args) - allowed
            or not isinstance(args.get("remote"), str)
            or not isinstance(args.get("branch"), str)
            or any(
                key in args and not isinstance(args[key], bool)
                for key in {"set_upstream", "force", "force_with_lease", "delete"}
            )
        ):
            return True, None
        command = f"git push {_shell_quote(args['remote'])} {_shell_quote(args['branch'])}"
        if args.get("set_upstream") is True:
            command = (
                f"git push --set-upstream {_shell_quote(args['remote'])} "
                f"{_shell_quote(args['branch'])}"
            )
        if args.get("force") is True:
            command += " --force"
        if args.get("force_with_lease") is True:
            command += " --force-with-lease"
        if args.get("delete") is True:
            command += " --delete"
        return True, command

    allowed = {"base", "head", "title", "body", "draft", "repo", "merge", "close", "delete"}
    string_fields = {"base", "head", "title", "body", "repo"}
    boolean_fields = {"draft", "merge", "close", "delete"}
    if (
        set(args) - allowed
        or any(key in args and not isinstance(args[key], str) for key in string_fields)
        or any(key in args and not isinstance(args[key], bool) for key in boolean_fields)
    ):
        return True, None
    command = "gh pr create --fill"
    for key, flag in (
        ("base", "--base"),
        ("head", "--head"),
        ("title", "--title"),
        ("body", "--body"),
        ("repo", "--repo"),
    ):
        if isinstance(args.get(key), str):
            command += f" {flag} {_shell_quote(args[key])}"
    if args.get("draft") is True:
        command += " --draft"
    if args.get("merge") is True:
        command = "gh pr merge"
    if args.get("close") is True:
        command = "gh pr close"
    if args.get("delete") is True:
        command = "gh pr delete"
    return True, command


def _is_shipping_command(tool_name: str, command: str) -> bool:
    normalized = command.strip().lower()
    return tool_name in {
        "create_pr",
        "git_commit",
        "git_push",
        "gh_pr_create",
        "open_pr",
    } or bool(_SHIPPING_WORDS.search(normalized))


def _tokens(command: str) -> list[str]:
    try:
        return shlex.split(command)
    except ValueError:
        return []


def _git_push_tokens(command: str) -> Optional[list[str]]:
    tokens = _tokens(command)
    for index, token in enumerate(tokens):
        if token != "git":
            continue
        cursor = index + 1
        while cursor < len(tokens) and tokens[cursor].startswith("-"):
            cursor += 2 if tokens[cursor] in {"-C", "-c", "--git-dir", "--work-tree"} else 1
        if cursor < len(tokens) and tokens[cursor] == "push":
            return tokens[cursor + 1 :]
    return None


def _force_push(command: str) -> bool:
    tokens = _git_push_tokens(command) or []
    return any(
        token == "-f" or token.startswith("-f") or token.startswith("--force")
        for token in tokens
    )


def _primary_branch_push(command: str) -> bool:
    tokens = _git_push_tokens(command)
    if tokens is None:
        return False
    refs = [token for token in tokens if not token.startswith("-")]
    return any(
        _primary_branch_ref(ref) or _head_ref(ref)
        for ref in refs
    )


def _head_ref(value: str) -> bool:
    normalized = value.lower()
    return normalized == "head" or bool(re.search(r"(?:^|[/=:])head(?:$|[/~^])", normalized))


def _explicit_non_primary_push(command: str) -> bool:
    tokens = _git_push_tokens(command)
    if tokens is None:
        return False
    refs = [token for token in tokens if not token.startswith("-")]
    if len(refs) != 2:
        return False
    ref_parts = refs[1].split(":")
    if len(ref_parts) > 2 or any(not ref for ref in ref_parts):
        return False
    return all(not _head_ref(ref) and not _primary_branch_ref(ref) for ref in ref_parts)


def _requires_non_primary_branch(command: str) -> bool:
    tokens = _tokens(command)
    if not tokens:
        return False
    for index, token in enumerate(tokens):
        if token != "git":
            continue
        cursor = index + 1
        while cursor < len(tokens):
            if tokens[cursor] in {"-C", "-c", "--git-dir", "--work-tree"}:
                cursor += 2
            elif tokens[cursor].startswith("-"):
                cursor += 1
            else:
                return tokens[cursor] in {"commit", "push"}
    return False


def _git_working_directory(
    command: str,
    working_directory: Optional[str],
) -> Optional[str]:
    tokens = _tokens(command)
    base_directory = os.path.abspath(working_directory or os.getcwd())
    for index, token in enumerate(tokens):
        if token != "git":
            continue
        cursor = index + 1
        directory = base_directory
        while cursor < len(tokens):
            option = tokens[cursor]
            if option == "-C":
                if cursor + 1 >= len(tokens):
                    return None
                path = tokens[cursor + 1]
                directory = os.path.abspath(os.path.join(directory, path))
                cursor += 2
            elif option in {"--git-dir", "--work-tree"}:
                return None
            elif option == "-c":
                cursor += 2
            elif option.startswith("-"):
                cursor += 1
            else:
                return directory
    return None


def _current_branch_is_non_primary(working_directory: Optional[str] = None) -> bool:
    try:
        result = subprocess.run(
            ["git", "branch", "--show-current"],
            cwd=working_directory,
            capture_output=True,
            check=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError, TypeError, ValueError):
        return False
    if not isinstance(result.stdout, str):
        return False
    branch = result.stdout.strip()
    return bool(branch) and not _head_ref(branch) and not _primary_branch_ref(branch)


def _bounded_shipping_command(tool_name: str, command: str) -> bool:
    tokens = _tokens(command)
    if not tokens:
        return False
    if tokens[0] == "git" and len(tokens) >= 2 and tokens[1] == "commit":
        return (
            len(tokens) >= 4
            and any(token in {"-m", "--message", "-F", "--file"} for token in tokens[2:])
            and not any(
                token == "--amend"
                or token.startswith("--no-verify")
                or token.startswith("--no-gpg-sign")
                for token in tokens[2:]
            )
        )
    if tokens[0] == "git" and len(tokens) >= 3 and tokens[1] == "add":
        return all(
            token in {"-A", "--all", "."} or not token.startswith("-")
            for token in tokens[2:]
        )
    push = _git_push_tokens(command)
    if push is not None:
        if (
            _force_push(command)
            or _primary_branch_push(command)
            or not _explicit_non_primary_push(command)
        ):
            return False
        return True
    if tokens[0] == "gh" and len(tokens) >= 3 and tokens[1] == "pr":
        if tokens[2] not in {"create", "edit"}:
            return False
        base = None
        head = None
        for index, token in enumerate(tokens[3:], start=3):
            if token in {"--repo", "--merge", "--close", "--delete"}:
                return False
            if token in {"--base", "--head"}:
                if index + 1 >= len(tokens):
                    return False
                if token == "--base":
                    base = tokens[index + 1]
                else:
                    head = tokens[index + 1]
            elif token.startswith("--base="):
                base = token[7:]
            elif token.startswith("--head="):
                head = token[7:]
        if tokens[2] == "edit":
            return base is None and head is None
        return bool(base and head and _primary_branch_ref(base) and not _primary_branch_ref(head))
    return False


def _primary_branch_ref(value: str) -> bool:
    normalized = value.lower()
    return bool(
        re.search(r"(?:^|[/=:])(?:main|master|trunk)(?:$|[/~^])", normalized)
    )


def create_pre_verify_hook(
    mode_manager: ModeManager,
    lifecycle: Any,
    landing_manager: LandingReviewManager,
):
    """Create Hermes' direct-route landing gate."""

    def pre_verify_hook(**kwargs: Any) -> Optional[dict]:
        session_id = str(kwargs.get("session_id") or kwargs.get("task_id") or "")
        mode = mode_manager.get_mode(session_id or None)
        if mode not in {None, "blitz"} or not kwargs.get("coding", False):
            return None
        changed_paths = kwargs.get("changed_paths") or []
        if not changed_paths:
            return None
        state = landing_manager.review(
            session_id,
            changed_paths,
            lifecycle,
            str(kwargs.get("requirements") or ""),
        )
        if state.status == "approved":
            return None
        return {
            "action": "continue",
            "message": (
                "Landing review did not produce a valid approval. Do not commit, "
                "push, create a PR, or otherwise ship this artifact."
            ),
        }

    return pre_verify_hook
