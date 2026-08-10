"""Permission allowlists for the maestria Hermes plugin.

Trust is a lifecycle concern (see session.py); this module owns the
literal, immutable tool allowlists that bound what a trusted caller may
invoke:

- ``SONAR_ALLOWED_TOOLS`` - read/research tools for sonar mode.
- ``BLITZ_DIRECT_ALLOWED_TOOLS`` - read/research/LLM tools for trusted
  top-level sessions in blitz mode.
- ``CHILD_SAFE_ALLOWED_TOOLS`` - the fixed role-neutral policy applied to
  every delegated child session (read/research/LLM only).  Hermes' native
  child roles (``leaf`` / ``orchestrator``) are topology signals only; they
  never grant a delegated child write, shell, code-execution, delegation,
  or OpenCode capability.

These are SAFETY-CRITICAL allowlists: they are written as literal immutable
frozensets and deliberately NOT derived from TOOL_CATEGORIES.  Deriving
them would let a future category addition silently widen what a caller may
use without a review pass.  TOOL_CATEGORIES remains only a documented
reference grouping of Hermes tool names; the allowlists must be edited (and
re-reviewed) by hand.
"""

from __future__ import annotations

from typing import Dict, Set

# -- Canonical tool category definitions -----------------------------------
# Documented reference grouping of Hermes tool names.  This is NOT used to
# derive the allowlists below (see module docstring).  Update when Hermes
# adds or renames tools so the reference stays accurate.

TOOL_CATEGORIES: Dict[str, Set[str]] = {
    "read": {
        "read", "read_file", "glob", "grep", "search_files",
        "list", "ls", "stat", "file_info",
    },
    "write": {
        "write", "write_file", "edit", "edit_file", "patch",
        "create", "delete", "delete_file", "rename", "rename_file",
        "mkdir", "make_directory", "move", "copy",
    },
    "bash": {
        "bash", "terminal", "shell", "run",
        "process", "command",
    },
    "llm": {
        "complete", "complete_structured",
        "think", "reason",
    },
    "coding": {
        "delegate_task",   # Subagent dispatch
        "opencode",        # OpenCode CLI routing
        "opencode_route",  # Registered OpenCode routing tool
    },
    "browser": {
        "webfetch", "web_search", "web_extract",
        "browser_navigate", "browser_click", "browser_screenshot",
        "browser_evaluate",
    },
    "data": {
        "code_execution", "execute_code", "python_repl",
        "jupyter", "notebook",
    },
}

# Native delegated-child roles Hermes passes through the subagent_start
# lifecycle hook.  These are TOPOLOGY signals (which node in the delegation
# tree a child is), not Maestria specialist identities: Hermes only ever
# sets child_role to "orchestrator" (a delegating child) or "leaf" (every
# other child).  No Maestria specialist name appears here; none may be
# added, because a native role string must never grant specialist
# capability.  Literal and immutable.
NATIVE_CHILD_ROLES = frozenset({"leaf", "orchestrator"})

# Sonar is intentionally narrower than the read/browser categories.  Only
# exact, reviewed tool names that inspect local or remote information belong
# in this set.  In particular, browser interaction tools are excluded because
# click/evaluate operations can mutate external state.
SONAR_ALLOWED_TOOLS = frozenset(
    {
        "read",
        "read_file",
        "glob",
        "grep",
        "search_files",
        "list",
        "ls",
        "stat",
        "file_info",
        "webfetch",
        "web_search",
        "web_extract",
    }
)

# A trusted top-level Hermes session in blitz may explain, inspect, and
# research, but it cannot invoke an unreviewed or potentially mutating tool.
# Keep this positive allowlist exact so new tools fail closed.
BLITZ_DIRECT_ALLOWED_TOOLS = frozenset(
    {
        "read",
        "read_file",
        "glob",
        "grep",
        "search_files",
        "list",
        "ls",
        "stat",
        "file_info",
        "complete",
        "complete_structured",
        "think",
        "reason",
        "webfetch",
        "web_search",
        "web_extract",
    }
)

# The fixed role-neutral policy applied to EVERY delegated child session,
# regardless of mode or the specialist name the orchestrator routed to.
# A delegated child may read/research and reason; it cannot write, run a
# shell, execute code, delegate further, or invoke OpenCode
# (opencode / opencode_route).  This is the approved conservative child
# trust policy (ADR-HM-002): Hermes' native child roles are topology
# signals only and provide no authenticated capability channel, so no
# child is ever granted specialist write capability.
CHILD_SAFE_ALLOWED_TOOLS = frozenset(
    {
        "read",
        "read_file",
        "glob",
        "grep",
        "search_files",
        "list",
        "ls",
        "stat",
        "file_info",
        "complete",
        "complete_structured",
        "think",
        "reason",
        "webfetch",
        "web_search",
        "web_extract",
    }
)
