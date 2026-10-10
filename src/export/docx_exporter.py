"""
Native Microsoft Word (.docx) Document Exporter
Implements Slide 10: Stage 7 (Document Generation).

Serializes modified UnifiedDocument AST models back into fully editable,
native Microsoft Word (.docx) documents preserving styles, alignments, and tables.
"""

import io
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from typing import Optional

from schema import UnifiedDocument, DocumentPage, DocumentElement


ALIGN_MAPPING = {
    "left": WD_ALIGN_PARAGRAPH.LEFT,
    "center": WD_ALIGN_PARAGRAPH.CENTER,
    "right": WD_ALIGN_PARAGRAPH.RIGHT,
    "justify": WD_ALIGN_PARAGRAPH.JUSTIFY
}


COLOR_EXPORT_MAP = {
    "yellow": "#EAB308",
    "gold": "#D97706",
    "amber": "#D97706",
    "red": "#DC2626",
    "blue": "#2563EB",
    "green": "#059669",
    "emerald": "#059669",
    "purple": "#7C3AED",
    "orange": "#EA580C",
    "black": "#0F172A",
    "gray": "#64748B",
    "grey": "#64748B"
}


def hex_to_rgb(hex_str: str) -> Optional[RGBColor]:
    if not hex_str:
        return None
    hex_clean = COLOR_EXPORT_MAP.get(str(hex_str).lower().strip(), str(hex_str).strip())
    if not hex_clean.startswith("#") or len(hex_clean) != 7:
        return None
    try:
        r = int(hex_clean[1:3], 16)
        g = int(hex_clean[3:5], 16)
        b = int(hex_clean[5:7], 16)
        return RGBColor(r, g, b)
    except Exception:
        return None


class DocxDocumentExporter:
    """
    Exports a UnifiedDocument to a native .docx file or in-memory byte stream.
    """

    @staticmethod
    def export_to_stream(doc: UnifiedDocument) -> io.BytesIO:
        """
        Converts the UnifiedDocument into an in-memory BytesIO stream of a .docx file.
        """
        word_doc = Document()

        for page in doc.pages:
            for elem in page.elements:
                style = elem.style
                text = elem.text.strip()
                if not text:
                    continue

                align_enum = ALIGN_MAPPING.get(style.alignment.lower(), WD_ALIGN_PARAGRAPH.LEFT)

                # Headings
                if elem.type == "heading":
                    p = word_doc.add_paragraph()
                    p.alignment = align_enum
                    if getattr(style, "indent", 0.0) > 0:
                        p.paragraph_format.left_indent = Pt(style.indent)
                    if getattr(style, "line_spacing", 1.15) > 0:
                        p.paragraph_format.line_spacing = style.line_spacing

                    run = p.add_run(text)
                    run.bold = getattr(style, "bold", True)
                    run.italic = getattr(style, "italic", False)
                    run.font.size = Pt(style.font_size if style.font_size > 0 else 16)
                    if getattr(style, "underline", False):
                        run.underline = True
                    if getattr(style, "strikethrough", False):
                        run.font.strike = True
                    if getattr(style, "font_family", None) and style.font_family != "Inter":
                        run.font.name = style.font_family
                    if style.color:
                        rgb = hex_to_rgb(style.color)
                        if rgb:
                            run.font.color.rgb = rgb

                # Table rows (pipe-separated)
                elif elem.type == "table_row":
                    cells = [c.strip() for c in text.split("|")]
                    table = word_doc.add_table(rows=1, cols=len(cells))
                    table.style = "Table Grid"
                    hdr_cells = table.rows[0].cells
                    for c_idx, cell_text in enumerate(cells):
                        hdr_cells[c_idx].text = cell_text
                        for p in hdr_cells[c_idx].paragraphs:
                            for r in p.runs:
                                r.font.size = Pt(max(9, style.font_size))
                                r.bold = style.bold

                # Standard Paragraphs
                else:
                    p = word_doc.add_paragraph()
                    p.alignment = align_enum
                    if getattr(style, "indent", 0.0) > 0:
                        p.paragraph_format.left_indent = Pt(style.indent)
                    if getattr(style, "line_spacing", 1.15) > 0:
                        p.paragraph_format.line_spacing = style.line_spacing

                    run = p.add_run(text)
                    run.bold = style.bold
                    run.italic = style.italic
                    run.underline = style.underline
                    if getattr(style, "strikethrough", False):
                        run.font.strike = True
                    if getattr(style, "font_family", None) and style.font_family != "Inter":
                        run.font.name = style.font_family
                    run.font.size = Pt(style.font_size if style.font_size > 0 else 11)
                    if style.color:
                        rgb = hex_to_rgb(style.color)
                        if rgb:
                            run.font.color.rgb = rgb

        stream = io.BytesIO()
        word_doc.save(stream)
        stream.seek(0)
        return stream

    @staticmethod
    def export_to_file(doc: UnifiedDocument, output_path: str):
        stream = DocxDocumentExporter.export_to_stream(doc)
        with open(output_path, "wb") as f:
            f.write(stream.getbuffer())


# Convenience standalone function
def export_docx(doc: UnifiedDocument, output_path: Optional[str] = None) -> io.BytesIO:
    if output_path:
        DocxDocumentExporter.export_to_file(doc, output_path)
    return DocxDocumentExporter.export_to_stream(doc)
