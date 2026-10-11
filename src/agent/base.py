"""
Base abstractions for Autonomous Multimodal Document Tools and Agent execution.
Provides an extensible foundation for adding new document inspection, search,
OCR, calculation, and manipulation tools.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from schema import UnifiedDocument


@dataclass
class ToolResult:
    """Standardized result returned by any Document Agent Tool."""
    success: bool
    output: Any
    message: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "output": self.output,
            "message": self.message,
            "metadata": self.metadata
        }


class BaseDocumentTool(ABC):
    """
    Abstract Base Class for all Multimodal Document Agent Tools.
    Subclasses must define name, description, parameters schema, and execute().
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique identifier for the tool (e.g. 'get_document_outline')."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Human and LLM-readable description of what the tool accomplishes."""
        pass

    @property
    @abstractmethod
    def parameters(self) -> Dict[str, Any]:
        """JSON Schema dictionary describing the expected arguments."""
        pass

    @abstractmethod
    def execute(self, doc: UnifiedDocument, **kwargs) -> ToolResult:
        """
        Executes the tool against the UnifiedDocument AST and returns a ToolResult.
        """
        pass

    def to_schema(self) -> Dict[str, Any]:
        """Exports tool definition in standard OpenAI / Qwen function-calling format."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters
            }
        }
