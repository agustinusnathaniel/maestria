"""Config-driven permission roles for each maestria specialist.

Roles are loaded from ~/.hermes/maestria-roles.json (if present) with
fallback to built-in defaults. Each role defines which tool categories
a specialist can use — the pre_tool_call hook checks these at runtime.

Tool categories map semantic groups to actual Hermes tool names.
Update TOOL_CATEGORIES when Hermes adds or renames tools.
"""

from __future__ import annotations
import json
import os
import logging
from typing import Dict, List, Optional, Set

logger = logging.getLogger(__name__)


# -- Canonical tool category definitions -----------------------------------
# The single source of truth mapping category names to Hermes tool names.
# Update this when Hermes adds/renames tools.

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


# -- Built-in default roles ------------------------------------------------
# Used when no ~/.hermes/maestria-roles.json override exists.

_DEFAULT_ROLE_CATEGORIES: Dict[str, List[str]] = {
    "orchestrator": ["llm", "coding"],            # delegates only
    "adventurer":   ["read", "llm", "browser"],   # research only
    "architect":    ["read", "llm", "browser"],    # design + research
    "builder":      ["read", "write", "bash", "llm", "coding", "browser", "data"],  # full access
    "diagnose":     ["read", "bash", "llm", "coding"],   # investigation
    "planner":      ["read", "llm"],                     # planning only
    "reviewer":     ["read", "llm"],                     # read-only validation
    "writer":       ["read", "llm", "browser"],           # content creation
}


# -- Role class -------------------------------------------------------------

class PermissionRole:
    """Tool permissions for one specialist role, resolved at startup."""

    def __init__(self, name: str, categories: List[str]):
        self.name = name
        self._allowed_tools: Set[str] = set()
        for cat in categories:
            self._allowed_tools |= TOOL_CATEGORIES.get(cat, set())

    def is_tool_allowed(self, tool_name: str) -> bool:
        """Check if a tool is allowed for this specialist."""
        return tool_name in self._allowed_tools


# -- Config loading ---------------------------------------------------------

def _hermes_home() -> str:
    """Get the Hermes home directory."""
    return os.path.expanduser(
        os.environ.get("HERMES_HOME", "~/.hermes")
    )


def _load_roles_override() -> Dict[str, List[str]]:
    """Load role overrides from ~/.hermes/maestria-roles.json.

    Returns a dict of role_name -> category list, or empty dict if the
    file doesn't exist. Validates that all referenced categories exist
    in TOOL_CATEGORIES.
    """
    path = os.path.join(_hermes_home(), "maestria-roles.json")
    try:
        with open(path) as f:
            data = json.load(f)
    except FileNotFoundError:
        return {}
    except (json.JSONDecodeError, PermissionError) as e:
        logger.warning("maestria-roles.json: %s — using defaults", e)
        return {}

    roles = data.get("roles", {})
    if not isinstance(roles, dict):
        logger.warning("maestria-roles.json: 'roles' must be a dict — using defaults")
        return {}

    # Validate categories
    valid = set(TOOL_CATEGORIES.keys())
    cleaned: Dict[str, List[str]] = {}
    for role_name, cats in roles.items():
        if not isinstance(cats, list):
            logger.warning("maestria-roles.json: skipping '%s' — value must be a list", role_name)
            continue
        unknown = [c for c in cats if c not in valid]
        if unknown:
            logger.warning(
                "maestria-roles.json: role '%s' has unknown categories: %s — ignoring them",
                role_name, unknown,
            )
        cleaned[role_name] = [c for c in cats if c in valid]

    return cleaned


def resolve_roles() -> Dict[str, PermissionRole]:
    """Build the final role map: user overrides merged over defaults.

    Users can override individual roles in ~/.hermes/maestria-roles.json
    without having to redefine every role. Roles not mentioned in the
    override file keep their default category lists.
    """
    overrides = _load_roles_override()

    roles: Dict[str, PermissionRole] = {}
    # Start with defaults, apply overrides on top
    merged_categories = dict(_DEFAULT_ROLE_CATEGORIES)
    for role_name, cats in overrides.items():
        merged_categories[role_name] = cats

    for name, cats in merged_categories.items():
        roles[name] = PermissionRole(name=name, categories=cats)

    return roles


# -- Public API -------------------------------------------------------------

# Singleton — resolved once at plugin registration
_ROLES: Dict[str, PermissionRole] = {}

def init_roles() -> None:
    """Initialize the role map. Called once during plugin registration."""
    global _ROLES
    _ROLES = resolve_roles()

def get_role(name: str) -> PermissionRole:
    """Get a permission role by name. Falls back to orchestrator (most restrictive)."""
    return _ROLES.get(name, _ROLES.get("orchestrator", PermissionRole("orchestrator", [])))


def block_message(role: str, tool_name: str) -> str:
    """Return a helpful block message when a tool is denied."""
    return (
        f"Tool '{tool_name}' is not allowed for the '{role}' specialist. "
        f"Each specialist has restricted tools. Switch to the appropriate "
        f"specialist or mode for this operation."
    )
