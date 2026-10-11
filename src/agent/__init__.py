"""
Autonomous Multimodal Document Agent Subsystem.
Provides extensible tools, registry, and cognitive ReAct orchestrator.
"""

from agent.base import BaseDocumentTool, ToolResult
from agent.registry import DocumentToolRegistry, get_default_tool_registry
from agent.orchestrator import DocumentAgentOrchestrator

__all__ = [
    "BaseDocumentTool",
    "ToolResult",
    "DocumentToolRegistry",
    "get_default_tool_registry",
    "DocumentAgentOrchestrator"
]
