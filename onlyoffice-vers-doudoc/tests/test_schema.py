"""
Unit Tests for Unified Document Schema & Canvas Renderer
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from schema import UnifiedDocument, DocumentPage, DocumentElement, ElementStyle
from render import render_canvas


def test_schema_creation_and_serialization():
    style = ElementStyle(font_size=16, bold=True, alignment="center")
    elem = DocumentElement(
        id="heading_1",
        type="heading",
        page=0,
        bbox=[50.0, 50.0, 750.0, 90.0],
        text="Sample Research Title",
        style=style
    )
    page = DocumentPage(page_id=0, width=800.0, height=1000.0, elements=[elem])
    doc = UnifiedDocument(document_id="doc_test_001", pages=[page])

    # Test dictionary export & reload
    doc_dict = doc.to_dict()
    assert doc_dict["document_id"] == "doc_test_001"
    assert len(doc_dict["pages"]) == 1
    assert doc_dict["pages"][0]["elements"][0]["text"] == "Sample Research Title"

    reloaded = UnifiedDocument.from_dict(doc_dict)
    assert reloaded.document_id == doc.document_id
    assert reloaded.pages[0].elements[0].style.bold is True

    # Test integrity check
    valid, errors = doc.validate_integrity()
    assert valid is True
    assert len(errors) == 0


def test_invalid_coordinates_detection():
    # Inverted bounding box: x1 > x2
    elem = DocumentElement(
        id="elem_bad",
        type="paragraph",
        page=0,
        bbox=[200.0, 100.0, 100.0, 150.0],
        text="Invalid element"
    )
    page = DocumentPage(page_id=0, width=800.0, height=1000.0, elements=[elem])
    doc = UnifiedDocument(document_id="doc_bad", pages=[page])

    valid, errors = doc.validate_integrity()
    assert valid is False
    assert any("Invalid bounding box" in err for err in errors)


def test_canvas_rendering():
    elem1 = DocumentElement(
        id="heading_1",
        type="heading",
        page=0,
        bbox=[60.0, 60.0, 740.0, 100.0],
        text="Quarterly Financial Report",
        style=ElementStyle(font_size=18, bold=True, alignment="center")
    )
    elem2 = DocumentElement(
        id="para_1",
        type="paragraph",
        page=0,
        bbox=[60.0, 120.0, 740.0, 160.0],
        text="The corporate division exceeded target goals.",
        style=ElementStyle(font_size=11, bold=False, alignment="left")
    )
    page = DocumentPage(page_id=0, width=800.0, height=1000.0, elements=[elem1, elem2])
    doc = UnifiedDocument(document_id="doc_render_test", pages=[page])

    img = render_canvas(doc, page_id=0, highlight_elem_id="heading_1", highlight_box_color="#38BDF8")
    assert img.size == (800, 1000)
    assert img.mode == "RGB"
