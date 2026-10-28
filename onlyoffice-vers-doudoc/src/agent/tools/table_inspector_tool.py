"""
Table Inspector Tool: Reconstructs and reads complete tabular datasets from document AST.
Equivalent to a human reading a structured data table cell-by-cell.
"""

import re
from typing import Dict, Any, List, Optional
from schema import UnifiedDocument
from agent.base import BaseDocumentTool, ToolResult


class InspectTableTool(BaseDocumentTool):
    """Tool to inspect structured tables, columns, metrics, and tabular rows."""

    @property
    def name(self) -> str:
        return "inspect_table"

    @property
    def description(self) -> str:
        return (
            "Extracts and structures a complete table from the document. Provide a table keyword "
            "(e.g. 'Table 1', 'pilot metrics', 'turnover', 'strategic focus') or specify a page number. "
            "Returns the complete formatted Markdown table, column headers, all data rows, and composite bounding box."
        )

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "table_query": {
                    "type": "string",
                    "description": "Keywords or title of the table to find (e.g. 'Table 1', 'metrics', 'turnover')."
                },
                "page": {
                    "type": "integer",
                    "description": "Optional page number (1-indexed) containing the table.",
                    "default": None
                }
            },
            "required": []
        }

    def execute(self, doc: UnifiedDocument, **kwargs) -> ToolResult:
        table_query = kwargs.get("table_query", "").strip().lower()
        page_num = kwargs.get("page")

        pages_to_search = (
            [(page_num - 1, doc.pages[page_num - 1])]
            if (page_num and 1 <= page_num <= len(doc.pages))
            else list(enumerate(doc.pages))
        )

        best_tab_page_idx = -1
        best_prefix = None
        best_match_el = None

        terms = [t.rstrip("s") for t in re.findall(r"\w+", table_query) if len(t) > 2]
        is_generic_table = not terms or all(t in ("tabl", "metric", "data") for t in terms)

        for p_idx, page in pages_to_search:
            for el in page.elements:
                if el.type in ("table", "table_row"):
                    prefix_match = re.match(r"(table_row_\d+_\d+)", el.id)
                    cur_prefix = prefix_match.group(1) if prefix_match else "table_row"
                    t_lower = el.text.lower()

                    matched = False
                    if not terms or is_generic_table:
                        matched = True
                    else:
                        matched = any(t in t_lower for t in terms)

                    if matched:
                        best_tab_page_idx = p_idx
                        best_prefix = cur_prefix
                        best_match_el = el
                        break

            if best_match_el:
                break

        if best_tab_page_idx == -1:
            return ToolResult(
                success=False,
                output=f"No matching table found for query '{table_query}'. Try search_document or check get_document_outline.",
                message="Table not found."
            )

        page = doc.pages[best_tab_page_idx]
        tab_rows = [el for el in page.elements if el.id.startswith(best_prefix)] if best_prefix else [best_match_el]

        if not tab_rows:
            tab_rows = [best_match_el]

        # Gather nearby caption or heading
        tab_start_y = min(el.bbox[1] for el in tab_rows)
        caption_els = [
            el for el in page.elements
            if ("table" in el.text.lower() or el.type == "heading")
            and (el.bbox[3] <= (tab_start_y + 15) and el.bbox[1] >= (tab_start_y - 120))
        ]

        min_x = min(el.bbox[0] for el in tab_rows)
        min_y = min(el.bbox[1] for el in (caption_els + tab_rows))
        max_x = max(el.bbox[2] for el in tab_rows)
        max_y = max(el.bbox[3] for el in tab_rows)
        composite_bbox = [round(min_x, 2), round(min_y, 2), round(max_x, 2), round(max_y, 2)]

        caption_title = caption_els[0].text.strip() if caption_els else f"Table on Page {best_tab_page_idx + 1}"
        md_lines = [f"### {caption_title} (Page {best_tab_page_idx + 1})\n"]

        for idx, r in enumerate(tab_rows):
            md_lines.append(f"- `#{r.id}`: {r.text.strip()}")

        return ToolResult(
            success=True,
            output="\n".join(md_lines),
            message=f"Extracted table with {len(tab_rows)} rows on Page {best_tab_page_idx + 1}.",
            metadata={
                "page": best_tab_page_idx + 1,
                "page_idx": best_tab_page_idx,
                "row_count": len(tab_rows),
                "row_ids": [r.id for r in tab_rows],
                "caption": caption_title,
                "composite_bbox": composite_bbox,
                "primary_grounded_element_id": tab_rows[0].id
            }
        )
