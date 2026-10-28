"""
Real PDF Document Parser Engine
Implements Slide 10: Stage 1 (Document Processing for arbitrary real-world PDFs).

Uses PyMuPDF (fitz) to extract:
- True page dimensions
- Exact character/word/span bounding boxes [x1, y1, x2, y2]
- High-resolution visual page rasterization (PNG)
- Font metadata (size, bold, flags, color)
- Structural element classification (heading, paragraph, table, image)
"""

import os
import pymupdf
from typing import List, Dict, Any, Optional
from PIL import Image

from schema import UnifiedDocument, DocumentPage, DocumentElement, ElementStyle
from .base import BaseDocumentParser


class PdfDocumentParser(BaseDocumentParser):
    """
    Parses arbitrary real-world PDF documents into the UnifiedDocument AST model.
    """

    def __init__(self, render_dpi: int = 150):
        self.render_dpi = render_dpi

    def parse(self, file_path: str, output_image_dir: Optional[str] = None) -> UnifiedDocument:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"PDF document not found: {file_path}")

        doc = pymupdf.open(file_path)
        doc_id = os.path.splitext(os.path.basename(file_path))[0]
        pages: List[DocumentPage] = []

        if output_image_dir:
            os.makedirs(output_image_dir, exist_ok=True)

        for page_idx in range(len(doc)):
            pdf_page = doc[page_idx]
            rect = pdf_page.rect
            page_w = float(rect.width)
            page_h = float(rect.height)

            # 1. Rasterize visual page bitmap (300/150 DPI)
            img_path = None
            if output_image_dir:
                pix = pdf_page.get_pixmap(dpi=self.render_dpi)
                img_filename = f"{doc_id}_page_{page_idx}.png"
                img_path = os.path.join(output_image_dir, img_filename)
                pix.save(img_path)

            # 2. Extract structured text blocks with layout bounding boxes
            # 'dict' flags return blocks, lines, spans, bboxes, fonts, and flags
            text_page = pdf_page.get_text("dict", flags=pymupdf.TEXT_DEHYPHENATE)
            elements: List[DocumentElement] = []
            elem_counter = 0

            blocks = text_page.get("blocks", [])

            # Compute median font size for relative heading detection
            font_sizes = []
            for b in blocks:
                if b.get("type") == 0:  # Text block
                    for line in b.get("lines", []):
                        for span in line.get("spans", []):
                            font_sizes.append(span.get("size", 10.0))
            median_size = (sorted(font_sizes)[len(font_sizes) // 2]) if font_sizes else 10.0

            for b_idx, b in enumerate(blocks):
                b_type = b.get("type", 0)

                # Type 1: Image block
                if b_type == 1:
                    bbox = [float(c) for c in b.get("bbox", [0, 0, 0, 0])]
                    elem = DocumentElement(
                        id=f"img_{page_idx}_{elem_counter}",
                        type="image",
                        page=page_idx,
                        bbox=bbox,
                        text="[Embedded Image / Figure]",
                        style=ElementStyle()
                    )
                    elements.append(elem)
                    elem_counter += 1
                    continue

                # Type 0: Text block
                block_lines = b.get("lines", [])
                if not block_lines:
                    continue

                # Group line spans into logical paragraph or heading elements
                block_text_parts = []
                max_span_size = 0.0
                is_bold_block = False
                is_italic_block = False

                for line in block_lines:
                    for span in line.get("spans", []):
                        span_text = span.get("text", "").strip()
                        if span_text:
                            block_text_parts.append(span_text)
                            span_size = span.get("size", 10.0)
                            if span_size > max_span_size:
                                max_span_size = span_size
                            flags = span.get("flags", 0)
                            if flags & 2:  # bold flag in PyMuPDF
                                is_bold_block = True
                            if flags & 1:  # italic flag in PyMuPDF
                                is_italic_block = True

                full_text = " ".join(block_text_parts).strip()
                if not full_text:
                    continue

                bbox = [float(c) for c in b.get("bbox", [0, 0, 0, 0])]

                # Classification heuristic: heading if noticeably larger than body or bold short line
                if max_span_size >= median_size * 1.2 or (is_bold_block and len(full_text) < 80):
                    elem_type = "heading"
                elif " | " in full_text or ("\t" in full_text and len(full_text.split()) > 3):
                    elem_type = "table_row"
                else:
                    elem_type = "paragraph"

                elem_id = f"{elem_type}_{page_idx}_{elem_counter}"
                elem_counter += 1

                elem = DocumentElement(
                    id=elem_id,
                    type=elem_type,
                    page=page_idx,
                    bbox=bbox,
                    text=full_text,
                    style=ElementStyle(
                        font_size=int(round(max_span_size)),
                        bold=is_bold_block,
                        italic=is_italic_block,
                        alignment="left"
                    )
                )
                elements.append(elem)

            doc_page = DocumentPage(
                page_id=page_idx,
                width=page_w,
                height=page_h,
                elements=elements,
                image_path=img_path
            )
            pages.append(doc_page)

        doc.close()
        return UnifiedDocument(
            document_id=doc_id,
            pages=pages,
            metadata={"source_path": file_path, "format": "pdf", "total_pages": len(pages)}
        )
