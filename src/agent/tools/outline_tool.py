"""
Outline Tool: Extracts the global document table of contents, sections, figures, and tables.
Equivalent to a human scanning the document outline.
"""

import re
from typing import Dict, Any, List
from schema import UnifiedDocument
from agent.base import BaseDocumentTool, ToolResult


class GetDocumentOutlineTool(BaseDocumentTool):
    """Tool to inspect the global layout hierarchy across all document pages."""

    @property
    def name(self) -> str:
        return "get_document_outline"

    @property
    def description(self) -> str:
        return (
            "Retrieves the structural outline of the entire document across all pages. "
            "Returns a structured list of sections, headings, tables, and figures with their "
            "page numbers and element IDs. Use this tool first to locate which page and section "
            "contains the information needed to answer the user query."
        )

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "include_tables": {
                    "type": "boolean",
                    "description": "Whether to list detected tables in the outline. Default: true.",
                    "default": True
                },
                "include_figures": {
                    "type": "boolean",
                    "description": "Whether to list detected figures in the outline. Default: true.",
                    "default": True
                }
            },
            "required": []
        }

    def execute(self, doc: UnifiedDocument, **kwargs) -> ToolResult:
        include_tables = kwargs.get("include_tables", True)
        include_figures = kwargs.get("include_figures", True)

        outline_items: List[Dict[str, Any]] = []

        for p_idx, page in enumerate(doc.pages):
            page_num = p_idx + 1

            for el in page.elements:
                t_lower = el.text.lower().strip()

                if el.type == "heading":
                    outline_items.append({
                        "type": "section_heading",
                        "page": page_num,
                        "element_id": el.id,
                        "title": el.text.strip(),
                        "bbox": el.bbox
                    })
                elif include_figures and (el.type == "image" or re.search(r"\bfig(?:ure)?\.?\s*([0-9]+|[ivx]+|[a-z])\b", t_lower)):
                    fig_match = re.search(r"\bfig(?:ure)?\.?\s*([0-9]+|[ivx]+|[a-z])\b", t_lower)
                    fig_label = f"Figure {fig_match.group(1).upper()}" if fig_match else "Embedded Figure"
                    outline_items.append({
                        "type": "figure",
                        "page": page_num,
                        "element_id": el.id,
                        "title": el.text.strip() if len(el.text.strip()) > 3 else fig_label,
                        "bbox": el.bbox
                    })
                elif include_tables and el.type in ("table", "table_row") and (el.id.endswith("_0") or el.id.endswith("_0_0") or "metric" in t_lower or "table" in t_lower):
                    outline_items.append({
                        "type": "table",
                        "page": page_num,
                        "element_id": el.id,
                        "title": el.text.strip()[:60] + "...",
                        "bbox": el.bbox
                    })

        markdown_lines = [f"### Document Outline ({len(doc.pages)} Pages Total)\n"]
        for item in outline_items:
            icon = "📑" if item["type"] == "section_heading" else ("📊" if item["type"] == "table" else "🖼️")
            markdown_lines.append(
                f"- {icon} **[Page {item['page']}]** `{item['element_id']}`: {item['title']}"
            )

        return ToolResult(
            success=True,
            output="\n".join(markdown_lines),
            message=f"Found {len(outline_items)} structural outline anchors across {len(doc.pages)} pages.",
            metadata={
                "total_pages": len(doc.pages),
                "items_count": len(outline_items),
                "items": outline_items
            }
        )
