"""pre_tool_call hook -- enforces the lifecycle trust policy.

Every tool call is classified from trusted native lifecycle state BEFORE
any mode allowlist runs:

- A TRUSTED_CHILD session (delegated child with a valid native topology
  role) gets the fixed role-neutral child policy - CHILD_SAFE_ALLOWED_TOOLS
  - in EVERY mode (fein, sonar, and blitz).  A child is never held to a
  narrower mode allowlist: the approved child policy already includes
  complete/think/reason and web-research tools, and no child ever receives
  write, shell, code-execution, delegation, or OpenCode access.  Mode
  allowlists bound only trusted TOP-LEVEL sessions.
- A trusted top-level session keeps direct policy: unrestricted in fein,
  the literal allowlists in sonar/blitz.
- INVALID_CHILD, UNKNOWN, and ENDED sessions deny ALL tools (fail closed).
- Child state always outranks any task_id == session_id binding.

Top-level trust comes from two independent validated native signals so a
missed lifecycle hook does not lock out a legitimate top-level session:

  1. on_session_start recorded the session as top-level (recognized
     non-child platform), or
  2. the host bound this turn's task_id to the session id (CLI and gateway
     top-level turn paths).  Both values must be validated non-empty string
     identifiers - malformed, non-string, empty, or the literal "unknown"
     sentinel never grant trust.

Malformed tool names (non-string, empty, whitespace-padded, containing
Unicode control/format/separator characters - incl. the C1 range and
zero-width characters - or over-long) block WITHOUT raising: Hermes wraps
each pre_tool_call hook in its own try/except, so an exception would be
swallowed and the tool would proceed unblocked.  The hook must therefore
never raise.  A padded name such as ``" write "`` is REJECTED, never
normalized - the allowlists are exact, and stripping would let surrounding
whitespace smuggle a malformed name past the check.
"""

from __future__ import annotations

import logging

from maestria_hermes.modes import VALID_MODES, ModeManager
from maestria_hermes.permissions import (
    BLITZ_DIRECT_ALLOWED_TOOLS,
    CHILD_SAFE_ALLOWED_TOOLS,
    SONAR_ALLOWED_TOOLS,
)
from maestria_hermes.session import (
    INVALID_CHILD,
    TOP_LEVEL,
    TRUSTED_CHILD,
    UNKNOWN,
    contains_unicode_control,
    get_trust_state,
    is_valid_lifecycle_id,
)

logger = logging.getLogger(__name__)

# Upper bound on a plausible tool name; longer values are treated as
# malformed input rather than a tool to look up.
_MAX_TOOL_NAME_LEN = 256


def _is_malformed_tool_name(tool_name: object) -> bool:
    """Return True when *tool_name* cannot be a real Hermes tool name.

    Non-strings, empty/whitespace-only strings, strings with leading or
    trailing whitespace, strings with Unicode control/format/separator
    characters (``Cc``/``Cf``/``Zl``/``Zp`` - incl. the C1 range
    U+0080-U+009F and zero-width characters), and over-long strings are
    malformed and must be blocked (never raised on).  A padded name such
    as ``" write "`` is rejected here - the check compares the name to its
    stripped form instead of normalizing, so surrounding whitespace can
    never smuggle a name past the allowlist lookup.
    """
    if not isinstance(tool_name, str):
        return True
    if not tool_name:
        return True
    if tool_name != tool_name.strip():
        return True
    if len(tool_name) > _MAX_TOOL_NAME_LEN:
        return True
    if contains_unicode_control(tool_name):
        return True
    return False


def create_pre_tool_hook(mode_manager: ModeManager):
    """Create a pre_tool_call hook closure bound to the given mode manager.

    The caller's trust is classified BEFORE any mode allowlist.  The hook
    never raises: malformed tool names and unexpected payload shapes are
    blocked, and an invalid mode denies all tools.
    """

    def _exact_task_session_binding(session_id: object, task_id: object) -> bool:
        """Return True only for a validated exact task_id == session_id.

        Both values must pass the strict native identifier check (non-empty
        strings with no leading/trailing whitespace, no Unicode
        control/format characters,
        and not the literal "unknown" sentinel - anything else never grants
        trust).  The comparison is exact - equal-ish values of different
        types never bind.
        """
        return (
            is_valid_lifecycle_id(session_id)
            and is_valid_lifecycle_id(task_id)
            and task_id == session_id
        )

    def _block(message: str) -> dict:
        return {"action": "block", "message": message}

    def _top_level_policy(mode: str, tool_name: str) -> None | dict:
        """Direct policy for a trusted top-level session."""
        if mode == "sonar":
            if tool_name not in SONAR_ALLOWED_TOOLS:
                logger.info("sonar mode blocked tool=%s", tool_name)
                return _block(
                    f"Tool '{tool_name}' is blocked in sonar mode. "
                    "Switch to fein or blitz mode to make changes "
                    "(/fein or /blitz)."
                )
            return None
        if mode == "blitz":
            if tool_name not in BLITZ_DIRECT_ALLOWED_TOOLS:
                logger.info("blitz direct session blocked tool=%s", tool_name)
                return _block(
                    f"Tool '{tool_name}' is blocked for direct blitz work. "
                    "Route code changes through a permitted top-level fein session; "
                    "direct blitz work is limited to explanation, discovery, and "
                    "non-code work."
                )
            return None
        return None  # Direct fein session: normal access preserved

    def _child_policy(tool_name: str) -> None | dict:
        """Fixed role-neutral policy for a trusted delegated child.

        CHILD_SAFE_ALLOWED_TOOLS applies in every mode - fein, sonar, and
        blitz alike.  The mode allowlists (SONAR_ALLOWED_TOOLS /
        BLITZ_DIRECT_ALLOWED_TOOLS) bound only trusted top-level sessions;
        a child is never held to a narrower mode set, because the approved
        child policy already includes the complete/think/reason and
        web-research tools.  Write, shell, code execution, delegation, and
        OpenCode access are never available to a child.
        """
        if tool_name not in CHILD_SAFE_ALLOWED_TOOLS:
            logger.info("child-safe policy blocked tool=%s", tool_name)
            return _block(
                f"Tool '{tool_name}' is not available to delegated children. "
                "Delegated children are limited to read, research, and LLM "
                "reasoning tools; they cannot write, run a shell, execute "
                "code, delegate, or route to OpenCode."
            )
        return None

    def pre_tool_hook(tool_name: object, **kwargs) -> None | dict:
        """Block disallowed tools based on lifecycle trust and mode.

        Returns None to allow, or a block dict to deny.  Never raises.
        """
        # Malformed tool names block before anything else, without raising.
        # After this check *tool_name* is a non-empty string with no
        # leading/trailing whitespace and no control/format characters,
        # so it is
        # looked up exactly - it is never stripped or otherwise normalized
        # (a padded name such as " write " was already rejected above).
        if _is_malformed_tool_name(tool_name):
            logger.warning("malformed tool name denied: %r", tool_name)
            return _block("Tool access denied: malformed tool name.")

        tool_name = str(tool_name)

        mode = mode_manager.get_mode()
        if mode not in VALID_MODES:
            logger.warning("invalid maestria mode denied tool=%s mode=%r", tool_name, mode)
            return _block("Tool access denied: invalid maestria mode.")

        session_id = kwargs.get("session_id", "")
        task_id = kwargs.get("task_id", "")

        # Classify the caller BEFORE any mode allowlist.  Child state always
        # outranks any task_id == session_id binding.
        state = get_trust_state(session_id)

        if state == INVALID_CHILD:
            logger.warning("invalid native child role; denying tool=%s", tool_name)
            return _block("Tool access denied: invalid native child role.")

        if state == TRUSTED_CHILD:
            return _child_policy(tool_name)

        # Not a child.  Top-level trust: registry lifecycle binding, or a
        # validated exact task_id == session_id binding for UNKNOWN sessions
        # the lifecycle hook did not record (e.g. resumed sessions in a new
        # process).  ENDED fails closed: an explicitly terminated session
        # never inherits direct access from a coincidental task binding -
        # it must be re-established by a fresh lifecycle event.
        trusted_top_level = state == TOP_LEVEL or (
            state == UNKNOWN
            and _exact_task_session_binding(session_id, task_id)
        )

        if not trusted_top_level:
            logger.warning(
                "untrusted session context; denying tool=%s session=%s state=%s",
                tool_name, session_id, state,
            )
            return _block(
                "Tool access denied: untrusted session context. The session has "
                "no trusted top-level binding and no valid delegated-child trust."
            )

        return _top_level_policy(mode, tool_name)

    return pre_tool_hook
