"""Tests for the Hermes lifecycle trust-state machine and tool policy.

Covers the approved conservative child trust policy (ADR-HM-002):

- Native Hermes child roles are ``leaf``/``orchestrator`` topology signals
  only; they never map to Maestria specialist identities and never grant a
  delegated child write/shell/code/delegation/OpenCode capability.  Roles
  match exactly - case variants and malformed role strings fail closed.
- Trust states: top-level (direct), trusted child (role-neutral
  read/research/LLM-only policy), invalid child (deny all), ended (deny
  all), unknown (deny all).
- A trusted child gets the SAME fixed CHILD_SAFE_ALLOWED_TOOLS policy in
  every mode (fein, sonar, blitz); mode allowlists bound only trusted
  top-level sessions.
- Top-level trust from on_session_start requires an exact recognized
  native platform value (explicit allowlist); unknown, whitespace-padded,
  case-variant, and malformed platforms fail closed.
- on_session_start is first-turn only and preserves active child state;
  on_session_end is per-turn and preserves resumable trust;
  on_session_finalize / reset / subagent_stop are terminal boundaries.
- Child state always outranks any task_id == session_id binding.
- Malformed tool names, invalid modes, and missing/unknown identifiers
  fail closed without raising.
- Tool names are never normalized: padded names such as ``" write "`` are
  rejected, never stripped before the allowlist lookup.
- Session identifiers are validated strictly: non-empty strings with no
  whitespace anywhere (leading, trailing, or internal - ASCII and Unicode
  Zs alike), no Unicode control/format/separator characters (Cc/Cf/Zl/Zp
  - incl. the C1 range U+0080-U+009F and zero-width characters), and not
  the "unknown" sentinel.  Whitespace/control/malformed ids never key the
  registry and never grant trust.
- Terminal lifecycle (on_session_finalize / on_session_reset /
  subagent_stop) is event-scoped when the payload carries a usable native
  session id.  on_session_reset is scoped to the explicit old_session_id
  on the gateway path; on the CLI path (which carries only the NEW session
  id after rotation) it is scoped to the manager's tracked old-session
  identity for that agent instance, so an unrelated concurrent session is
  never revoked.  A terminal event that cannot be scoped (malformed or
  missing id) revokes ALL active trust (revoke_all_trust): every trusted
  session is marked ENDED and must be re-established by a fresh trusted
  lifecycle event.  No session is ever left trusted after an unscoped
  terminal event.
- The trust registry has a HARD deterministic cap: its size never exceeds
  it.  A new admission first evicts the oldest ended/invalid tombstone
  entries to make room; when the registry is at capacity with active
  trust only, the admission fails closed (the id stays UNKNOWN, which
  denies all tools).  Active/trusted entries are never evicted, and the
  most recently ended ids keep their ENDED reuse protection (an evicted
  id becomes UNKNOWN, which still denies all tools).  A repeated
  end/invalid terminal transition REFRESHES the tombstone's FIFO
  position, re-arming its reuse protection so a re-ended id is never the
  next eviction victim (revoke_all_trust rebuilds every position the
  same way).
- Role provenance: Hermes normalizes the caller's requested role
  (strip + lowercase, unknown values coerce to "leaf") BEFORE invoking
  subagent_start, so Maestria sees only the effective native topology
  role and validates it exactly.  Requested "builder"/padded/"LEAF"
  inputs arrive as effective "leaf" (and orchestrator variants as
  "orchestrator") and receive the SAME fixed role-neutral child policy;
  Maestria does not reject the original requested strings - they never
  reach it raw.  The normalization contract is exercised against Hermes'
  real delegate_tool._normalize_role when the install tree is
  importable, with a verified replica otherwise.
- Tool names are validated the same way: Unicode control/format/separator
  characters and padded names block without raising, and are never
  normalized before the allowlist lookup.
- register() exposes the plugin's hook inventory; plugin.yaml's
  provides_hooks must match what register() actually registers.
- Full trust-state x mode x tool matrix: TOP_LEVEL, TRUSTED_CHILD,
  INVALID_CHILD, ENDED, and UNKNOWN across fein/sonar/blitz.
"""

from __future__ import annotations

import os
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

from maestria_hermes import _on_subagent_start, _on_subagent_stop
from maestria_hermes.hooks.pre_tool import create_pre_tool_hook
from maestria_hermes.modes import VALID_MODES, ModeManager
from maestria_hermes.permissions import (
    BLITZ_DIRECT_ALLOWED_TOOLS,
    CHILD_SAFE_ALLOWED_TOOLS,
    NATIVE_CHILD_ROLES,
    SONAR_ALLOWED_TOOLS,
    TOOL_CATEGORIES,
)
from maestria_hermes.session import (
    _TRUST_REGISTRY_CAP,
    ENDED,
    INVALID_CHILD,
    RECOGNIZED_TOP_LEVEL_PLATFORMS,
    TOP_LEVEL,
    TRUSTED_CHILD,
    UNKNOWN,
    SessionManager,
    _session_trust,
    _tombstones,
    clear_trust,
    contains_unicode_control,
    create_session_hooks,
    end_trust,
    get_child_topology_role,
    get_trust_state,
    is_valid_lifecycle_id,
    mark_invalid_child,
    mark_top_level,
    mark_trusted_child,
    revoke_all_trust,
)

# Tools that must NEVER be available to a delegated child, in any mode.
# "create" is a mutator in TOOL_CATEGORIES["write"], so it is forbidden
# like every other write-family tool.
_CHILD_FORBIDDEN_TOOLS = (
    "write",
    "write_file",
    "edit",
    "edit_file",
    "patch",
    "create",
    "delete",
    "delete_file",
    "rename",
    "rename_file",
    "mkdir",
    "make_directory",
    "move",
    "copy",
    "bash",
    "terminal",
    "shell",
    "run",
    "process",
    "command",
    "code_execution",
    "execute_code",
    "python_repl",
    "jupyter",
    "notebook",
    "delegate_task",
    "opencode",
    "opencode_route",
    "browser_navigate",
    "browser_click",
    "browser_screenshot",
    "browser_evaluate",
)


def _hermes_agent_root() -> str:
    """Locate the Hermes install tree for the real-normalization probe.

    Honors HERMES_AGENT_ROOT when set (CI can point it at a checkout);
    otherwise falls back to the default install tree
    (~/.hermes/hermes-agent).  Returns "" when neither exists.
    """
    root = os.environ.get("HERMES_AGENT_ROOT", "")
    if root:
        return root
    default = os.path.join(pathlib.Path.home(), ".hermes", "hermes-agent")
    return default if os.path.isdir(default) else ""


def _replica_hermes_normalize_role(requested_role):
    """Replica of Hermes delegate_tool._normalize_role.

    Verified against the install tree (~/.hermes/hermes-agent): strip +
    lowercase, unknown/empty/None values coerce to "leaf".  Hermes runs
    this on the caller's requested role BEFORE invoking subagent_start, so
    the effective role is the only value Maestria ever sees.
    """
    if requested_role is None or not requested_role:
        return "leaf"
    normalized = str(requested_role).strip().lower()
    if normalized in {"leaf", "orchestrator"}:
        return normalized
    return "leaf"


def _real_hermes_normalize_role():
    """Return Hermes' real delegate_tool._normalize_role when importable.

    Importing the real module can fail in a bare test environment (it
    needs the Hermes runtime's third-party dependencies, e.g. PyYAML), so
    this returns None when the install tree is absent or not importable;
    callers then use the documented replica, which is verified against the
    real function whenever it IS importable (see
    RoleProvenanceIntegrationTests).
    """
    root = _hermes_agent_root()
    if not root:
        return None
    try:
        sys.path.append(root)
        from tools.delegate_tool import _normalize_role

        return _normalize_role
    except Exception:
        return None


def _effective_native_role(requested_role):
    """Return the effective native role Hermes passes to subagent_start.

    Uses Hermes' real delegate_tool._normalize_role when its install tree
    is importable, otherwise the documented replica.  Both implement the
    same normalization contract, so the delegation-path tests assert the
    same behavior either way.
    """
    real = _real_hermes_normalize_role()
    if real is not None:
        return real(requested_role)
    return _replica_hermes_normalize_role(requested_role)


class HookTestBase(unittest.TestCase):
    def make_hook(self, mode: str):
        home = tempfile.TemporaryDirectory()
        self.addCleanup(home.cleanup)
        with patch.dict(os.environ, {"HERMES_HOME": home.name}, clear=False):
            manager = ModeManager()
            manager.set_mode(mode)
            return create_pre_tool_hook(manager)

    def cleanup_trust(self, *session_ids: object) -> None:
        for sid in session_ids:
            self.addCleanup(clear_trust, sid)

    def start_child(self, session_id: object, role: object = "leaf") -> None:
        """Register a delegated child via the real subagent_start handler."""
        _on_subagent_start(child_session_id=session_id, child_role=role)
        self.cleanup_trust(session_id)


class TrustStateMachineTests(HookTestBase):
    def test_native_child_roles_are_leaf_and_orchestrator_only(self):
        self.assertEqual(NATIVE_CHILD_ROLES, frozenset({"leaf", "orchestrator"}))
        # Maestria specialist names are NOT native child roles.
        for specialist in ("builder", "adventurer", "reviewer"):
            self.assertNotIn(specialist, NATIVE_CHILD_ROLES)

    def test_trust_states_are_distinct(self):
        self.assertEqual(
            {TOP_LEVEL, TRUSTED_CHILD, INVALID_CHILD, ENDED, UNKNOWN},
            {"top_level", "trusted_child", "invalid_child", "ended", "unknown"},
        )

    def test_unknown_state_fails_closed(self):
        self.assertEqual(get_trust_state("never-seen"), UNKNOWN)
        self.assertEqual(get_trust_state(""), UNKNOWN)
        self.assertEqual(get_trust_state(None), UNKNOWN)
        self.assertEqual(get_trust_state(7), UNKNOWN)
        self.assertEqual(get_trust_state("unknown"), UNKNOWN)

    def test_mark_top_level_then_end_then_reestablish(self):
        mark_top_level("sess-a")
        self.cleanup_trust("sess-a")
        self.assertEqual(get_trust_state("sess-a"), TOP_LEVEL)
        end_trust("sess-a")
        self.assertEqual(get_trust_state("sess-a"), ENDED)
        # A fresh trusted lifecycle event re-establishes trust.
        mark_top_level("sess-a")
        self.assertEqual(get_trust_state("sess-a"), TOP_LEVEL)

    def test_child_claim_invalidates_top_level(self):
        mark_top_level("reuse-id")
        self.cleanup_trust("reuse-id")
        self.assertTrue(mark_trusted_child("reuse-id", "leaf"))
        self.assertEqual(get_trust_state("reuse-id"), TRUSTED_CHILD)
        self.assertFalse(is_valid_lifecycle_id("") or False)

    def test_invalid_child_claim_invalidates_top_level(self):
        mark_top_level("reuse-id2")
        self.cleanup_trust("reuse-id2")
        self.assertFalse(mark_trusted_child("reuse-id2", "builder"))
        self.assertEqual(get_trust_state("reuse-id2"), INVALID_CHILD)

    def test_child_topology_role_is_stored_only_for_trusted_children(self):
        mark_trusted_child("child-leaf", "leaf")
        self.cleanup_trust("child-leaf")
        self.assertEqual(get_child_topology_role("child-leaf"), "leaf")
        mark_trusted_child("child-orch", "orchestrator")
        self.cleanup_trust("child-orch")
        self.assertEqual(get_child_topology_role("child-orch"), "orchestrator")
        mark_top_level("top")
        self.cleanup_trust("top")
        self.assertEqual(get_child_topology_role("top"), "")
        self.assertEqual(get_child_topology_role("unknown-sess"), "")

    def test_ended_state_has_no_topology(self):
        mark_trusted_child("ending-child", "leaf")
        end_trust("ending-child")
        self.cleanup_trust("ending-child")
        self.assertEqual(get_trust_state("ending-child"), ENDED)
        self.assertEqual(get_child_topology_role("ending-child"), "")


class NativeIdentifierTests(HookTestBase):
    """Strict native session identifier validation.

    A usable identifier is a non-empty string with no whitespace anywhere
    (leading, trailing, or internal - ASCII and Unicode Zs alike), no
    control characters, and not the "unknown" sentinel.
    Whitespace/control/malformed ids never key the registry and never
    grant trust; valid native ids (timestamp+uuid format, uuid strings,
    and other compact ids from Hermes call sites) are accepted without
    over-restriction.
    """

    def test_valid_native_ids_are_accepted(self):
        for session_id in (
            "20260810_143025_a1b2c3",          # CLI/gateway session format
            "20260810_143025_1a2b3c",
            "550e8400-e29b-41d4-a716-446655440000",  # task/uuid ids
            "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",      # hex-only uuid
            "session-123",
            "_hermes_fts_health_probe_12345",  # native probe ids
            "user_1:thread_42",
        ):
            with self.subTest(session_id=session_id):
                self.assertTrue(is_valid_lifecycle_id(session_id))

    def test_malformed_ids_are_rejected(self):
        for session_id in (
            None, 7, 0.5, [], {}, ("id",), b"id", object(),
            "", " ", "\t", "\n", "\r\n",
            "unknown",
            " id", "id ", "  id  ",
            "id\t", "\tid", "id\n", "\nid", "id\r",
            "unknown ", " unknown", "\tunknown", "unknown\n",
            "id\x00", "id\x01", "id\x1f", "id\x7f",
            "  unknown  ",
        ):
            with self.subTest(session_id=repr(session_id)):
                self.assertFalse(is_valid_lifecycle_id(session_id))

    def test_unicode_control_and_format_ids_are_rejected(self):
        """Unicode controls and format characters never pass the strict
        native identifier check: C1 controls (U+0080-U+009F), zero-width
        and bidi format characters, and line/paragraph separators are all
        rejected - not only ASCII controls/DEL."""
        for session_id in (
            "id\u0080",            # C1 control range start
            "id\u009f",            # C1 control range end
            "id\u0085",            # NEL (Cc)
            "\u0080id",
            "id\u200b",            # zero-width space (Cf)
            "\u200bid",            # zero-width space leading
            "id\u200c",            # zero-width non-joiner (Cf)
            "id\u200d",            # zero-width joiner (Cf)
            "id\u200e",            # left-to-right mark (Cf)
            "id\u2028",            # line separator (Zl)
            "id\u2029",            # paragraph separator (Zp)
            "re\u200bad",          # zero-width space mid-token
        ):
            with self.subTest(session_id=repr(session_id)):
                self.assertFalse(is_valid_lifecycle_id(session_id))

    def test_internal_whitespace_ids_are_rejected(self):
        """Internal whitespace anywhere in a lifecycle id is rejected:
        spaces, tabs, and non-breaking spaces (Zs) cannot appear inside a
        native id - an id is a single compact token."""
        for session_id in (
            "session id",          # finding example: internal space
            "ses sion",
            "session\tid",         # internal tab
            "session\u00a0id",     # non-breaking space (Zs)
            "session\u2003id",     # em space (Zs)
            "2026 0810_143025_a1b2c3",
            "user_1 :thread_42",
        ):
            with self.subTest(session_id=repr(session_id)):
                self.assertFalse(is_valid_lifecycle_id(session_id))
                # It never keys the registry and never grants trust.
                mark_top_level(session_id)
                self.cleanup_trust(session_id)
                self.assertEqual(get_trust_state(session_id), UNKNOWN)

    def test_unicode_control_ids_never_key_the_registry(self):
        """A Unicode-control id is a different (unusable) key than any
        ASCII form: marking it never trusts anything, and lookups never
        resolve to it."""
        for bad in (
            "zws\u200bid", "ctl\u0080id", "ctl\u009fid",
            "sep\u2028id", "nel\u0085id",
        ):
            with self.subTest(session_id=repr(bad)):
                mark_top_level(bad)
                self.cleanup_trust(bad)
                self.assertEqual(get_trust_state(bad), UNKNOWN)

    def test_contains_unicode_control_helper(self):
        self.assertTrue(contains_unicode_control("a\u200bb"))
        self.assertTrue(contains_unicode_control("\u0080"))
        self.assertTrue(contains_unicode_control("\u009f"))
        self.assertTrue(contains_unicode_control("\u2028"))
        self.assertTrue(contains_unicode_control("\u2029"))
        self.assertFalse(contains_unicode_control("read"))
        self.assertFalse(contains_unicode_control("20260810_143025_a1b2c3"))
        self.assertFalse(contains_unicode_control("user_1:thread_42"))
        # Regular spaces and non-breaking space are NOT controls; they are
        # handled by the surrounding whitespace policy instead.
        self.assertFalse(contains_unicode_control("a b"))
        self.assertFalse(contains_unicode_control("a\u00a0b"))

    def test_whitespace_padded_ids_never_key_the_registry(self):
        """A padded id is a different (unusable) key than its stripped
        form: marking the padded id never trusts the real id, and vice
        versa - no normalization happens anywhere in the registry."""
        mark_top_level("  padded  ")
        self.cleanup_trust("  padded  ")
        self.assertEqual(get_trust_state("padded"), UNKNOWN)
        self.assertEqual(get_trust_state("  padded  "), UNKNOWN)

        mark_top_level("real-id")
        self.cleanup_trust("real-id")
        self.assertEqual(get_trust_state("real-id"), TOP_LEVEL)
        # A whitespace-padded variant of a trusted id must NOT resolve.
        for variant in (" real-id", "real-id ", " real-id ", "real-id\n", "\treal-id"):
            with self.subTest(variant=repr(variant)):
                self.assertEqual(get_trust_state(variant), UNKNOWN)

    def test_control_character_ids_never_key_the_registry(self):
        mark_top_level("ctl\x00id")
        self.cleanup_trust("ctl\x00id")
        self.assertEqual(get_trust_state("ctl\x00id"), UNKNOWN)
        self.assertEqual(get_trust_state("ctl\x1fid"), UNKNOWN)
        self.assertEqual(get_trust_state("ctl\x7fid"), UNKNOWN)

    def test_ended_and_cleared_ignore_malformed_ids(self):
        mark_top_level("victim")
        self.cleanup_trust("victim")
        end_trust("  victim  ")  # malformed: must not touch "victim"
        self.assertEqual(get_trust_state("victim"), TOP_LEVEL)
        end_trust("victim")
        self.assertEqual(get_trust_state("victim"), ENDED)
        clear_trust(" victim ")  # malformed: must not clear "victim"
        self.assertEqual(get_trust_state("victim"), ENDED)

    def test_binding_requires_valid_ids(self):
        """A whitespace/control-padded session or task id never binds,
        even when the raw values are equal."""
        hook = self.make_hook("fein")
        for session_id, task_id in (
            ("  real  ", "  real  "),
            ("real ", "real "),
            ("\treal", "\treal"),
            ("real\x00", "real\x00"),
            ("unknown", "unknown"),
            ("", ""),
            (None, None),
        ):
            with self.subTest(session_id=session_id, task_id=task_id):
                self.assertEqual(
                    hook(tool_name="read", session_id=session_id, task_id=task_id)["action"],
                    "block",
                )


class TopLevelLifecycleTests(HookTestBase):
    def test_on_session_start_first_turn_marks_top_level(self):
        manager = SessionManager()
        on_start, _, _, _ = create_session_hooks(manager)
        on_start(session_id="cli-sess", platform="cli")
        self.cleanup_trust("cli-sess")
        self.assertEqual(get_trust_state("cli-sess"), TOP_LEVEL)

    def test_on_session_start_recognized_platforms_matrix(self):
        """Every recognized native platform value marks the session TOP_LEVEL
        (explicit allowlist verified from Hermes call sites/config)."""
        manager = SessionManager()
        on_start, _, _, _ = create_session_hooks(manager)
        for platform in RECOGNIZED_TOP_LEVEL_PLATFORMS:
            with self.subTest(platform=platform):
                sid = f"plat-{platform}"
                on_start(session_id=sid, platform=platform)
                self.cleanup_trust(sid)
                self.assertEqual(get_trust_state(sid), TOP_LEVEL)

    def test_on_session_start_child_platform_never_marks_top_level(self):
        manager = SessionManager()
        on_start, _, _, _ = create_session_hooks(manager)
        for session_id, platform in (
            ("child-one", "subagent"),
            ("child-two", ""),
            ("child-three", None),
            ("child-four", "unknown"),
        ):
            with self.subTest(session_id=session_id, platform=platform):
                on_start(session_id=session_id, platform=platform)
                self.cleanup_trust(session_id)
                self.assertEqual(get_trust_state(session_id), UNKNOWN)

    def test_on_session_start_unknown_whitespace_malformed_platforms_fail_closed(self):
        """Unknown, whitespace-padded, case-variant, and malformed platform
        values never grant top-level trust: exact allowlist membership only."""
        manager = SessionManager()
        on_start, _, _, _ = create_session_hooks(manager)
        untrusted_platforms = (
            "  cli  ",
            "cli ",
            " cli",
            "CLI",
            "Cli",
            "cli\n",
            "\tcli",
            "telegram ",
            "GATEWAY",
            "Gateway",
            "subagent",
            " Subagent ",
            "unknown",
            "unknown ",
            "not-a-platform",
            "totally-made-up",
            "administrator",
            "builder",
            "irc ",
            "",
            " ",
            "\t",
            "\n",
            "unknown-platform",
            "LEAF",
        )
        for i, platform in enumerate(untrusted_platforms):
            with self.subTest(platform=repr(platform)):
                sid = f"bad-plat-{i}"
                on_start(session_id=sid, platform=platform)
                self.cleanup_trust(sid)
                self.assertEqual(get_trust_state(sid), UNKNOWN)
        for i, platform in enumerate((7, 0.5, [], {}, ("cli",), b"cli", object())):
            with self.subTest(platform=repr(platform)):
                sid = f"bad-plat-type-{i}"
                on_start(session_id=sid, platform=platform)
                self.cleanup_trust(sid)
                self.assertEqual(get_trust_state(sid), UNKNOWN)

    def test_on_session_start_malformed_ids_never_trust(self):
        manager = SessionManager()
        on_start, _, _, _ = create_session_hooks(manager)
        for session_id in (
            None, "", 7, "unknown",
            "  ", "\t", "\n",
            "sess ", " sess", "sess\n", "\tsess", "sess\t",
            "sess\x00", "sess\x1f", "sess\x7f",
        ):
            with self.subTest(session_id=session_id):
                on_start(session_id=session_id, platform="cli")
                self.assertEqual(get_trust_state(session_id), UNKNOWN)
                self.assertFalse(is_valid_lifecycle_id(session_id))

    def test_top_level_multi_turn_resumable_trust(self):
        """on_session_end fires per turn; trust survives so the next turn
        keeps working (resumable, not terminal)."""
        manager = SessionManager()
        on_start, on_end, _, _ = create_session_hooks(manager)
        on_start(session_id="multi-turn", platform="cli")
        self.cleanup_trust("multi-turn")
        hook = self.make_hook("fein")

        # Turn 1.
        self.assertIsNone(hook(tool_name="write", session_id="multi-turn"))
        on_end(session_id="multi-turn", task_id="task-1")
        # State preserved across the per-turn end.
        self.assertEqual(get_trust_state("multi-turn"), TOP_LEVEL)

        # Turn 2 (resumed): still trusted top-level.
        self.assertIsNone(hook(tool_name="write", session_id="multi-turn"))
        on_end(session_id="multi-turn", task_id="task-2")
        self.assertEqual(get_trust_state("multi-turn"), TOP_LEVEL)

    def test_top_level_task_id_equals_session_id_binding(self):
        """An UNKNOWN session whose host bound task_id == session_id (CLI
        and gateway top-level turn paths) is trusted top-level."""
        hook = self.make_hook("fein")
        session_id = "bound-sess"
        self.assertIsNone(hook(tool_name="write", session_id=session_id, task_id=session_id))
        self.assertEqual(get_trust_state(session_id), UNKNOWN)  # no registry entry

    def test_top_level_malformed_task_binding_never_trusts(self):
        hook = self.make_hook("fein")
        for session_id, task_id in (
            (7, 7),
            (None, None),
            ("", ""),
            ("unknown", "unknown"),
            (7, "7"),
            (None, ""),
            ("sess", ""),
            ("", "sess"),
            ("sess", "other"),
        ):
            with self.subTest(session_id=session_id, task_id=task_id):
                self.assertEqual(
                    hook(tool_name="read", session_id=session_id, task_id=task_id)["action"],
                    "block",
                )

    def test_task_binding_does_not_override_ended_state(self):
        """An explicitly ended session never regains direct access from a
        coincidental task_id == session_id binding."""
        manager = SessionManager()
        on_start, _, on_finalize, _ = create_session_hooks(manager)
        on_start(session_id="ended-sess", platform="cli")
        on_finalize(session_id="ended-sess", reason="new_session")
        self.cleanup_trust("ended-sess")
        self.assertEqual(get_trust_state("ended-sess"), ENDED)

        hook = self.make_hook("fein")
        result = hook(tool_name="write", session_id="ended-sess", task_id="ended-sess")
        self.assertEqual(result["action"], "block")

    def test_top_level_fein_direct_access(self):
        hook = self.make_hook("fein")
        session_id = "direct-fein"
        mark_top_level(session_id)
        self.cleanup_trust(session_id)
        for tool_name in ("write", "bash", "delegate_task", "opencode_route", "code_execution"):
            with self.subTest(tool_name=tool_name):
                self.assertIsNone(hook(tool_name=tool_name, session_id=session_id))

    def test_top_level_sonar_read_only_allowlist(self):
        hook = self.make_hook("sonar")
        session_id = "sonar-top"
        mark_top_level(session_id)
        self.cleanup_trust(session_id)
        for tool_name in SONAR_ALLOWED_TOOLS:
            with self.subTest(tool_name=tool_name):
                self.assertIsNone(hook(tool_name=tool_name, session_id=session_id))
        for tool_name in ("write", "bash", "complete", "think", "opencode_route"):
            with self.subTest(tool_name=tool_name):
                self.assertEqual(
                    hook(tool_name=tool_name, session_id=session_id)["action"], "block"
                )

    def test_top_level_blitz_direct_allowlist(self):
        hook = self.make_hook("blitz")
        session_id = "blitz-top"
        mark_top_level(session_id)
        self.cleanup_trust(session_id)
        for tool_name in BLITZ_DIRECT_ALLOWED_TOOLS:
            with self.subTest(tool_name=tool_name):
                self.assertIsNone(hook(tool_name=tool_name, session_id=session_id))
        for tool_name in ("write", "bash", "code_execution", "delegate_task", "opencode_route"):
            with self.subTest(tool_name=tool_name):
                self.assertEqual(
                    hook(tool_name=tool_name, session_id=session_id)["action"], "block"
                )

    def test_untrusted_sessions_deny_all_modes_including_reads(self):
        """No lifecycle evidence, no task binding: fail closed in every
        mode, including sonar reads."""
        for mode in ("fein", "sonar", "blitz"):
            with self.subTest(mode=mode):
                hook = self.make_hook(mode)
                for tool_name in ("read", "glob", "grep", "webfetch", "write"):
                    with self.subTest(tool_name=tool_name):
                        result = hook(
                            tool_name=tool_name,
                            session_id=f"unknown-{mode}",
                            task_id="sa-0-random",
                        )
                        self.assertEqual(result["action"], "block")


class ChildLifecycleTests(HookTestBase):
    def test_leaf_child_fein_is_read_research_llm_only(self):
        hook = self.make_hook("fein")
        self.start_child("child-leaf", "leaf")
        for tool_name in CHILD_SAFE_ALLOWED_TOOLS:
            with self.subTest(tool_name=tool_name):
                self.assertIsNone(hook(tool_name=tool_name, session_id="child-leaf"))
        for tool_name in _CHILD_FORBIDDEN_TOOLS:
            with self.subTest(tool_name=tool_name):
                result = hook(tool_name=tool_name, session_id="child-leaf")
                self.assertEqual(result["action"], "block")

    def test_orchestrator_child_is_role_neutral(self):
        """leaf and orchestrator children get the exact same policy."""
        hook = self.make_hook("fein")
        self.start_child("child-orch", "orchestrator")
        for tool_name in (
            "write", "edit", "bash", "delegate_task", "opencode_route", "code_execution",
        ):
            with self.subTest(tool_name=tool_name):
                self.assertEqual(
                    hook(tool_name=tool_name, session_id="child-orch")["action"], "block"
                )
        self.assertIsNone(hook(tool_name="read", session_id="child-orch"))
        self.assertIsNone(hook(tool_name="complete", session_id="child-orch"))

    def test_child_never_has_write_or_code_in_any_mode(self):
        for mode in ("fein", "sonar", "blitz"):
            with self.subTest(mode=mode):
                hook = self.make_hook(mode)
                self.start_child(f"child-{mode}", "leaf")
                for tool_name in (
                    "write", "edit", "bash", "code_execution",
                    "delegate_task", "opencode_route",
                ):
                    with self.subTest(tool_name=tool_name):
                        self.assertEqual(
                            hook(tool_name=tool_name, session_id=f"child-{mode}")["action"],
                            "block",
                        )

    def test_child_sonar_mode_uses_child_safe_policy_not_sonar_allowlist(self):
        """A child in sonar mode is held to CHILD_SAFE_ALLOWED_TOOLS, not the
        narrower top-level sonar allowlist: LLM reasoning tools remain
        available to the child while write/shell/code/delegation stay blocked."""
        hook = self.make_hook("sonar")
        self.start_child("sonar-child", "leaf")
        for tool_name in CHILD_SAFE_ALLOWED_TOOLS:
            with self.subTest(tool_name=tool_name):
                self.assertIsNone(hook(tool_name=tool_name, session_id="sonar-child"))
        # LLM tools are child-safe even though they are NOT in the top-level
        # sonar allowlist.
        for tool_name in ("complete", "complete_structured", "think", "reason"):
            with self.subTest(tool_name=tool_name):
                self.assertIsNone(hook(tool_name=tool_name, session_id="sonar-child"))
        for tool_name in _CHILD_FORBIDDEN_TOOLS:
            with self.subTest(tool_name=tool_name):
                self.assertEqual(
                    hook(tool_name=tool_name, session_id="sonar-child")["action"], "block"
                )

    def test_child_blitz_mode_uses_child_safe_policy(self):
        """A child in blitz mode gets the same fixed child-safe policy."""
        hook = self.make_hook("blitz")
        self.start_child("blitz-child", "leaf")
        for tool_name in CHILD_SAFE_ALLOWED_TOOLS:
            with self.subTest(tool_name=tool_name):
                self.assertIsNone(hook(tool_name=tool_name, session_id="blitz-child"))
        for tool_name in _CHILD_FORBIDDEN_TOOLS:
            with self.subTest(tool_name=tool_name):
                self.assertEqual(
                    hook(tool_name=tool_name, session_id="blitz-child")["action"], "block"
                )

    def test_child_policy_mode_matrix_all_tools(self):
        """Every allowed and every forbidden child tool across every mode:
        the child policy is identical in fein, sonar, and blitz."""
        for mode in ("fein", "sonar", "blitz"):
            with self.subTest(mode=mode):
                hook = self.make_hook(mode)
                self.start_child(f"matrix-child-{mode}", "leaf")
                sid = f"matrix-child-{mode}"
                for tool_name in sorted(CHILD_SAFE_ALLOWED_TOOLS):
                    with self.subTest(mode=mode, tool_name=tool_name, expect="allow"):
                        self.assertIsNone(hook(tool_name=tool_name, session_id=sid))
                for tool_name in sorted(_CHILD_FORBIDDEN_TOOLS):
                    with self.subTest(mode=mode, tool_name=tool_name, expect="block"):
                        self.assertEqual(
                            hook(tool_name=tool_name, session_id=sid)["action"], "block"
                        )

    def test_child_start_before_child_session_start_is_preserved(self):
        """subagent_start fires before the child's own first turn; the
        child's on_session_start (platform='subagent') must NOT overwrite
        the active child trust."""
        manager = SessionManager()
        on_start, _, _, _ = create_session_hooks(manager)
        self.start_child("child-before-start", "leaf")

        # The child's own first-turn lifecycle event arrives afterwards.
        on_start(session_id="child-before-start", platform="subagent")
        self.assertEqual(get_trust_state("child-before-start"), TRUSTED_CHILD)

        hook = self.make_hook("fein")
        self.assertIsNone(hook(tool_name="read", session_id="child-before-start"))
        self.assertEqual(
            hook(tool_name="write", session_id="child-before-start")["action"], "block"
        )

    def test_child_state_outranks_task_session_binding(self):
        """Even when task_id == session_id (a top-level turn binding), a
        session with child trust is governed by the child policy, never
        direct access."""
        hook = self.make_hook("fein")
        self.start_child("child-bound", "leaf")
        # task_id == session_id would trust a top-level session, but child
        # state takes precedence: no write access.
        self.assertEqual(
            hook(tool_name="write", session_id="child-bound", task_id="child-bound")["action"],
            "block",
        )
        self.assertIsNone(hook(tool_name="read", session_id="child-bound", task_id="child-bound"))

    def test_invalid_child_state_outranks_task_session_binding(self):
        hook = self.make_hook("fein")
        self.start_child("invalid-bound", "builder")  # not a native role
        self.assertEqual(get_trust_state("invalid-bound"), INVALID_CHILD)
        for tool_name in ("read", "write", "bash"):
            with self.subTest(tool_name=tool_name):
                self.assertEqual(
                    hook(
                        tool_name=tool_name,
                        session_id="invalid-bound",
                        task_id="invalid-bound",
                    )["action"],
                    "block",
                )

    def test_unknown_native_role_fails_closed(self):
        """The exact-match child-role contract fails closed on non-native
        values.

        These raw values (specialist names, padded or empty roles,
        non-strings) exercise the API's exact-match validation in
        isolation: Maestria never normalizes a role and never lets a
        non-exact value grant child trust.  This is NOT a claim about the
        real Hermes path - Hermes normalizes the caller's requested role
        to "leaf"/"orchestrator" BEFORE subagent_start (see
        RoleProvenanceIntegrationTests), so these strings never reach
        Maestria raw in production.  They stand for any malformed or
        hostile direct call to the handler.
        """
        for i, role in enumerate((
            "builder", "adventurer", "administrator", "unknown", "",
            None, 7, " leaf ", "leaf ", " leaf",
        )):
            with self.subTest(role=role):
                # Index-derived sid: never embed the role string, whose
                # whitespace/control characters would make the sid itself
                # an unusable identifier.
                sid = f"bad-role-{i}"
                self.start_child(sid, role)
                self.assertEqual(get_trust_state(sid), INVALID_CHILD)
                hook = self.make_hook("fein")
                self.assertEqual(hook(tool_name="read", session_id=sid)["action"], "block")
                self.assertEqual(hook(tool_name="write", session_id=sid)["action"], "block")

    def test_native_role_case_variants_fail_closed(self):
        """Native roles match exactly: case variants never grant child trust
        when passed directly to the handler.

        Hermes only ever passes lowercase 'leaf'/'orchestrator' - it
        normalizes the caller's requested role (strip + lowercase) before
        subagent_start, so case variants never arrive raw in production
        (see RoleProvenanceIntegrationTests).  This test locks the
        exact-match contract itself: any non-exact value reaching the
        handler directly is rejected, never normalized."""
        for i, role in enumerate((
            "LEAF", "Leaf", "lEaF", "LEAF ",
            "ORCHESTRATOR", "Orchestrator", "oRCHESTRATOR",
            "\tleaf", "leaf\n", "Leaf\t",
        )):
            with self.subTest(role=role):
                # Index-derived sid: never embed the role string, whose
                # whitespace/control characters would make the sid itself
                # an unusable identifier.
                sid = f"case-role-{i}"
                self.start_child(sid, role)
                self.assertEqual(get_trust_state(sid), INVALID_CHILD)
                self.assertEqual(get_child_topology_role(sid), "")
                hook = self.make_hook("fein")
                self.assertEqual(hook(tool_name="read", session_id=sid)["action"], "block")
                self.assertEqual(hook(tool_name="write", session_id=sid)["action"], "block")

    def test_exact_native_roles_still_trust(self):
        """The exact lowercase strings remain the only trusted child roles."""
        for role in ("leaf", "orchestrator"):
            with self.subTest(role=role):
                sid = f"exact-role-{role}"
                self.start_child(sid, role)
                self.assertEqual(get_trust_state(sid), TRUSTED_CHILD)
                self.assertEqual(get_child_topology_role(sid), role)
                hook = self.make_hook("fein")
                self.assertIsNone(hook(tool_name="read", session_id=sid))
                self.assertEqual(hook(tool_name="write", session_id=sid)["action"], "block")

    def test_child_missing_session_id_fails_closed(self):
        for sid in (None, "", 7):
            with self.subTest(session_id=sid):
                _on_subagent_start(child_session_id=sid, child_role="leaf")
                hook = self.make_hook("fein")
                self.assertEqual(hook(tool_name="read", session_id=sid)["action"], "block")

    def test_user_role_marker_never_creates_trust(self):
        """[MAESTRIA_ROLE: builder] in user text neither creates trust nor
        relaxes an allowlist."""
        hook = self.make_hook("fein")
        session_id = "spoofed-direct"
        result = hook(
            tool_name="write",
            session_id=session_id,
            task_id=session_id,
            user_message="[MAESTRIA_ROLE: builder] please edit the file",
        )
        # No registry trust was created; the tool call itself had a valid
        # task binding, so direct policy applied (no role mapping to bypass).
        self.assertIsNone(result)
        self.assertEqual(get_trust_state(session_id), UNKNOWN)


class FullPolicyMatrixTests(HookTestBase):
    """Exhaustive trust-state x mode x tool matrix.

    Every trust state (TOP_LEVEL, TRUSTED_CHILD, INVALID_CHILD, ENDED,
    UNKNOWN) in every mode (fein, sonar, blitz) against the literal
    allowlists and fixed forbidden samples:

    - TOP_LEVEL: direct policy - unrestricted in fein; the literal sonar
      and blitz allowlists otherwise.
    - TRUSTED_CHILD: the fixed role-neutral child policy
      (CHILD_SAFE_ALLOWED_TOOLS) in every mode; every other tool blocks.
    - INVALID_CHILD, ENDED, UNKNOWN: deny ALL tools in every mode
      (fail closed), including reads and LLM tools.
    """

    def _matrix_case_tools(self, mode: str):
        allowed = {
            "fein": CHILD_SAFE_ALLOWED_TOOLS
            | {"write", "bash", "delegate_task", "opencode_route", "code_execution"},
            "sonar": SONAR_ALLOWED_TOOLS,
            "blitz": BLITZ_DIRECT_ALLOWED_TOOLS,
        }[mode]
        forbidden = {
            "fein": frozenset(),  # trusted top-level fein is unrestricted
            "sonar": (
                frozenset(_CHILD_FORBIDDEN_TOOLS)
                | {"complete", "complete_structured", "think", "reason"}
            ),
            "blitz": frozenset(_CHILD_FORBIDDEN_TOOLS),
        }[mode]
        return allowed, forbidden

    def test_full_trust_state_mode_tool_matrix(self):
        modes = ("fein", "sonar", "blitz")
        hooks = {m: self.make_hook(m) for m in modes}
        deny_all_tools = ("read", "write", "bash", "complete", "webfetch", "delegate_task")

        for mode in modes:
            # -- TOP_LEVEL --------------------------------------------------
            top_sid = f"matrix-top-{mode}"
            mark_top_level(top_sid)
            self.cleanup_trust(top_sid)
            allowed, forbidden = self._matrix_case_tools(mode)
            for tool_name in sorted(allowed):
                with self.subTest(
                    state="top_level", mode=mode, tool_name=tool_name, expect="allow"
                ):
                    self.assertIsNone(hooks[mode](tool_name=tool_name, session_id=top_sid))
            for tool_name in sorted(forbidden):
                with self.subTest(
                    state="top_level", mode=mode, tool_name=tool_name, expect="block"
                ):
                    self.assertEqual(
                        hooks[mode](tool_name=tool_name, session_id=top_sid)["action"],
                        "block",
                    )

            # -- TRUSTED_CHILD ----------------------------------------------
            child_sid = f"matrix-child-{mode}"
            self.start_child(child_sid, "leaf")
            for tool_name in sorted(CHILD_SAFE_ALLOWED_TOOLS):
                with self.subTest(
                    state="trusted_child", mode=mode, tool_name=tool_name, expect="allow"
                ):
                    self.assertIsNone(hooks[mode](tool_name=tool_name, session_id=child_sid))
            for tool_name in sorted(_CHILD_FORBIDDEN_TOOLS):
                with self.subTest(
                    state="trusted_child", mode=mode, tool_name=tool_name, expect="block"
                ):
                    self.assertEqual(
                        hooks[mode](tool_name=tool_name, session_id=child_sid)["action"],
                        "block",
                    )

            # -- INVALID_CHILD / ENDED / UNKNOWN (deny all) -----------------
            invalid_sid = f"matrix-invalid-{mode}"
            self.start_child(invalid_sid, "builder")  # not a native role
            self.assertEqual(get_trust_state(invalid_sid), INVALID_CHILD)
            ended_sid = f"matrix-ended-{mode}"
            mark_top_level(ended_sid)
            self.cleanup_trust(ended_sid)
            end_trust(ended_sid)
            unknown_sid = f"matrix-unknown-{mode}"  # never registered

            for state, sid in (("invalid_child", invalid_sid),
                               ("ended", ended_sid),
                               ("unknown", unknown_sid)):
                for tool_name in deny_all_tools:
                    with self.subTest(state=state, mode=mode, tool_name=tool_name, expect="block"):
                        self.assertEqual(
                            hooks[mode](tool_name=tool_name, session_id=sid)["action"],
                            "block",
                        )

    def test_ended_state_denies_even_with_exact_task_binding(self):
        for mode in ("fein", "sonar", "blitz"):
            with self.subTest(mode=mode):
                hook = self.make_hook(mode)
                sid = f"matrix-ended-bound-{mode}"
                mark_top_level(sid)
                self.cleanup_trust(sid)
                end_trust(sid)
                # task_id == session_id must NOT revive an ended session.
                for tool_name in ("read", "write", "bash", "complete"):
                    with self.subTest(tool_name=tool_name):
                        self.assertEqual(
                            hook(tool_name=tool_name, session_id=sid, task_id=sid)["action"],
                            "block",
                        )

    def test_child_forbidden_includes_create_mutator(self):
        """create is a write-family mutator in TOOL_CATEGORIES, so it is
        forbidden to children and never appears in the child-safe set."""
        self.assertIn("create", _CHILD_FORBIDDEN_TOOLS)
        self.assertNotIn("create", CHILD_SAFE_ALLOWED_TOOLS)
        self.assertNotIn("create", SONAR_ALLOWED_TOOLS)
        self.assertNotIn("create", BLITZ_DIRECT_ALLOWED_TOOLS)


class TerminalBoundaryTests(HookTestBase):
    def test_on_session_finalize_clears_top_level_trust(self):
        manager = SessionManager()
        on_start, _, on_finalize, _ = create_session_hooks(manager)
        on_start(session_id="final-top", platform="cli")
        self.assertEqual(get_trust_state("final-top"), TOP_LEVEL)
        self.cleanup_trust("final-top")

        on_finalize(session_id="final-top", reason="session_expired")
        self.assertEqual(get_trust_state("final-top"), ENDED)

        hook = self.make_hook("fein")
        self.assertEqual(hook(tool_name="write", session_id="final-top")["action"], "block")

    def test_on_session_reset_clears_old_session_trust(self):
        manager = SessionManager()
        on_start, _, _, on_reset = create_session_hooks(manager)
        on_start(session_id="old-sess", platform="cli")
        self.cleanup_trust("old-sess")
        self.assertEqual(get_trust_state("old-sess"), TOP_LEVEL)

        on_reset(session_id="new-sess", old_session_id="old-sess", new_session_id="new-sess")
        self.assertEqual(get_trust_state("old-sess"), ENDED)

        hook = self.make_hook("fein")
        self.assertEqual(hook(tool_name="write", session_id="old-sess")["action"], "block")

    def test_reset_cli_payload_scopes_to_manager_tracked_old_session(self):
        """The real CLI reset payload (cli.py _notify_session_boundary)
        carries only the NEW session id - ``session_id``/``new_session_id``
        with no ``old_session_id``.  The reset must end the manager's
        tracked old-session identity for THIS agent instance without
        revoking an unrelated concurrent session in the same process."""
        manager = SessionManager()
        on_start, _, _, on_reset = create_session_hooks(manager)
        # This agent instance's session (tracked by the manager).
        on_start(session_id="old-sess", platform="cli")
        # An unrelated concurrent session from another agent instance.
        mark_top_level("other-sess")
        self.cleanup_trust("old-sess", "other-sess")
        self.assertEqual(get_trust_state("old-sess"), TOP_LEVEL)
        self.assertEqual(get_trust_state("other-sess"), TOP_LEVEL)

        # Real CLI reset payload: new session id only.
        on_reset(session_id="new-sess", platform="cli", reason="new_session")

        self.assertEqual(get_trust_state("old-sess"), ENDED)
        self.assertEqual(get_trust_state("other-sess"), TOP_LEVEL)
        hook = self.make_hook("fein")
        self.assertEqual(hook(tool_name="write", session_id="old-sess")["action"], "block")
        self.assertIsNone(hook(tool_name="write", session_id="other-sess"))

    def test_reset_cli_payload_with_new_session_id_kwarg_scopes_to_tracked(self):
        """The CLI payload shape with an explicit new_session_id (as
        gateway/slash_commands.py passes alongside old_session_id) is also
        manager-scoped when the old id is absent."""
        manager = SessionManager()
        on_start, _, _, on_reset = create_session_hooks(manager)
        on_start(session_id="old-sess", platform="cli")
        mark_top_level("other-sess")
        self.cleanup_trust("old-sess", "other-sess")

        on_reset(session_id="new-sess", new_session_id="new-sess")

        self.assertEqual(get_trust_state("old-sess"), ENDED)
        self.assertEqual(get_trust_state("other-sess"), TOP_LEVEL)

    def test_reset_cli_payload_with_no_tracked_session_fails_closed(self):
        """A CLI-shape reset from an untracked manager cannot identify the
        old session; it fails closed by revoking all active trust."""
        manager = SessionManager()
        _, _, _, on_reset = create_session_hooks(manager)
        mark_top_level("concurrent-sess")
        self.cleanup_trust("concurrent-sess")

        # No on_session_start ever fired for this manager.
        on_reset(session_id="new-sess", reason="new_session")

        self.assertEqual(get_trust_state("concurrent-sess"), ENDED)
        hook = self.make_hook("fein")
        self.assertEqual(
            hook(tool_name="read", session_id="concurrent-sess")["action"], "block"
        )

    def test_reset_cli_payload_matching_tracked_id_fails_closed(self):
        """A CLI reset whose new session id IS the manager's tracked
        identity is ambiguous (ending it would kill the NEW session), so it
        fails closed by revoking all active trust."""
        manager = SessionManager()
        on_start, _, _, on_reset = create_session_hooks(manager)
        on_start(session_id="sess-a", platform="cli")
        mark_top_level("other-sess")
        self.cleanup_trust("sess-a", "other-sess")

        # The payload's new id equals the manager's tracked identity.
        on_reset(session_id="sess-a", reason="new_session")

        self.assertEqual(get_trust_state("sess-a"), ENDED)
        self.assertEqual(get_trust_state("other-sess"), ENDED)

    def test_subagent_stop_clears_child_trust(self):
        self.start_child("stopping-child", "leaf")
        self.assertEqual(get_trust_state("stopping-child"), TRUSTED_CHILD)

        _on_subagent_stop(
            child_session_id="stopping-child",
            child_role="leaf",
            child_status="completed",
        )
        self.assertEqual(get_trust_state("stopping-child"), ENDED)

        hook = self.make_hook("fein")
        self.assertEqual(hook(tool_name="read", session_id="stopping-child")["action"], "block")
        self.assertEqual(hook(tool_name="write", session_id="stopping-child")["action"], "block")

    def test_subagent_stop_then_reuse_requires_fresh_trust(self):
        """A reused child id gets no trust until a fresh subagent_start."""
        self.start_child("reused-child", "leaf")
        _on_subagent_stop(child_session_id="reused-child", child_status="cancelled")
        self.assertEqual(get_trust_state("reused-child"), ENDED)

        hook = self.make_hook("fein")
        self.assertEqual(hook(tool_name="read", session_id="reused-child")["action"], "block")

        # Fresh delegation re-establishes child trust.
        self.start_child("reused-child", "leaf")
        self.assertEqual(get_trust_state("reused-child"), TRUSTED_CHILD)
        self.assertIsNone(hook(tool_name="read", session_id="reused-child"))

    def test_finalize_clears_child_trust_too(self):
        manager = SessionManager()
        _, _, on_finalize, _ = create_session_hooks(manager)
        self.start_child("final-child", "leaf")
        on_finalize(session_id="final-child", reason="new_session")
        self.cleanup_trust("final-child")
        self.assertEqual(get_trust_state("final-child"), ENDED)

    def test_terminal_cleanup_does_not_break_multi_turn_top_level(self):
        """A terminal boundary only affects the session it names; other
        sessions keep their resumable trust."""
        manager = SessionManager()
        on_start, on_end, on_finalize, _ = create_session_hooks(manager)

        on_start(session_id="survivor", platform="cli")
        on_start(session_id="victim", platform="cli")
        self.cleanup_trust("survivor", "victim")
        on_end(session_id="survivor", task_id="t1")
        on_finalize(session_id="victim", reason="new_session")

        self.assertEqual(get_trust_state("survivor"), TOP_LEVEL)
        self.assertEqual(get_trust_state("victim"), ENDED)
        hook = self.make_hook("fein")
        self.assertIsNone(hook(tool_name="write", session_id="survivor"))
        self.assertEqual(hook(tool_name="write", session_id="victim")["action"], "block")

    def test_finalize_with_malformed_explicit_id_still_clears_tracked_trust(self):
        """A finalize whose explicit session id is missing, padded, or
        control-ridden must not leave the previously trusted session
        active: the manager's tracked identity is ended (fail closed)."""
        for finalize_kwargs in (
            {"session_id": "  "},
            {"session_id": "\t"},
            {"session_id": "real-sess "},
            {"session_id": " real-sess"},
            {"session_id": "real-sess\x00"},
            {"session_id": "unknown"},
            {"session_id": ""},
            {"session_id": None},
            {},  # no session_id key at all
        ):
            with self.subTest(finalize_kwargs=finalize_kwargs):
                manager = SessionManager()
                on_start, _, on_finalize, _ = create_session_hooks(manager)
                on_start(session_id="real-sess", platform="cli")
                self.assertEqual(get_trust_state("real-sess"), TOP_LEVEL)
                on_finalize(**finalize_kwargs)
                self.assertEqual(get_trust_state("real-sess"), ENDED)
                self.cleanup_trust("real-sess")
                hook = self.make_hook("fein")
                self.assertEqual(
                    hook(tool_name="write", session_id="real-sess")["action"], "block"
                )

    def test_finalize_with_malformed_id_and_no_tracked_session_is_harmless(self):
        """Malformed explicit id with no active trust: the unscoped-event
        revoke-all safety net runs but has nothing to end; nothing raises
        and no trust is created."""
        manager = SessionManager()
        _, _, on_finalize, _ = create_session_hooks(manager)
        for kwargs in ({"session_id": "  "}, {}, {"session_id": None}):
            with self.subTest(kwargs=kwargs):
                on_finalize(**kwargs)
        self.assertEqual(get_trust_state("anything"), UNKNOWN)

    def test_finalize_with_malformed_id_clears_child_trust_too(self):
        """A malformed finalize also clears child trust: the child's own
        on_session_start (platform='subagent') tracks its id, and the
        fail-closed fallback ends it."""
        manager = SessionManager()
        on_start, _, on_finalize, _ = create_session_hooks(manager)
        self.start_child("final-child-malformed", "leaf")
        self.assertEqual(get_trust_state("final-child-malformed"), TRUSTED_CHILD)
        # The child's first turn fires on_session_start with the subagent
        # platform (never top-level, but tracked as the session identity).
        on_start(session_id="final-child-malformed", platform="subagent")
        self.assertEqual(get_trust_state("final-child-malformed"), TRUSTED_CHILD)
        on_finalize(session_id="  ")
        self.assertEqual(get_trust_state("final-child-malformed"), ENDED)
        hook = self.make_hook("fein")
        self.assertEqual(
            hook(tool_name="read", session_id="final-child-malformed")["action"], "block"
        )

    def test_reset_with_malformed_old_id_still_clears_tracked_trust(self):
        """A reset with no usable old_session_id must not leave the
        previously trusted old session active: a CLI-shape payload (new
        session id only) is manager-scoped to the tracked identity, and a
        wholly unscoped payload revokes all trust - either way the tracked
        old session ends."""
        for reset_kwargs in (
            {"old_session_id": "  "},
            {"old_session_id": "\t"},
            {"old_session_id": "old-sess "},
            {"old_session_id": " old-sess"},
            {"old_session_id": "old-sess\x00"},
            {"old_session_id": "unknown"},
            {"old_session_id": ""},
            {"old_session_id": None},
            {"session_id": "new-sess", "new_session_id": "new-sess"},  # CLI path
            {},
        ):
            with self.subTest(reset_kwargs=reset_kwargs):
                manager = SessionManager()
                on_start, _, _, on_reset = create_session_hooks(manager)
                on_start(session_id="old-sess", platform="cli")
                self.assertEqual(get_trust_state("old-sess"), TOP_LEVEL)
                on_reset(**reset_kwargs)
                self.assertEqual(get_trust_state("old-sess"), ENDED)
                self.cleanup_trust("old-sess")
                hook = self.make_hook("fein")
                self.assertEqual(
                    hook(tool_name="write", session_id="old-sess")["action"], "block"
                )

    def test_reset_with_malformed_old_id_and_no_tracked_session_is_harmless(self):
        """Malformed old id with no active trust: the unscoped-event
        revoke-all safety net runs but has nothing to end; nothing raises
        and no trust is created."""
        manager = SessionManager()
        _, _, _, on_reset = create_session_hooks(manager)
        for kwargs in ({"old_session_id": "  "}, {}, {"old_session_id": None}):
            with self.subTest(kwargs=kwargs):
                on_reset(**kwargs)
        self.assertEqual(get_trust_state("anything"), UNKNOWN)

    def test_terminal_cleanup_never_grants_trust(self):
        """Terminal events with any payload shape never mark anything
        trusted - worst case they deny (ENDED) a tracked session."""
        manager = SessionManager()
        on_start, _, on_finalize, on_reset = create_session_hooks(manager)
        on_start(session_id="t-sess", platform="cli")
        self.cleanup_trust("t-sess")
        for hook_call in (
            lambda: on_finalize(session_id="  "),
            lambda: on_reset(old_session_id="\t"),
            lambda: on_finalize(session_id="t-sess"),
            lambda: on_reset(old_session_id="t-sess"),
        ):
            hook_call()
        state = get_trust_state("t-sess")
        self.assertIn(state, (ENDED, UNKNOWN))  # never TOP_LEVEL / TRUSTED_CHILD


class TerminalUnscopedRevocationTests(HookTestBase):
    """Unscoped terminal events revoke ALL active trust (fail closed).

    A terminal event (on_session_finalize / on_session_reset /
    subagent_stop) is event-scoped when the payload carries a usable
    native session id; on_session_reset additionally falls back to the
    manager's tracked old-session identity for a CLI-shape payload (new
    session id only).  When no session can be scoped at all - the explicit
    id is missing/malformed AND there is no usable new id or tracked
    identity - the event cannot be safely scoped, so every trusted session
    is marked ENDED - no session is left trusted after an unscoped
    terminal event.
    """

    def test_valid_finalize_is_event_scoped_for_concurrent_sessions(self):
        """A valid finalize ends only the named session; other concurrent
        sessions keep their trust (event-scoped, not process-scoped)."""
        manager = SessionManager()
        on_start, _, on_finalize, _ = create_session_hooks(manager)
        on_start(session_id="sess-a", platform="cli")
        on_start(session_id="sess-b", platform="cli")
        self.cleanup_trust("sess-a", "sess-b")
        self.assertEqual(get_trust_state("sess-a"), TOP_LEVEL)
        self.assertEqual(get_trust_state("sess-b"), TOP_LEVEL)

        on_finalize(session_id="sess-b", reason="new_session")

        self.assertEqual(get_trust_state("sess-b"), ENDED)
        self.assertEqual(get_trust_state("sess-a"), TOP_LEVEL)

    def test_malformed_finalize_revokes_all_concurrent_trust(self):
        """A finalize whose explicit id is malformed cannot be scoped, so
        EVERY trusted session is ended - none is left trusted."""
        manager = SessionManager()
        on_start, _, on_finalize, _ = create_session_hooks(manager)
        on_start(session_id="sess-a", platform="cli")
        on_start(session_id="sess-b", platform="cli")
        self.cleanup_trust("sess-a", "sess-b")
        on_finalize(session_id="  ")  # malformed: no usable id

        self.assertEqual(get_trust_state("sess-a"), ENDED)
        self.assertEqual(get_trust_state("sess-b"), ENDED)

    def test_malformed_finalize_revokes_parent_and_child_trust(self):
        """Active parent (top-level) and child trust are both revoked by an
        unscoped finalize."""
        manager = SessionManager()
        on_start, _, on_finalize, _ = create_session_hooks(manager)
        on_start(session_id="parent-sess", platform="cli")
        self.start_child("child-sess", "leaf")
        self.cleanup_trust("parent-sess", "child-sess")
        self.assertEqual(get_trust_state("parent-sess"), TOP_LEVEL)
        self.assertEqual(get_trust_state("child-sess"), TRUSTED_CHILD)

        on_finalize(session_id="\t")  # malformed

        self.assertEqual(get_trust_state("parent-sess"), ENDED)
        self.assertEqual(get_trust_state("child-sess"), ENDED)
        self.assertEqual(get_child_topology_role("child-sess"), "")

    def test_cli_shape_reset_is_scoped_to_tracked_session_not_global(self):
        """A CLI-shape reset payload (new session id only) is scoped to the
        manager's tracked session: an unrelated concurrent session keeps
        its trust instead of being revoked with it."""
        manager = SessionManager()
        on_start, _, _, on_reset = create_session_hooks(manager)
        on_start(session_id="tracked-sess", platform="cli")
        mark_top_level("other-sess")
        self.cleanup_trust("tracked-sess", "other-sess")
        on_reset(session_id="new-sess", new_session_id="new-sess")

        self.assertEqual(get_trust_state("tracked-sess"), ENDED)
        self.assertEqual(get_trust_state("other-sess"), TOP_LEVEL)

    def test_reset_with_no_usable_id_revokes_all_active_trust(self):
        """A reset with no usable old session id and no usable new session
        id cannot be scoped at all; every trusted session is ended."""
        manager = SessionManager()
        on_start, _, _, on_reset = create_session_hooks(manager)
        on_start(session_id="old-sess", platform="cli")
        on_start(session_id="other-sess", platform="cli")
        self.cleanup_trust("old-sess", "other-sess")
        # No usable id anywhere in the payload.
        on_reset(old_session_id="\t")
        on_reset(old_session_id=None)

        self.assertEqual(get_trust_state("old-sess"), ENDED)
        self.assertEqual(get_trust_state("other-sess"), ENDED)

    def test_malformed_subagent_stop_revokes_all_active_trust(self):
        """A stop with no usable child session id cannot be scoped; every
        session - including a trusted parent - is ended."""
        manager = SessionManager()
        on_start, _, _, _ = create_session_hooks(manager)
        on_start(session_id="parent-sess", platform="cli")
        self.start_child("child-a", "leaf")
        self.start_child("child-b", "leaf")
        self.cleanup_trust("parent-sess", "child-a", "child-b")
        self.assertEqual(get_trust_state("parent-sess"), TOP_LEVEL)
        self.assertEqual(get_trust_state("child-a"), TRUSTED_CHILD)
        self.assertEqual(get_trust_state("child-b"), TRUSTED_CHILD)

        _on_subagent_stop(child_session_id="", child_status="completed")

        self.assertEqual(get_trust_state("parent-sess"), ENDED)
        self.assertEqual(get_trust_state("child-a"), ENDED)
        self.assertEqual(get_trust_state("child-b"), ENDED)

    def test_malformed_subagent_stop_with_unknown_sentinel_revokes_all(self):
        self.start_child("child-unk", "leaf")
        self.cleanup_trust("child-unk")
        _on_subagent_stop(child_session_id="unknown", child_status="completed")
        self.assertEqual(get_trust_state("child-unk"), ENDED)

    def test_valid_subagent_stop_is_event_scoped(self):
        """A valid stop ends only the named child; a sibling child keeps
        its trust."""
        self.start_child("child-stop", "leaf")
        self.start_child("child-keep", "leaf")
        self.cleanup_trust("child-stop", "child-keep")
        _on_subagent_stop(child_session_id="child-stop", child_status="completed")
        self.assertEqual(get_trust_state("child-stop"), ENDED)
        self.assertEqual(get_trust_state("child-keep"), TRUSTED_CHILD)

    def test_post_event_denial_after_unscoped_revoke(self):
        """After an unscoped terminal event revokes all trust, every
        previously trusted session denies ALL tools in every mode."""
        manager = SessionManager()
        on_start, _, on_finalize, _ = create_session_hooks(manager)
        on_start(session_id="denied-top", platform="cli")
        self.start_child("denied-child", "leaf")
        self.cleanup_trust("denied-top", "denied-child")
        hook = self.make_hook("fein")
        self.assertIsNone(hook(tool_name="write", session_id="denied-top"))
        self.assertIsNone(hook(tool_name="read", session_id="denied-child"))

        on_finalize(session_id="   ")  # malformed -> revoke all

        for sid in ("denied-top", "denied-child"):
            for tool_name in ("read", "write", "bash", "complete", "webfetch"):
                with self.subTest(session_id=sid, tool_name=tool_name):
                    self.assertEqual(
                        hook(tool_name=tool_name, session_id=sid)["action"], "block"
                    )

    def test_revoked_sessions_require_fresh_trust_event(self):
        """A revoked session must be re-established by a fresh trusted
        lifecycle event before it is trusted again."""
        manager = SessionManager()
        on_start, _, on_finalize, _ = create_session_hooks(manager)
        on_start(session_id="revoked-top", platform="cli")
        self.cleanup_trust("revoked-top")
        on_finalize(session_id="bad id ")
        self.assertEqual(get_trust_state("revoked-top"), ENDED)

        hook = self.make_hook("fein")
        self.assertEqual(
            hook(tool_name="read", session_id="revoked-top")["action"], "block"
        )

        # Fresh trusted lifecycle event re-establishes trust.
        on_start(session_id="revoked-top", platform="cli")
        self.assertEqual(get_trust_state("revoked-top"), TOP_LEVEL)
        self.assertIsNone(hook(tool_name="write", session_id="revoked-top"))

    def test_revoke_all_trust_marks_every_trusted_session_ended(self):
        mark_top_level("top-a")
        mark_top_level("top-b")
        mark_trusted_child("child-a", "leaf")
        self.cleanup_trust("top-a", "top-b", "child-a")
        revoke_all_trust()
        self.assertEqual(get_trust_state("top-a"), ENDED)
        self.assertEqual(get_trust_state("top-b"), ENDED)
        self.assertEqual(get_trust_state("child-a"), ENDED)
        self.assertEqual(get_child_topology_role("child-a"), "")
        self.assertEqual(get_trust_state("never-seen"), UNKNOWN)

    def test_unscoped_terminal_events_never_raise(self):
        """Hostile/malformed payload shapes never raise from the terminal
        handlers; they fail closed instead."""
        manager = SessionManager()
        on_start, _, on_finalize, on_reset = create_session_hooks(manager)
        on_start(session_id="no-raise", platform="cli")
        self.cleanup_trust("no-raise")
        for call in (
            lambda: on_finalize(session_id=None),
            lambda: on_finalize(session_id=7),
            lambda: on_finalize(session_id={"bad": True}),
            lambda: on_finalize(session_id=["x", "y"]),
            lambda: on_reset(old_session_id=None),
            lambda: on_reset(old_session_id=["x"]),
            lambda: on_reset(old_session_id={"bad": True}),
            lambda: _on_subagent_stop(child_session_id=None),
            lambda: _on_subagent_stop(child_session_id=7),
            lambda: _on_subagent_stop(child_session_id={"bad": True}),
            lambda: _on_subagent_stop(child_session_id=["x"]),
            lambda: _on_subagent_stop(child_session_id="unknown"),
            lambda: _on_subagent_stop(),  # no kwargs at all
        ):
            with self.subTest(call=call):
                call()  # must not raise
        # Fail closed: the tracked session ended up denied, not trusted.
        self.assertEqual(get_trust_state("no-raise"), ENDED)


class TrustRegistryBoundTests(HookTestBase):
    """The global trust registry has a HARD bound.

    _session_trust retains ended/invalid tombstone entries; without a cap
    a long-lived process (gateway) would accumulate every ended session
    forever.  The registry size NEVER exceeds _TRUST_REGISTRY_CAP:

    - A new admission first evicts the oldest tombstones (in the order
      they became ended/invalid) deterministically to make room.
    - When the registry is at capacity with only active trust left, the
      new admission FAILS CLOSED: the id is not recorded and stays UNKNOWN
      (denies all tools) - active/trusted entries are NEVER evicted.
    - The most recently ended ids keep their ENDED reuse protection: an
      exact task_id == session_id binding cannot revive them (ENDED fails
      closed), and only the oldest-ended ids fall out of the registry.
    - An evicted id becomes UNKNOWN, which still denies all tools, so
      pruning never grants trust.
    """

    def test_registry_stays_bounded_after_10000_sessions(self):
        """10,000 sessions start and end; the registry never exceeds the
        cap and the most recently ended ids keep their ENDED tombstone."""
        n = 10000
        for i in range(n):
            mark_top_level(f"bulk-{i}")
        for i in range(n):
            end_trust(f"bulk-{i}")

        self.assertLessEqual(len(_session_trust), _TRUST_REGISTRY_CAP)
        # The most recently ended id is retained as ENDED (reuse protection).
        self.assertEqual(get_trust_state(f"bulk-{n - 1}"), ENDED)
        # The oldest ended ids were evicted oldest-first to UNKNOWN.
        self.assertEqual(get_trust_state("bulk-0"), UNKNOWN)
        self.assertEqual(get_trust_state(f"bulk-{n - _TRUST_REGISTRY_CAP - 1}"), UNKNOWN)
        for i in range(n):
            clear_trust(f"bulk-{i}")

    def test_recently_ended_ids_keep_reuse_protection_through_tool_hook(self):
        """A recently ended (retained) id denies all tools even with an
        exact task_id == session_id binding: ENDED tombstones are never
        revived by a coincidental binding."""
        n = _TRUST_REGISTRY_CAP + 5
        for i in range(n):
            mark_top_level(f"protect-{i}")
        for i in range(n):
            end_trust(f"protect-{i}")
        self.assertLessEqual(len(_session_trust), _TRUST_REGISTRY_CAP)

        newest = f"protect-{n - 1}"
        self.assertEqual(get_trust_state(newest), ENDED)
        hook = self.make_hook("fein")
        result = hook(tool_name="write", session_id=newest, task_id=newest)
        self.assertEqual(result["action"], "block")
        result = hook(tool_name="read", session_id=newest, task_id=newest)
        self.assertEqual(result["action"], "block")
        for i in range(n):
            clear_trust(f"protect-{i}")

    def test_registry_never_exceeds_cap_with_only_active_entries(self):
        """Active trust is never evicted AND the registry has a hard
        bound: overflow admissions fail closed (the id stays UNKNOWN)
        instead of growing the registry past the cap."""
        n = _TRUST_REGISTRY_CAP + 200
        for i in range(n):
            self.addCleanup(clear_trust, f"active-{i}")
            self.addCleanup(clear_trust, f"child-{i}")
            mark_top_level(f"active-{i}")

        # Hard bound: the registry never grew past the cap.
        self.assertEqual(len(_session_trust), _TRUST_REGISTRY_CAP)
        # The first cap entries are retained as active trust.
        for i in range(_TRUST_REGISTRY_CAP):
            self.assertEqual(get_trust_state(f"active-{i}"), TOP_LEVEL)
        # Overflow top-level admissions were refused (fail closed).
        for i in range(_TRUST_REGISTRY_CAP, n):
            self.assertEqual(get_trust_state(f"active-{i}"), UNKNOWN)

        # Child admissions at capacity are refused the same way.
        for i in range(n):
            self.assertFalse(mark_trusted_child(f"child-{i}", "leaf"))
        self.assertEqual(len(_session_trust), _TRUST_REGISTRY_CAP)
        for i in range(n):
            self.assertEqual(get_trust_state(f"child-{i}"), UNKNOWN)
        # No topology role is stored for a refused child admission.
        self.assertEqual(get_child_topology_role("child-0"), "")
        # Existing active trust is fully preserved.
        for i in range(_TRUST_REGISTRY_CAP):
            self.assertEqual(get_trust_state(f"active-{i}"), TOP_LEVEL)

    def test_new_admission_at_cap_fails_closed(self):
        """At hard capacity with only active trust, every admission path
        fails closed: top-level, valid-role child, invalid-child, and
        terminal end for unknown ids all leave the id UNKNOWN."""
        for i in range(_TRUST_REGISTRY_CAP):
            self.addCleanup(clear_trust, f"cap-{i}")
            mark_top_level(f"cap-{i}")
        self.cleanup_trust("overflow-top", "overflow-child", "overflow-invalid",
                           "overflow-ended")
        self.assertEqual(len(_session_trust), _TRUST_REGISTRY_CAP)

        mark_top_level("overflow-top")
        self.assertEqual(get_trust_state("overflow-top"), UNKNOWN)
        self.assertFalse(mark_trusted_child("overflow-child", "leaf"))
        self.assertEqual(get_trust_state("overflow-child"), UNKNOWN)
        self.assertEqual(get_child_topology_role("overflow-child"), "")
        mark_invalid_child("overflow-invalid")
        self.assertEqual(get_trust_state("overflow-invalid"), UNKNOWN)
        end_trust("overflow-ended")
        self.assertEqual(get_trust_state("overflow-ended"), UNKNOWN)

        # Nothing was evicted: size is unchanged and active trust intact.
        self.assertEqual(len(_session_trust), _TRUST_REGISTRY_CAP)
        for i in range(_TRUST_REGISTRY_CAP):
            self.assertEqual(get_trust_state(f"cap-{i}"), TOP_LEVEL)

        # The refused id behaves exactly like a never-seen session through
        # the real hook: denied without a binding.
        hook = self.make_hook("fein")
        self.assertEqual(
            hook(tool_name="read", session_id="overflow-top")["action"], "block"
        )
        self.assertEqual(
            hook(tool_name="write", session_id="overflow-top")["action"], "block"
        )

    def test_admission_at_cap_evicts_oldest_tombstone_preserving_recent_reuse(self):
        """When the registry is at capacity WITH tombstones, a new
        admission evicts the OLDEST tombstone (FIFO) and succeeds; recent
        ENDED reuse protection and active trust are preserved, and
        terminal prune/reuse still works."""
        # cap-1 ended tombstones + 1 active top-level session fill the cap.
        for i in range(_TRUST_REGISTRY_CAP - 1):
            self.addCleanup(clear_trust, f"tomb-{i}")
            mark_top_level(f"tomb-{i}")
        self.cleanup_trust("keeper-active", "fresh-admit")
        mark_top_level("keeper-active")
        for i in range(_TRUST_REGISTRY_CAP - 1):
            end_trust(f"tomb-{i}")
        self.assertEqual(len(_session_trust), _TRUST_REGISTRY_CAP)

        # New admission evicts the OLDEST tombstone (tomb-0) and succeeds.
        mark_top_level("fresh-admit")
        self.assertEqual(len(_session_trust), _TRUST_REGISTRY_CAP)
        self.assertEqual(get_trust_state("fresh-admit"), TOP_LEVEL)
        self.assertEqual(get_trust_state("tomb-0"), UNKNOWN)
        # The most recent tombstone keeps its ENDED reuse protection.
        self.assertEqual(get_trust_state(f"tomb-{_TRUST_REGISTRY_CAP - 2}"), ENDED)
        # Active trust is never evicted to make room.
        self.assertEqual(get_trust_state("keeper-active"), TOP_LEVEL)

        # Terminal pruning still works: ending fresh-admit turns it into
        # the newest retained tombstone.
        end_trust("fresh-admit")
        self.assertLessEqual(len(_session_trust), _TRUST_REGISTRY_CAP)
        self.assertEqual(get_trust_state("fresh-admit"), ENDED)
        # Reuse: a fresh trusted lifecycle event re-establishes trust.
        mark_top_level("fresh-admit")
        self.assertEqual(get_trust_state("fresh-admit"), TOP_LEVEL)

    def test_reestablished_trust_removes_tombstone_bookkeeping(self):
        """A fresh trusted lifecycle event for an ended id re-establishes
        trust and drops the id from the tombstone queue."""
        mark_top_level("reused-bound")
        end_trust("reused-bound")
        self.cleanup_trust("reused-bound")
        self.assertIn("reused-bound", _tombstones)
        self.assertEqual(get_trust_state("reused-bound"), ENDED)

        mark_top_level("reused-bound")
        self.assertNotIn("reused-bound", _tombstones)
        self.assertEqual(get_trust_state("reused-bound"), TOP_LEVEL)

    def test_clear_trust_removes_tombstone_bookkeeping(self):
        mark_top_level("cleared-bound")
        end_trust("cleared-bound")
        self.cleanup_trust("cleared-bound")
        self.assertIn("cleared-bound", _tombstones)
        clear_trust("cleared-bound")
        self.assertNotIn("cleared-bound", _tombstones)
        self.assertEqual(get_trust_state("cleared-bound"), UNKNOWN)

    def test_revoke_all_prunes_registry_to_cap(self):
        """revoke_all_trust ends every keyed session; the registry is then
        pruned to its cap (all entries are evictable tombstones) while
        every revoked session still denies all tools."""
        n = _TRUST_REGISTRY_CAP + 10
        for i in range(n):
            mark_top_level(f"revoke-{i}")
        revoke_all_trust()

        self.assertLessEqual(len(_session_trust), _TRUST_REGISTRY_CAP)
        # Every revoked session denies: retained ids stay ENDED, evicted
        # ids fall to UNKNOWN - both deny all tools.
        hook = self.make_hook("fein")
        for i in range(n):
            state = get_trust_state(f"revoke-{i}")
            self.assertIn(state, (ENDED, UNKNOWN))
            self.assertEqual(
                hook(tool_name="read", session_id=f"revoke-{i}")["action"], "block"
            )
        for i in range(n):
            clear_trust(f"revoke-{i}")

    def test_repeated_end_refreshes_tombstone_recency(self):
        """Re-ending an existing tombstone refreshes its FIFO position: the
        re-ended id moves to the back of the queue, keeps its ENDED reuse
        protection, and is NOT the next eviction victim when a new
        admission needs room."""
        # cap-1 ended tombstones + 1 active top-level session fill the cap.
        for i in range(_TRUST_REGISTRY_CAP - 1):
            self.addCleanup(clear_trust, f"re-end-{i}")
            mark_top_level(f"re-end-{i}")
        self.cleanup_trust("re-end-keeper", "re-end-fresh")
        mark_top_level("re-end-keeper")
        for i in range(_TRUST_REGISTRY_CAP - 1):
            end_trust(f"re-end-{i}")
        self.assertEqual(len(_session_trust), _TRUST_REGISTRY_CAP)

        # Re-end the OLDEST tombstone: it must move to the back of the
        # FIFO (fresh reuse protection), not stay at the head.
        end_trust("re-end-0")
        self.assertEqual(_tombstones[0], "re-end-1")
        self.assertEqual(_tombstones[-1], "re-end-0")
        self.assertEqual(_tombstones.count("re-end-0"), 1)

        # The next admission evicts the now-oldest tombstone (re-end-1),
        # not the re-ended re-end-0; active trust is never evicted.
        mark_top_level("re-end-fresh")
        self.assertEqual(len(_session_trust), _TRUST_REGISTRY_CAP)
        self.assertEqual(get_trust_state("re-end-fresh"), TOP_LEVEL)
        self.assertEqual(get_trust_state("re-end-0"), ENDED)
        self.assertEqual(get_trust_state("re-end-1"), UNKNOWN)
        self.assertEqual(get_trust_state(f"re-end-{_TRUST_REGISTRY_CAP - 2}"), ENDED)
        self.assertEqual(get_trust_state("re-end-keeper"), TOP_LEVEL)

    def test_repeated_invalid_refreshes_tombstone_recency(self):
        """Re-invalidating an existing invalid-child tombstone refreshes
        its FIFO position the same way a repeated end does."""
        for i in range(_TRUST_REGISTRY_CAP - 1):
            self.addCleanup(clear_trust, f"re-inv-{i}")
            mark_top_level(f"re-inv-{i}")
        self.cleanup_trust("re-inv-keeper", "re-inv-fresh")
        mark_top_level("re-inv-keeper")
        for i in range(_TRUST_REGISTRY_CAP - 1):
            mark_invalid_child(f"re-inv-{i}")
        self.assertEqual(len(_session_trust), _TRUST_REGISTRY_CAP)

        # Re-invalidate the OLDEST invalid tombstone: fresh position.
        mark_invalid_child("re-inv-0")
        self.assertEqual(_tombstones[0], "re-inv-1")
        self.assertEqual(_tombstones[-1], "re-inv-0")
        self.assertEqual(_tombstones.count("re-inv-0"), 1)

        # The next admission evicts the now-oldest tombstone (re-inv-1).
        mark_top_level("re-inv-fresh")
        self.assertEqual(len(_session_trust), _TRUST_REGISTRY_CAP)
        self.assertEqual(get_trust_state("re-inv-fresh"), TOP_LEVEL)
        self.assertEqual(get_trust_state("re-inv-0"), INVALID_CHILD)
        self.assertEqual(get_trust_state("re-inv-1"), UNKNOWN)
        self.assertEqual(get_trust_state("re-inv-keeper"), TOP_LEVEL)

    def test_revoke_all_trust_refreshes_tombstone_recency(self):
        """revoke_all_trust re-arms reuse protection for EVERY keyed
        session: an id that was already a tombstone before the unscoped
        terminal event does not keep a stale oldest position - the queue
        is rebuilt deterministically so every revoked id has exactly one
        fresh position, and pre-revoke tombstone seniority does not make
        an id the next eviction victim."""
        # Fill the cap with tombstones (tomb-0 is the oldest), then
        # re-establish tomb-0 and add one active keeper so the registry's
        # admission order (tomb-0 first) differs from the queue order
        # (tomb-0 absent, tomb-1 oldest) at revoke time.
        for i in range(_TRUST_REGISTRY_CAP - 1):
            self.addCleanup(clear_trust, f"ra-{i}")
            mark_top_level(f"ra-{i}")
            end_trust(f"ra-{i}")
        self.cleanup_trust("ra-keeper", "ra-fresh")
        mark_top_level("ra-0")      # re-establish the oldest tombstone
        mark_top_level("ra-keeper")  # active entry to fill the cap
        self.assertEqual(len(_session_trust), _TRUST_REGISTRY_CAP)

        revoke_all_trust()
        self.assertLessEqual(len(_session_trust), _TRUST_REGISTRY_CAP)
        # Every revoked id has exactly one (fresh) queue position.
        for i in range(_TRUST_REGISTRY_CAP - 1):
            self.assertEqual(_tombstones.count(f"ra-{i}"), 1)
        self.assertEqual(_tombstones.count("ra-keeper"), 1)

        # The next admission evicts by the REBUILT deterministic order:
        # ra-0 (the re-established, first-inserted id) is evicted, while
        # ra-1 - the pre-revoke oldest tombstone - keeps its refreshed
        # ENDED reuse protection instead of being the stale victim.
        mark_top_level("ra-fresh")
        self.assertEqual(len(_session_trust), _TRUST_REGISTRY_CAP)
        self.assertEqual(get_trust_state("ra-fresh"), TOP_LEVEL)
        self.assertEqual(get_trust_state("ra-0"), UNKNOWN)
        self.assertEqual(get_trust_state("ra-1"), ENDED)

        # Every revoked session denies all tools through the real hook.
        hook = self.make_hook("fein")
        for i in range(_TRUST_REGISTRY_CAP - 1):
            state = get_trust_state(f"ra-{i}")
            self.assertIn(state, (ENDED, UNKNOWN))
            self.assertEqual(
                hook(tool_name="write", session_id=f"ra-{i}")["action"], "block"
            )
            self.assertEqual(
                hook(tool_name="read", session_id=f"ra-{i}")["action"], "block"
            )


class FailClosedTests(HookTestBase):
    def test_malformed_tool_names_block_without_raising(self):
        hook = self.make_hook("fein")
        session_id = "tool-malformed"
        mark_top_level(session_id)
        self.cleanup_trust(session_id)
        for tool_name in (
            None, "", "   ", "\t\n", 7, 0.5, {}, [], ("read",),
            "r" * 300, "re\0ad", "re\x1fad", "re\x7fad",
            " write ", "write ", " write", "\twrite", "write\n", "write\t",
            " read ", " bash ", " complete ",
            "wri\x00te", "write\x01", "\x00write",
        ):
            with self.subTest(tool_name=repr(tool_name)):
                result = hook(tool_name=tool_name, session_id=session_id)
                self.assertIsNotNone(result)
                self.assertEqual(result["action"], "block")

    def test_unicode_control_tool_names_block_without_raising(self):
        """Unicode controls/format chars in a tool name block in every
        trust state and mode, without raising and without normalizing."""
        hook = self.make_hook("fein")
        session_id = "tool-unicode"
        mark_top_level(session_id)
        self.cleanup_trust(session_id)
        for tool_name in (
            "write\u200b", "re\u200cad", "\u200bread", "we\u2028bfetch",
            "\u0085write", "read\u200d", "re\u009fad", "glob\u2029",
            "complete\u200c", "bash\u200e",
        ):
            with self.subTest(tool_name=repr(tool_name)):
                result = hook(tool_name=tool_name, session_id=session_id)
                self.assertIsNotNone(result)
                self.assertEqual(result["action"], "block")

    def test_unicode_control_tool_name_variant_of_allowed_tool_blocks(self):
        """A zero-width/control variant of an ALLOWED tool name must block
        (never normalized to the allowed name), while the exact name still
        works - for top-level and child sessions in every mode."""
        for mode in ("fein", "sonar", "blitz"):
            for state, setup in (
                ("top_level", lambda sid: mark_top_level(sid)),
                ("trusted_child", lambda sid: self.start_child(sid, "leaf")),
            ):
                with self.subTest(mode=mode, state=state):
                    hook = self.make_hook(mode)
                    sid = f"zws-tool-{mode}-{state}"
                    setup(sid)
                    self.cleanup_trust(sid)
                    for tool_name in (
                        "re\u200bad", "re\u200cad", "re\u009fad",
                        "re\u2028ad", "we\u200bbfetch",
                    ):
                        with self.subTest(tool_name=repr(tool_name)):
                            self.assertEqual(
                                hook(tool_name=tool_name, session_id=sid)["action"],
                                "block",
                            )
                    # The exact allowed tool still works for that session.
                    self.assertIsNone(hook(tool_name="read", session_id=sid))

    def test_padded_tool_names_block_in_every_trust_state_and_mode(self):
        """Padded tool names are never normalized: a padded ALLOWED tool
        must block for top-level and child sessions in every mode."""
        padded = (" write ", " read ", " bash ", " complete ", "\tread", "read\n",
                  " webfetch ", "glob ")
        for mode in ("fein", "sonar", "blitz"):
            for state, setup in (
                ("top_level", lambda sid: mark_top_level(sid)),
                ("trusted_child", lambda sid: self.start_child(sid, "leaf")),
            ):
                with self.subTest(mode=mode, state=state):
                    hook = self.make_hook(mode)
                    sid = f"pad-{mode}-{state}"
                    setup(sid)
                    self.cleanup_trust(sid)
                    for tool_name in padded:
                        with self.subTest(mode=mode, state=state, tool_name=repr(tool_name)):
                            self.assertEqual(
                                hook(tool_name=tool_name, session_id=sid)["action"],
                                "block",
                            )

    def test_exact_tool_names_still_work_after_padding_rejection(self):
        """Rejecting padded names must not reject the exact names."""
        hook = self.make_hook("fein")
        session_id = "exact-tools"
        mark_top_level(session_id)
        self.cleanup_trust(session_id)
        for tool_name in ("write", "read", "bash", "complete", "webfetch", "glob"):
            with self.subTest(tool_name=tool_name):
                self.assertIsNone(hook(tool_name=tool_name, session_id=session_id))

    def test_invalid_mode_denies_all_tools(self):
        home = tempfile.TemporaryDirectory()
        self.addCleanup(home.cleanup)
        with patch.dict(os.environ, {"HERMES_HOME": home.name}, clear=False):
            manager = ModeManager()
            manager.set_mode("fein")
            hook = create_pre_tool_hook(manager)
            session_id = "invalid-mode-sess"
            mark_top_level(session_id)
            self.cleanup_trust(session_id)
            # Corrupt the mode state to something invalid.
            with patch.object(manager, "get_mode", return_value="turbo"):
                result = hook(tool_name="read", session_id=session_id)
                self.assertEqual(result["action"], "block")
            # The valid-mode fallback still works.
            self.assertIsNone(hook(tool_name="read", session_id=session_id))

    def test_missing_session_context_fails_closed(self):
        hook = self.make_hook("fein")
        self.assertEqual(hook(tool_name="read")["action"], "block")
        self.assertEqual(hook(tool_name="write")["action"], "block")

    def test_unknown_sentinel_ids_fail_closed(self):
        hook = self.make_hook("fein")
        for sid in ("unknown", "", None, 7):
            with self.subTest(session_id=sid):
                self.assertEqual(hook(tool_name="read", session_id=sid)["action"], "block")
                self.assertEqual(hook(tool_name="write", session_id=sid)["action"], "block")

    def test_end_then_child_reuse_requires_fresh_child_trust(self):
        mark_top_level("end-child-reuse")
        end_trust("end-child-reuse")
        self.cleanup_trust("end-child-reuse")
        self.assertEqual(get_trust_state("end-child-reuse"), ENDED)

        # No child trust until a fresh subagent_start.
        hook = self.make_hook("fein")
        self.assertEqual(hook(tool_name="read", session_id="end-child-reuse")["action"], "block")
        self.start_child("end-child-reuse", "leaf")
        self.assertIsNone(hook(tool_name="read", session_id="end-child-reuse"))


class AllowlistTests(HookTestBase):
    def test_child_safe_allowlist_is_exact_and_literal(self):
        self.assertEqual(
            CHILD_SAFE_ALLOWED_TOOLS,
            frozenset(
                {
                    "read", "read_file", "glob", "grep", "search_files",
                    "list", "ls", "stat", "file_info",
                    "complete", "complete_structured", "think", "reason",
                    "webfetch", "web_search", "web_extract",
                }
            ),
        )
        # No write / shell / code / delegation / OpenCode tools.
        for forbidden in (
            "write", "edit", "create", "bash", "code_execution",
            "delegate_task", "opencode", "opencode_route",
        ):
            self.assertNotIn(forbidden, CHILD_SAFE_ALLOWED_TOOLS)

    def test_child_safe_is_a_frozenset(self):
        self.assertIsInstance(CHILD_SAFE_ALLOWED_TOOLS, frozenset)

    def test_allowlists_are_literal_and_isolated_from_categories(self):
        """Future TOOL_CATEGORIES additions must not silently expand the
        safety-critical allowlists (sonar, direct-blitz, child-safe)."""
        before_sonar = frozenset(SONAR_ALLOWED_TOOLS)
        before_blitz = frozenset(BLITZ_DIRECT_ALLOWED_TOOLS)
        before_child = frozenset(CHILD_SAFE_ALLOWED_TOOLS)

        TOOL_CATEGORIES["read"].add("future_read_tool")
        TOOL_CATEGORIES["llm"].add("future_llm_tool")
        TOOL_CATEGORIES.setdefault("future_cat", {"future_mutating_tool"})
        self.addCleanup(TOOL_CATEGORIES["read"].discard, "future_read_tool")
        self.addCleanup(TOOL_CATEGORIES["llm"].discard, "future_llm_tool")
        self.addCleanup(TOOL_CATEGORIES.pop, "future_cat", None)

        self.assertEqual(SONAR_ALLOWED_TOOLS, before_sonar)
        self.assertEqual(BLITZ_DIRECT_ALLOWED_TOOLS, before_blitz)
        self.assertEqual(CHILD_SAFE_ALLOWED_TOOLS, before_child)
        self.assertNotIn("future_read_tool", SONAR_ALLOWED_TOOLS)
        self.assertNotIn("future_read_tool", BLITZ_DIRECT_ALLOWED_TOOLS)
        self.assertNotIn("future_read_tool", CHILD_SAFE_ALLOWED_TOOLS)
        self.assertNotIn("future_llm_tool", BLITZ_DIRECT_ALLOWED_TOOLS)
        self.assertNotIn("future_llm_tool", CHILD_SAFE_ALLOWED_TOOLS)
        self.assertNotIn("future_mutating_tool", SONAR_ALLOWED_TOOLS)
        self.assertNotIn("future_mutating_tool", BLITZ_DIRECT_ALLOWED_TOOLS)
        self.assertNotIn("future_mutating_tool", CHILD_SAFE_ALLOWED_TOOLS)

    def test_sonar_and_blitz_sets_stay_exact(self):
        self.assertEqual(
            SONAR_ALLOWED_TOOLS,
            frozenset(
                {
                    "read", "read_file", "glob", "grep", "search_files",
                    "list", "ls", "stat", "file_info",
                    "webfetch", "web_search", "web_extract",
                }
            ),
        )
        self.assertEqual(
            BLITZ_DIRECT_ALLOWED_TOOLS,
            frozenset(
                {
                    "read", "read_file", "glob", "grep", "search_files",
                    "list", "ls", "stat", "file_info",
                    "complete", "complete_structured", "think", "reason",
                    "webfetch", "web_search", "web_extract",
                }
            ),
        )

    def test_valid_modes_are_fixed(self):
        self.assertEqual(VALID_MODES, {"fein", "sonar", "blitz"})

    def test_recognized_platforms_is_literal_frozenset(self):
        """The top-level platform allowlist is a literal immutable frozenset
        containing the native values verified from Hermes call sites/config."""
        self.assertIsInstance(RECOGNIZED_TOP_LEVEL_PLATFORMS, frozenset)
        for platform in (
            "cli", "tui", "desktop", "gateway", "cron",
            "local", "telegram", "discord", "whatsapp", "slack", "signal",
            "api_server", "relay", "feishu", "weixin", "bluebubbles", "qqbot",
        ):
            with self.subTest(platform=platform):
                self.assertIn(platform, RECOGNIZED_TOP_LEVEL_PLATFORMS)
        # Untrusted/malformed values never appear in the allowlist.
        for bad in ("subagent", "unknown", "", "LEAF", "builder", "  cli  ", "CLI"):
            with self.subTest(bad=bad):
                self.assertNotIn(bad, RECOGNIZED_TOP_LEVEL_PLATFORMS)

    def test_child_safe_covers_sonar_and_blitz_allowlists(self):
        """The child-safe policy is at least as permissive as every top-level
        read/research allowlist: a child is never held to a narrower mode set."""
        self.assertTrue(SONAR_ALLOWED_TOOLS <= CHILD_SAFE_ALLOWED_TOOLS)
        self.assertEqual(BLITZ_DIRECT_ALLOWED_TOOLS, CHILD_SAFE_ALLOWED_TOOLS)


class RoleProvenanceIntegrationTests(HookTestBase):
    """Requested roles arrive at Maestria as Hermes' EFFECTIVE native role.

    Hermes normalizes the caller's requested role BEFORE invoking
    subagent_start (tools/delegate_tool.py _normalize_role: strip +
    lowercase, unknown/empty values coerce to "leaf"; the effective role
    is then threaded to the hook's child_role kwarg).  Maestria therefore
    never sees the original requested string and validates only the exact
    effective native topology role - it is NOT claimed that Maestria
    rejects the original strings, because in the real path they arrive
    normalized.

    These tests exercise the delegation construction path Hermes uses:
    requested role -> effective native role -> real _on_subagent_start ->
    trust state -> tool policy.  The normalization step is Hermes' real
    delegate_tool._normalize_role when the install tree is importable
    (HERMES_AGENT_ROOT or ~/.hermes/hermes-agent); otherwise the
    documented replica is used so the contract is still exercised in CI.
    Spawning a real Hermes subagent would require a running agent runtime,
    so the path is simulated up to the real handler.
    """

    def _delegate_child(self, session_id: object, requested_role: object) -> str:
        """Simulate Hermes' delegation construction path and register the
        child through the REAL subagent_start handler.

        Normalizes the requested role to its effective native role exactly
        as delegate_task does, then invokes _on_subagent_start with the
        effective role.  Returns the effective role that reached Maestria.
        """
        effective = _effective_native_role(requested_role)
        _on_subagent_start(child_session_id=session_id, child_role=effective)
        self.cleanup_trust(session_id)
        return effective

    def _assert_child_safe_policy(self, session_id: object, mode: str = "fein") -> None:
        """Assert the fixed role-neutral child policy end to end: every
        CHILD_SAFE_ALLOWED_TOOLS tool allows, every child-forbidden tool
        blocks, in the given mode."""
        hook = self.make_hook(mode)
        for tool_name in sorted(CHILD_SAFE_ALLOWED_TOOLS):
            with self.subTest(mode=mode, tool_name=tool_name, expect="allow"):
                self.assertIsNone(hook(tool_name=tool_name, session_id=session_id))
        for tool_name in sorted(_CHILD_FORBIDDEN_TOOLS):
            with self.subTest(mode=mode, tool_name=tool_name, expect="block"):
                self.assertEqual(
                    hook(tool_name=tool_name, session_id=session_id)["action"],
                    "block",
                )

    def test_requested_builder_padded_and_LEAF_arrive_as_effective_leaf(self):
        """Requested 'builder', padded, and 'LEAF' inputs all arrive as the
        effective native role 'leaf' (Hermes normalizes before
        subagent_start) and receive the SAME role-neutral child policy:
        read/research/LLM only, never a specialist mapping, never writes."""
        requested_roles = ("builder", " LEAF ", "LEAF")
        for i, requested_role in enumerate(requested_roles):
            sid = f"provenance-leaf-{i}"
            with self.subTest(requested_role=requested_role):
                effective = self._delegate_child(sid, requested_role)
                self.assertEqual(effective, "leaf")
                self.assertEqual(get_trust_state(sid), TRUSTED_CHILD)
                self.assertEqual(get_child_topology_role(sid), "leaf")
                self._assert_child_safe_policy(sid)

    def test_requested_orchestrator_variants_arrive_as_effective_role(self):
        """Requested 'orchestrator' / padded variants arrive as the
        effective native role 'orchestrator' and get the SAME role-neutral
        policy as a leaf child (no orchestrator-specific capability)."""
        for i, requested_role in enumerate(("orchestrator", " Orchestrator ")):
            sid = f"provenance-orch-{i}"
            with self.subTest(requested_role=requested_role):
                effective = self._delegate_child(sid, requested_role)
                self.assertEqual(effective, "orchestrator")
                self.assertEqual(get_trust_state(sid), TRUSTED_CHILD)
                self.assertEqual(get_child_topology_role(sid), "orchestrator")
                self._assert_child_safe_policy(sid)

    def test_effective_role_never_grants_write_in_any_mode(self):
        """Every requested-role input - leaf and orchestrator variants -
        yields a child that can never write, run a shell, delegate, or
        route to OpenCode in ANY mode: the fixed policy is mode-neutral."""
        for mode in ("fein", "sonar", "blitz"):
            for i, requested_role in enumerate(("builder", " LEAF ", "LEAF", "orchestrator")):
                sid = f"prov-mode-{mode}-{i}"
                with self.subTest(mode=mode, requested_role=requested_role):
                    self._delegate_child(sid, requested_role)
                    self.assertEqual(get_trust_state(sid), TRUSTED_CHILD)
                    self._assert_child_safe_policy(sid, mode=mode)

    def test_hermes_normalize_role_contract_when_importable(self):
        """When Hermes' install tree is importable, its real
        delegate_tool._normalize_role is verified to match the documented
        replica for every role input used by the plugin.

        Skipped when the external Hermes package cannot be invoked (no
        install tree, or its runtime deps are absent) - the replica
        fallback in the other tests covers the same contract."""
        real = _real_hermes_normalize_role()
        if real is None:
            self.skipTest(
                "Hermes install tree not importable here (set HERMES_AGENT_ROOT "
                "or install ~/.hermes/hermes-agent with its runtime deps); the "
                "documented replica covered the normalization contract instead."
            )
        for requested in (
            "builder", " LEAF ", "LEAF", "orchestrator", " Orchestrator ",
            "builder x", "leaf", None, "", 7, True,
        ):
            with self.subTest(requested_role=repr(requested)):
                self.assertEqual(
                    real(requested),
                    _replica_hermes_normalize_role(requested),
                )


class _FakeCtx:
    """Minimal stand-in for Hermes' plugin registration context."""

    def __init__(self):
        self.hooks = {}
        self.tools = {}
        self.middleware = {}
        self.commands = {}
        self.skills = {}

    def register_hook(self, name, hook):
        self.hooks[name] = hook

    def register_tool(self, **kwargs):
        self.tools[kwargs.get("name")] = kwargs

    def register_middleware(self, name, middleware):
        self.middleware[name] = middleware

    def register_command(self, name, handler, **kwargs):
        self.commands[name] = handler

    def register_skill(self, name, path):
        self.skills[name] = path


class PluginRegistrationTests(unittest.TestCase):
    """register() exposes the plugin's hook/tool/middleware/command
    inventory, and plugin.yaml's provides_hooks EXACTLY matches what
    register() actually registers - an extra manifest hook fails the test
    just like a missing one (no silent drift in either direction)."""

    REGISTERED_HOOKS = (
        "pre_gateway_dispatch",
        "pre_llm_call",
        "pre_tool_call",
        "on_session_start",
        "on_session_end",
        "on_session_finalize",
        "on_session_reset",
        "subagent_start",
        "subagent_stop",
        "transform_tool_result",
    )

    def test_register_exposes_expected_inventory(self):
        from maestria_hermes import register

        home = tempfile.TemporaryDirectory()
        self.addCleanup(home.cleanup)
        with patch.dict(os.environ, {"HERMES_HOME": home.name}, clear=False):
            ctx = _FakeCtx()
            register(ctx)

        self.assertEqual(len(ctx.hooks), len(self.REGISTERED_HOOKS))
        for hook in self.REGISTERED_HOOKS:
            with self.subTest(hook=hook):
                self.assertIn(hook, ctx.hooks)
        self.assertIn("opencode_route", ctx.tools)
        self.assertIn("llm_execution", ctx.middleware)
        for cmd in ("fein", "sonar", "blitz", "mode", "review", "plan"):
            with self.subTest(cmd=cmd):
                self.assertIn(cmd, ctx.commands)

    def test_plugin_yaml_provides_hooks_matches_register_exactly(self):
        """plugin.yaml's provides_hooks list must EQUAL the runtime hook
        inventory: parsing both sets and asserting equality rejects extra
        manifest hooks (unregistered hooks advertised to Hermes) just as
        it rejects missing ones (hooks registered but never advertised)."""
        pkg_root = pathlib.Path(__file__).resolve().parent.parent
        yaml_text = (pkg_root / "plugin.yaml").read_text(encoding="utf-8")
        manifest_hooks = set()
        in_hooks = False
        for raw_line in yaml_text.splitlines():
            line = raw_line.strip()
            if line.startswith("provides_hooks:"):
                in_hooks = True
                continue
            if line.startswith("provides_middleware:"):
                in_hooks = False
                continue
            if in_hooks and line.startswith("- "):
                manifest_hooks.add(line[2:].strip())
        self.assertTrue(manifest_hooks, "provides_hooks list not parsed")

        from maestria_hermes import register

        home = tempfile.TemporaryDirectory()
        self.addCleanup(home.cleanup)
        with patch.dict(os.environ, {"HERMES_HOME": home.name}, clear=False):
            ctx = _FakeCtx()
            register(ctx)
        runtime_hooks = set(ctx.hooks)

        self.assertEqual(manifest_hooks, runtime_hooks)


if __name__ == "__main__":
    unittest.main()
