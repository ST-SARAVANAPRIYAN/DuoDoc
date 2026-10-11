"""
Unit Tests for Autonomous Document Agent and Tool Subsystem
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from schema import UnifiedDocument, DocumentPage, DocumentElement, ElementStyle
from agent.base import BaseDocumentTool, ToolResult
from agent.registry import DocumentToolRegistry, get_default_tool_registry
from agent.tools.outline_tool import GetDocumentOutlineTool
from agent.tools.search_tool import SearchDocumentTool
from agent.tools.read_section_tool import ReadSectionTool
from agent.tools.table_inspector_tool import InspectTableTool
from agent.orchestrator import DocumentAgentOrchestrator


@pytest.fixture
def sample_unified_doc():
    """Creates a mock UnifiedDocument with sections, paragraphs, and tables."""
    page1 = DocumentPage(
        page_id=0,
        width=612.0,
        height=792.0,
        elements=[
            DocumentElement(
                id="heading_0_0",
                type="heading",
                page=0,
                bbox=[50.0, 50.0, 300.0, 75.0],
                text="1. Introduction to Multimodal AI",
                style=ElementStyle(font_size=18.0, bold=True)
            ),
            DocumentElement(
                id="paragraph_0_1",
                type="paragraph",
                page=0,
                bbox=[50.0, 85.0, 550.0, 140.0],
                text="Document understanding requires fusing text, layout coordinates, and visual features.",
                style=ElementStyle(font_size=11.0)
            )
        ]
    )

    page2 = DocumentPage(
        page_id=1,
        width=612.0,
        height=792.0,
        elements=[
            DocumentElement(
                id="heading_1_0",
                type="heading",
                page=1,
                bbox=[50.0, 50.0, 200.0, 70.0],
                text="6. Conclusion",
                style=ElementStyle(font_size=16.0, bold=True)
            ),
            DocumentElement(
                id="paragraph_1_1",
                type="paragraph",
                page=1,
                bbox=[50.0, 80.0, 550.0, 130.0],
                text="The evolution of our system establishes autonomous document intelligence.",
                style=ElementStyle(font_size=11.0)
            ),
            DocumentElement(
                id="table_row_1_0_0",
                type="table_row",
                page=1,
                bbox=[60.0, 200.0, 500.0, 230.0],
                text="Metric | Value | Target",
                style=ElementStyle(bold=True)
            ),
            DocumentElement(
                id="table_row_1_0_1",
                type="table_row",
                page=1,
                bbox=[60.0, 230.0, 500.0, 260.0],
                text="Turnover | 25% | 12%",
                style=ElementStyle()
            )
        ]
    )

    return UnifiedDocument(
        document_id="doc_mock_test",
        pages=[page1, page2]
    )


def test_tool_registry():
    registry = DocumentToolRegistry()
    assert len(registry.list_tools()) == 0

    outline_tool = GetDocumentOutlineTool()
    registry.register(outline_tool)
    assert len(registry.list_tools()) == 1
    assert registry.get_tool("get_document_outline") is outline_tool

    schemas = registry.get_all_schemas()
    assert len(schemas) == 1
    assert schemas[0]["function"]["name"] == "get_document_outline"

    # Test error handling on non-existent tool
    res = registry.execute_tool("unknown_tool", None)
    assert res.success is False
    assert "not registered" in res.message


def test_outline_tool(sample_unified_doc):
    tool = GetDocumentOutlineTool()
    res = tool.execute(sample_unified_doc)

    assert res.success is True
    assert "Document Outline" in res.output
    assert "1. Introduction to Multimodal AI" in res.output
    assert "6. Conclusion" in res.output
    assert res.metadata["total_pages"] == 2
    assert res.metadata["items_count"] >= 2


def test_search_tool(sample_unified_doc):
    tool = SearchDocumentTool()
    res = tool.execute(sample_unified_doc, query="evolution")

    assert res.success is True
    assert res.metadata["matches_count"] >= 1
    assert "Page 2" in res.output
    assert "heading_1_0" in res.output or "paragraph_1_1" in res.output


def test_read_section_tool(sample_unified_doc):
    tool = ReadSectionTool()
    # Test reading by title
    res = tool.execute(sample_unified_doc, section_title="Conclusion")

    assert res.success is True
    assert "6. Conclusion" in res.output
    assert "The evolution of our system" in res.output
    assert res.metadata["heading_id"] == "heading_1_0"
    assert res.metadata["page"] == 2
    assert len(res.metadata["composite_bbox"]) == 4

    # Test reading by element ID
    res2 = tool.execute(sample_unified_doc, element_id="heading_0_0")
    assert res2.success is True
    assert "1. Introduction to Multimodal AI" in res2.output
    assert res2.metadata["page"] == 1


def test_inspect_table_tool(sample_unified_doc):
    tool = InspectTableTool()
    res = tool.execute(sample_unified_doc, table_query="turnover")

    assert res.success is True
    assert "Turnover | 25% | 12%" in res.output
    assert res.metadata["page"] == 2
    assert res.metadata["row_count"] == 2


def test_orchestrator_initialization():
    orchestrator = DocumentAgentOrchestrator()
    assert orchestrator.registry is not None
    assert orchestrator.registry.get_tool("get_document_outline") is not None
    assert orchestrator.registry.get_tool("search_document") is not None
    assert orchestrator.registry.get_tool("read_section") is not None
    assert orchestrator.registry.get_tool("inspect_table") is not None
    assert orchestrator.registry.get_tool("inspect_visual_region") is not None


def test_figure_target_resolution():
    """Verifies that _resolve_figure_target discriminates captions and excludes header logos."""
    # Page 1: Header logo + generic title text mentioning 'feature importance'
    p1 = DocumentPage(
        page_id=0,
        width=612.0,
        height=792.0,
        elements=[
            DocumentElement(
                id="logo_0",
                type="image",
                page=0,
                bbox=[50.0, 30.0, 150.0, 70.0],  # Header logo (top y < 150, h < 80)
                text="[Embedded Figure / Architecture Diagram]"
            ),
            DocumentElement(
                id="title_0",
                type="heading",
                page=0,
                bbox=[50.0, 100.0, 500.0, 140.0],
                text="Explainable Recommendations and Feature Importance in Modern Systems"
            )
        ]
    )

    # Page 2: True Figure 5 diagram + caption directly below
    p2 = DocumentPage(
        page_id=1,
        width=612.0,
        height=792.0,
        elements=[
            DocumentElement(
                id="fig5_img",
                type="image",
                page=1,
                bbox=[100.0, 150.0, 500.0, 350.0],
                text="[Embedded Figure / Architecture Diagram]"
            ),
            DocumentElement(
                id="fig5_caption",
                type="heading",
                page=1,
                bbox=[100.0, 360.0, 500.0, 380.0],
                text="Figure 5: Feature Importance Attribution for Explainable Recommendations"
            )
        ]
    )

    doc = UnifiedDocument(document_id="doc_fig_test", pages=[p1, p2])
    orchestrator = DocumentAgentOrchestrator()

    # Query for Figure 5
    match = orchestrator._resolve_figure_target(doc, "could you explain the 'Figure 5: Feature Importance Attribution for Explainable Recommendations'")
    assert match is not None
    assert match["page"] == 2
    assert match["image_id"] == "fig5_img"
    assert match["caption_id"] == "fig5_caption"
    assert match["composite_bbox"] == [100.0, 150.0, 500.0, 380.0]

    # Cognitive plan should route directly to inspect_visual_region on Page 2
    plan = orchestrator._plan_cognitive_action(doc, "explain Figure 5", target_page_hint=0)
    assert plan["tool"] == "inspect_visual_region"
    assert plan["args"]["page"] == 2
    assert plan["args"]["element_id"] == "fig5_img"
    assert plan["args"]["bbox"] == [100.0, 150.0, 500.0, 380.0]
