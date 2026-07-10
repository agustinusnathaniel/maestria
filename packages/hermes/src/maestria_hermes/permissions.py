"""Permission profiles for each maestria specialist.

Each profile defines allowed and blocked tools per specialist role.
The pre_tool_call hook checks the current specialist's profile and
blocks disallowed tools.
"""

from __future__ import annotations
from typing import Set, Optional

# -- Tool categories ---------------------------------------------------------

_READ_TOOLS: Set[str] = {
    "read", "read_file", "glob", "grep", "search_files",
    "list", "ls", "stat", "file_info",
}

_WRITE_TOOLS: Set[str] = {
    "write", "write_file", "edit", "edit_file", "patch",
    "create", "delete", "delete_file", "rename", "rename_file",
    "mkdir", "make_directory", "move", "copy",
}

_BASH_TOOLS: Set[str] = {
    "bash", "terminal", "shell", "run",
    "process", "command",
}

_LLM_TOOLS: Set[str] = {
    "complete", "complete_structured",
    "think", "reason",
}

_CODING_TOOLS: Set[str] = {
    "delegate_task",  # Subagent dispatch
    "opencode",       # OpenCode CLI routing
}

_BROWSER_TOOLS: Set[str] = {
    "webfetch", "web_search", "web_extract",
    "browser_navigate", "browser_click", "browser_screenshot",
    "browser_evaluate",
}

_DATA_TOOLS: Set[str] = {
    "code_execution", "execute_code", "python_repl",
    "jupyter", "notebook",
}


# -- Specialist profiles -----------------------------------------------------

class PermissionProfile:
    """Tool permissions for one specialist role."""

    def __init__(
        self,
        name: str,
        allowed: Optional[Set[str]] = None,
        blocked: Optional[Set[str]] = None,
        allow_read: bool = True,
        allow_write: bool = False,
        allow_bash: bool = False,
        allow_llm: bool = True,
        allow_coding: bool = False,
        allow_browser: bool = False,
        allow_data: bool = False,
    ):
        self.name = name
        self._allowed = allowed or set()
        self._blocked = blocked or set()
        self._allow_read = allow_read
        self._allow_write = allow_write
        self._allow_bash = allow_bash
        self._allow_llm = allow_llm
        self._allow_coding = allow_coding
        self._allow_browser = allow_browser
        self._allow_data = allow_data

    def is_tool_allowed(self, tool_name: str) -> bool:
        """Check if a tool is allowed for this specialist."""
        # Explicit block takes precedence
        if tool_name in self._blocked:
            return False
        # Explicit allow overrides category rules
        if tool_name in self._allowed:
            return True
        # Category checks
        if tool_name in _READ_TOOLS and self._allow_read:
            return True
        if tool_name in _WRITE_TOOLS and self._allow_write:
            return True
        if tool_name in _BASH_TOOLS and self._allow_bash:
            return True
        if tool_name in _LLM_TOOLS and self._allow_llm:
            return True
        if tool_name in _CODING_TOOLS and self._allow_coding:
            return True
        if tool_name in _BROWSER_TOOLS and self._allow_browser:
            return True
        if tool_name in _DATA_TOOLS and self._allow_data:
            return True
        # Default: block
        return False


# -- Predefined profiles -----------------------------------------------------

PROFILES: dict = {
    # Orchestrator: only delegates, no direct execution
    "orchestrator": PermissionProfile(
        name="orchestrator",
        allow_read=False,
        allow_write=False,
        allow_bash=False,
        allow_llm=True,
        allow_coding=True,   # delegate_task
    ),
    # Adventurer: read-only research
    "adventurer": PermissionProfile(
        name="adventurer",
        allow_read=True,
        allow_write=False,
        allow_bash=False,
        allow_llm=True,
        allow_browser=True,
    ),
    # Architect: research + LLM reasoning
    "architect": PermissionProfile(
        name="architect",
        allow_read=True,
        allow_write=False,
        allow_bash=False,
        allow_llm=True,
        allow_browser=True,
    ),
    # Builder: full access for implementation
    "builder": PermissionProfile(
        name="builder",
        allow_read=True,
        allow_write=True,
        allow_bash=True,
        allow_llm=True,
        allow_coding=True,   # delegate_task + OpenCode
        allow_browser=True,
        allow_data=True,
    ),
    # Diagnose: investigation tools + LLM reasoning
    "diagnose": PermissionProfile(
        name="diagnose",
        allow_read=True,
        allow_write=False,
        allow_bash=True,
        allow_llm=True,
        allow_coding=True,   # delegate complex debugging
    ),
    # Planner: read + LLM reasoning
    "planner": PermissionProfile(
        name="planner",
        allow_read=True,
        allow_write=False,
        allow_bash=False,
        allow_llm=True,
    ),
    # Reviewer: read-only validation
    "reviewer": PermissionProfile(
        name="reviewer",
        allow_read=True,
        allow_write=False,
        allow_bash=False,
        allow_llm=True,
    ),
    # Writer: read + LLM + basic bash for grepping
    "writer": PermissionProfile(
        name="writer",
        allow_read=True,
        allow_write=False,  # Writer creates content via LLM, not file tools
        allow_bash=False,
        allow_llm=True,
        allow_browser=True,
    ),
}


def get_profile(role: str) -> PermissionProfile:
    """Get the permission profile for a specialist role."""
    return PROFILES.get(role, PROFILES["orchestrator"])


def block_message(role: str, tool_name: str) -> str:
    """Return a helpful block message when a tool is denied."""
    return (
        f"Tool '{tool_name}' is not allowed for the '{role}' specialist. "
        f"Each specialist has restricted tools. Switch to the appropriate "
        f"specialist or mode for this operation."
    )
