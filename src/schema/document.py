"""
Unified Document Model (Schema)
Implements Slide 10 (Stages 2 & 4: Structural Representation and Unified Document Model).

Defines an abstract syntax tree (AST) representation for office documents (DOCX, PDF),
capturing semantic types, typographic styles, spatial coordinates, and hierarchical relations.
"""

import json
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Tuple


@dataclass
class ElementStyle:
    font_size: int = 12
    font_family: str = "Inter"
    bold: bool = False
    italic: bool = False
    underline: bool = False
    strikethrough: bool = False
    color: str = "#0F172A"
    alignment: str = "left"  # "left", "center", "right", "justify"
    line_spacing: float = 1.15
    letter_spacing: float = 0.0  # letter spacing / tracking offset in pt
    indent: float = 0.0  # left indentation in pt
    highlight: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ElementStyle":
        if not data:
            return cls()
        return cls(
            font_size=data.get("font_size", 12),
            font_family=data.get("font_family", "Inter"),
            bold=data.get("bold", False),
            italic=data.get("italic", False),
            underline=data.get("underline", False),
            strikethrough=data.get("strikethrough", False),
            color=data.get("color", "#0F172A"),
            alignment=data.get("alignment", "left"),
            line_spacing=float(data.get("line_spacing", 1.15)),
            letter_spacing=float(data.get("letter_spacing", 0.0)),
            indent=float(data.get("indent", 0.0)),
            highlight=data.get("highlight", False)
        )


@dataclass
class DocumentElement:
    id: str
    type: str  # "heading", "paragraph", "table", "table_row", "table_cell", "image", "chart"
    page: int
    bbox: List[float]  # [x1, y1, x2, y2] in points / pixels
    text: str = ""
    style: ElementStyle = field(default_factory=ElementStyle)
    parent_id: Optional[str] = None
    children_ids: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["style"] = self.style.to_dict() if isinstance(self.style, ElementStyle) else self.style
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DocumentElement":
        style_data = data.get("style", {})
        style_obj = ElementStyle.from_dict(style_data) if isinstance(style_data, dict) else style_data
        return cls(
            id=data["id"],
            type=data["type"],
            page=data.get("page", 0),
            bbox=data.get("bbox", [0.0, 0.0, 0.0, 0.0]),
            text=data.get("text", ""),
            style=style_obj,
            parent_id=data.get("parent_id"),
            children_ids=data.get("children_ids", []),
            metadata=data.get("metadata", {})
        )

    @property
    def width(self) -> float:
        return max(0.0, self.bbox[2] - self.bbox[0])

    @property
    def height(self) -> float:
        return max(0.0, self.bbox[3] - self.bbox[1])


@dataclass
class DocumentPage:
    page_id: int
    width: float = 800.0
    height: float = 1000.0
    elements: List[DocumentElement] = field(default_factory=list)
    image_path: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "page_id": self.page_id,
            "width": self.width,
            "height": self.height,
            "elements": [el.to_dict() for el in self.elements],
            "image_path": self.image_path
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DocumentPage":
        return cls(
            page_id=data.get("page_id", 0),
            width=data.get("width", 800.0),
            height=data.get("height", 1000.0),
            elements=[DocumentElement.from_dict(el) for el in data.get("elements", [])],
            image_path=data.get("image_path")
        )

    def find_element(self, element_id: str) -> Optional[DocumentElement]:
        for el in self.elements:
            if el.id == element_id:
                return el
        return None


@dataclass
class UnifiedDocument:
    document_id: str
    pages: List[DocumentPage] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "document_id": self.document_id,
            "pages": [p.to_dict() for p in self.pages],
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UnifiedDocument":
        return cls(
            document_id=data["document_id"],
            pages=[DocumentPage.from_dict(p) for p in data.get("pages", [])],
            metadata=data.get("metadata", {})
        )

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> "UnifiedDocument":
        data = json.loads(json_str)
        return cls.from_dict(data)

    def find_element(self, element_id: str) -> Optional[Tuple[int, DocumentElement]]:
        for p_idx, page in enumerate(self.pages):
            el = page.find_element(element_id)
            if el is not None:
                return (p_idx, el)
        return None

    def validate_integrity(self) -> Tuple[bool, List[str]]:
        """
        Validates internal consistency:
        - Unique element IDs
        - Coordinate boundaries within page width/height
        """
        errors = []
        seen_ids = set()

        for page in self.pages:
            for el in page.elements:
                if el.id in seen_ids:
                    errors.append(f"Duplicate element ID detected: '{el.id}'")
                seen_ids.add(el.id)

                x1, y1, x2, y2 = el.bbox
                if x1 > x2 or y1 > y2:
                    errors.append(f"Invalid bounding box for '{el.id}': [{x1}, {y1}, {x2}, {y2}]")
                if x2 > page.width or y2 > page.height:
                    errors.append(f"Element '{el.id}' exceeds page bounds [{page.width}, {page.height}]")

        return (len(errors) == 0, errors)
