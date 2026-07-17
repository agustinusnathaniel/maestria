"""Hook implementations for the maestria methodology plugin."""

from maestria_hermes.hooks.pre_gateway import create_pre_gateway_hook
from maestria_hermes.hooks.pre_llm import create_pre_llm_hook
from maestria_hermes.hooks.pre_tool import create_pre_tool_hook
from maestria_hermes.hooks.transform import create_transform_tool_result_hook

__all__ = [
    "create_pre_gateway_hook",
    "create_pre_llm_hook",
    "create_pre_tool_hook",
    "create_transform_tool_result_hook",
]
