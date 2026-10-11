"""
Modular Tool Registry for Autonomous Document Agents.
Supports runtime tool registration, OpenAI function-calling export,
and safe dispatched execution.
"""

import json
import logging
from typing import Dict, List, Any, Optional, Type
from schema import UnifiedDocument
from agent.base import BaseDocumentTool, ToolResult

logger = logging.getLogger("ToolRegistry")


class DocumentToolRegistry:
    """Central registry and execution dispatcher for all Document Agent tools."""

    def __init__(self):
        self._tools: Dict[str, BaseDocumentTool] = {}

    def register(self, tool: BaseDocumentTool) -> None:
        """Registers a tool instance in the registry."""
        if tool.name in self._tools:
            logger.warning(f"Overwriting previously registered tool: '{tool.name}'")
        self._tools[tool.name] = tool
        logger.debug(f"Registered tool: '{tool.name}'")

    def get_tool(self, name: str) -> Optional[BaseDocumentTool]:
        """Retrieves a registered tool by name."""
        return self._tools.get(name)

    def list_tools(self) -> List[BaseDocumentTool]:
        """Returns all registered tool instances."""
        return list(self._tools.values())

    def get_all_schemas(self) -> List[Dict[str, Any]]:
        """Returns schemas for all registered tools in OpenAI/Qwen function calling format."""
        return [tool.to_schema() for tool in self._tools.values()]

    def format_tools_system_prompt(self) -> str:
        """
        Formats all registered tools into clean markdown specifications
        for models without native structured tool calling APIs.
        """
        lines = ["You have access to the following document inspection tools:\n"]
        for tool in self._tools.values():
            lines.append(f"### Tool: `{tool.name}`")
            lines.append(f"- **Description**: {tool.description}")
            lines.append(f"- **Parameters**: `{json.dumps(tool.parameters)}`\n")
        return "\n".join(lines)

    def execute_tool(self, name: str, doc: UnifiedDocument, **kwargs) -> ToolResult:
        """
        Safely executes a registered tool with argument isolation and exception handling.
        """
        tool = self.get_tool(name)
        if not tool:
            return ToolResult(
                success=False,
                output=None,
                message=f"Error: Tool '{name}' is not registered in the system.",
                metadata={"available_tools": list(self._tools.keys())}
            )

        try:
            return tool.execute(doc, **kwargs)
        except Exception as ex:
            logger.error(f"Execution error in tool '{name}': {ex}", exc_info=True)
            return ToolResult(
                success=False,
                output=None,
                message=f"Exception executing tool '{name}': {str(ex)}",
                metadata={"exception": str(ex)}
            )


# Global singleton instance
_GLOBAL_REGISTRY: Optional[DocumentToolRegistry] = None


def get_default_tool_registry() -> DocumentToolRegistry:
    """Returns the default global tool registry populated with core tools."""
    global _GLOBAL_REGISTRY
    if _GLOBAL_REGISTRY is None:
        _GLOBAL_REGISTRY = DocumentToolRegistry()
        from agent.tools.outline_tool import GetDocumentOutlineTool
        from agent.tools.search_tool import SearchDocumentTool
        from agent.tools.read_section_tool import ReadSectionTool
        from agent.tools.visual_inspector_tool import InspectVisualRegionTool
        from agent.tools.table_inspector_tool import InspectTableTool

        _GLOBAL_REGISTRY.register(GetDocumentOutlineTool())
        _GLOBAL_REGISTRY.register(SearchDocumentTool())
        _GLOBAL_REGISTRY.register(ReadSectionTool())
        _GLOBAL_REGISTRY.register(InspectVisualRegionTool())
        _GLOBAL_REGISTRY.register(InspectTableTool())

    return _GLOBAL_REGISTRY
