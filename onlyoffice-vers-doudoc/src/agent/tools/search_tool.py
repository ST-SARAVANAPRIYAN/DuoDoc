"""
Search Tool: Semantic & keyword search across all document AST elements.
Equivalent to a human using Ctrl+F to find relevant text passages.
"""

import re
from typing import Dict, Any, List
from schema import UnifiedDocument
from agent.base import BaseDocumentTool, ToolResult


class SearchDocumentTool(BaseDocumentTool):
    """Tool to search across document text and layout tokens."""

    @property
    def name(self) -> str:
        return "search_document"

    @property
    def description(self) -> str:
        return (
            "Searches for terms, keywords, or semantic concepts across all pages of the document. "
            "Returns the top matching text snippets, element IDs, page numbers, and bounding boxes. "
            "Use this tool to find specific references, names, numbers, or section titles."
        )

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Keywords or phrase to search for (e.g. 'conclusion', 'turnover rate', 'figure 1')."
                },
                "page": {
                    "type": "integer",
                    "description": "Optional page number (1-indexed) to restrict the search to. Omit to search whole document.",
                    "default": None
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of matching snippets to return (default 5).",
                    "default": 5
                }
            },
            "required": ["query"]
        }

    def execute(self, doc: UnifiedDocument, **kwargs) -> ToolResult:
        query = kwargs.get("query", "").strip()
        target_page = kwargs.get("page")
        max_results = kwargs.get("max_results", 5)

        if not query:
            return ToolResult(
                success=False,
                output="Search query cannot be empty.",
                message="Empty query parameter provided."
            )

        q_lower = query.lower()
        terms = [t for t in re.findall(r"\w+", q_lower) if len(t) > 2]
        if not terms:
            terms = [q_lower]

        scored_matches: List[Dict[str, Any]] = []

        pages_to_search = (
            [(target_page - 1, doc.pages[target_page - 1])]
            if (target_page and 1 <= target_page <= len(doc.pages))
            else list(enumerate(doc.pages))
        )

        for p_idx, page in pages_to_search:
            for el in page.elements:
                t_lower = el.text.lower()
                if not t_lower.strip():
                    continue

                score = 0.0
                # Exact phrase match bonus
                if q_lower in t_lower:
                    score += 15.0

                # Term overlap
                for term in terms:
                    if re.search(r"\b" + re.escape(term) + r"\b", t_lower):
                        score += 5.0
                    elif term in t_lower:
                        score += 2.0

                # Heading / structure weighting
                if el.type == "heading" and score > 0:
                    score *= 1.5

                if score > 0:
                    scored_matches.append({
                        "score": score,
                        "page": p_idx + 1,
                        "element_id": el.id,
                        "type": el.type,
                        "text": el.text.strip(),
                        "bbox": el.bbox
                    })

        scored_matches.sort(key=lambda x: x["score"], reverse=True)
        top_matches = scored_matches[:max_results]

        if not top_matches:
            return ToolResult(
                success=True,
                output=f"No direct text matches found for query: '{query}'. Try searching for broader terms or use get_document_outline.",
                message=f"Zero matches found for '{query}'.",
                metadata={"query": query, "matches_count": 0}
            )

        markdown_lines = [f"### Search Results for: '{query}'\n"]
        for idx, m in enumerate(top_matches, start=1):
            snippet = m["text"][:160] + ("..." if len(m["text"]) > 160 else "")
            markdown_lines.append(
                f"{idx}. **Page {m['page']}** (ID: `{m['element_id']}`, Type: `{m['type']}`, Score: {m['score']:.1f}):\n"
                f"   > \"{snippet}\"\n"
            )

        return ToolResult(
            success=True,
            output="\n".join(markdown_lines),
            message=f"Found {len(top_matches)} matches for '{query}'.",
            metadata={
                "query": query,
                "matches_count": len(top_matches),
                "top_matches": top_matches
            }
        )
