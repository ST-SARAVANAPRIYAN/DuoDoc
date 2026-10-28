"""
Base Parser Interface
Implements Slide 10: Stage 1 (Document Processing).
"""

from abc import ABC, abstractmethod
from schema import UnifiedDocument


class BaseDocumentParser(ABC):
    """
    Abstract Base Class for heterogeneous document parsers (DOCX, PDF, Images).
    """

    @abstractmethod
    def parse(self, file_path: str) -> UnifiedDocument:
        """
        Parses a document file and converts it into a UnifiedDocument instance.
        """
        pass
