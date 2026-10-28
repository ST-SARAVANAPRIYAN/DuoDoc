"""
High-Fidelity Document Canvas Rendering Engine
Implements Slide 10: Stages 2 & 7 (Visual Representation & Document Generation).

Renders UnifiedDocument models into high-resolution pixel images using scalable TrueType fonts,
supporting non-destructive base raster patching and dynamic highlight overlays.
"""

import os
import re
from typing import Optional, List, Tuple, Dict, Any
from PIL import Image, ImageDraw, ImageFont
from schema import UnifiedDocument, DocumentPage, DocumentElement

# System TrueType font paths on Linux
FONT_FAMILIES = {
    "liberation_serif": {
        "regular": "/usr/share/fonts/liberation/LiberationSerif-Regular.ttf",
        "bold": "/usr/share/fonts/liberation/LiberationSerif-Bold.ttf",
        "italic": "/usr/share/fonts/liberation/LiberationSerif-Italic.ttf",
        "bold_italic": "/usr/share/fonts/liberation/LiberationSerif-BoldItalic.ttf",
    },
    "liberation_sans": {
        "regular": "/usr/share/fonts/liberation/LiberationSans-Regular.ttf",
        "bold": "/usr/share/fonts/liberation/LiberationSans-Bold.ttf",
        "italic": "/usr/share/fonts/liberation/LiberationSans-Italic.ttf",
        "bold_italic": "/usr/share/fonts/liberation/LiberationSans-BoldItalic.ttf",
    },
    "sans": {
        "regular": "/usr/share/fonts/TTF/DejaVuSans.ttf",
        "bold": "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
        "italic": "/usr/share/fonts/TTF/DejaVuSans-Oblique.ttf",
        "bold_italic": "/usr/share/fonts/TTF/DejaVuSans-BoldOblique.ttf",
    },
    "serif": {
        "regular": "/usr/share/fonts/TTF/DejaVuSerif.ttf",
        "bold": "/usr/share/fonts/TTF/DejaVuSerif-Bold.ttf",
        "italic": "/usr/share/fonts/TTF/DejaVuSerif-Italic.ttf",
        "bold_italic": "/usr/share/fonts/TTF/DejaVuSerif-BoldItalic.ttf",
    },
    "mono": {
        "regular": "/usr/share/fonts/TTF/DejaVuSansMono.ttf",
        "bold": "/usr/share/fonts/TTF/DejaVuSansMono-Bold.ttf",
        "italic": "/usr/share/fonts/TTF/DejaVuSansMono-Oblique.ttf",
        "bold_italic": "/usr/share/fonts/TTF/DejaVuSansMono-BoldOblique.ttf",
    }
}


class DocumentCanvasRenderer:
    """
    Renders UnifiedDocument pages into high-resolution RGB visual images
    with TrueType typography and non-destructive image patching.
    """

    def __init__(self, default_bg: str = "#FFFFFF", default_text_color: str = "#0F172A"):
        self.default_bg = default_bg
        self.default_text_color = default_text_color
        self._font_cache = {}

    def _get_font(
        self,
        size: int,
        bold: bool = False,
        italic: bool = False,
        font_family: str = "DejaVu Sans"
    ) -> ImageFont.ImageFont:
        fam_key = (font_family or "").lower()
        if "liberation" in fam_key:
            category = "liberation_sans" if "sans" in fam_key else "liberation_serif"
        elif any(term in fam_key for term in ("serif", "times", "georgia", "roman")):
            category = "liberation_serif" if os.path.exists("/usr/share/fonts/liberation/LiberationSerif-Regular.ttf") else "serif"
        elif any(term in fam_key for term in ("mono", "courier", "code", "consolas")):
            category = "mono"
        else:
            category = "liberation_sans" if os.path.exists("/usr/share/fonts/liberation/LiberationSans-Regular.ttf") else "sans"

        if bold and italic:
            variant = "bold_italic"
        elif bold:
            variant = "bold"
        elif italic:
            variant = "italic"
        else:
            variant = "regular"

        key = (category, variant, size)
        if key in self._font_cache:
            return self._font_cache[key]

        font_path = FONT_FAMILIES.get(category, {}).get(variant)
        if not font_path or not os.path.exists(font_path):
            font_path = FONT_FAMILIES["sans"]["regular"]

        try:
            if font_path and os.path.exists(font_path):
                f = ImageFont.truetype(font_path, size=size)
            else:
                f = ImageFont.load_default()
        except Exception:
            f = ImageFont.load_default()

        self._font_cache[key] = f
        return f

    def _split_line_by_spans(self, line: str, spans: Optional[List[Dict[str, Any]]]) -> List[Tuple[str, Optional[Dict[str, Any]]]]:
        """
        Splits a line of text into segments: (segment_text, span_style_dict_or_None).
        Non-matching segments have None as style.
        """
        if not spans or not line:
            return [(line, None)]

        matches = []
        for s in spans:
            stext = s.get("text", "")
            if not stext:
                continue
            for m in re.finditer(re.escape(stext), line, re.IGNORECASE):
                matches.append((m.start(), m.end(), s.get("style", {})))

        if not matches:
            return [(line, None)]

        matches.sort(key=lambda m: (m[0], -m[1]))
        filtered_matches = []
        last_end = 0
        for start, end, style in matches:
            if start >= last_end:
                filtered_matches.append((start, end, style))
                last_end = end

        chunks = []
        curr = 0
        for start, end, style in filtered_matches:
            if start > curr:
                chunks.append((line[curr:start], None))
            chunks.append((line[start:end], style))
            curr = end
        if curr < len(line):
            chunks.append((line[curr:], None))

        return chunks

    def _draw_styled_text(
        self,
        draw: ImageDraw.ImageDraw,
        text: str,
        font: ImageFont.ImageFont,
        x: int,
        y: int,
        fill: str,
        font_size: int,
        align: str = "left",
        box_w: int = 0,
        scale_x: float = 1.0,
        scale_y: float = 1.0,
        indent_px: int = 0,
        letter_spacing_px: int = 0,
        underline: bool = False,
        strikethrough: bool = False,
        line_spacing: float = 1.15,
        margin_l: int = 54,
        margin_r: int = 746,
        spans: Optional[List[Dict[str, Any]]] = None,
        subscript: bool = False,
        superscript: bool = False
    ) -> Tuple[int, int, int, int]:
        """
        Draws text with complete typographic attributes and returns bounding box (min_x, min_y, max_x, max_y).
        Supports multi-run text spans (sub-phrase styling) and sub/superscript.
        """
        # Multi-line handling with word wrapping
        raw_paragraphs = text.split("\n")
        page_printable_w = max(150, margin_r - margin_l - indent_px)
        max_wrap_w = max(box_w + 24, page_printable_w) if box_w > 0 else page_printable_w

        lines: List[str] = []
        for p in raw_paragraphs:
            words = p.split()
            if not words:
                lines.append("")
                continue

            current_line = []
            for w in words:
                test_line = " ".join(current_line + [w])
                test_w = sum(draw.textlength(ch, font=font) + letter_spacing_px for ch in test_line) if letter_spacing_px != 0 else draw.textlength(test_line, font=font)
                if test_w <= max_wrap_w or not current_line:
                    current_line.append(w)
                else:
                    lines.append(" ".join(current_line))
                    current_line = [w]
            if current_line:
                lines.append(" ".join(current_line))

        line_height = max(int(font_size * 1.1), int(round(font_size * line_spacing * 1.15)))
        line_thickness = max(1, int(round(font_size / 14.0 * scale_y)))

        min_render_x = 999999
        max_render_x = 0
        min_render_y = y
        max_render_y = y + (len(lines) * line_height)

        for l_idx, line in enumerate(lines):
            line_y = y + (l_idx * line_height)
            if subscript:
                line_y += int(font_size * 0.22)
            elif superscript:
                line_y -= int(font_size * 0.30)

            if letter_spacing_px != 0:
                line_w = sum(draw.textlength(ch, font=font) + letter_spacing_px for ch in line)
            else:
                try:
                    line_w = draw.textlength(line, font=font)
                except Exception:
                    line_w = len(line) * (font_size * 0.55)

            if align == "center":
                if box_w > 0 and box_w <= (margin_r - margin_l) * 0.70:
                    line_x = max(x, x + int((box_w - line_w) / 2))
                else:
                    line_x = max(margin_l, int(margin_l + indent_px + (page_printable_w - line_w) / 2))
            elif align == "right":
                if box_w > 0:
                    line_x = max(x, x + box_w - int(line_w) - 4)
                else:
                    line_x = max(margin_l, margin_r - int(line_w) - 4)
            else:
                # Left or justify: if element spans significant width or was previously centered, align cleanly to left margin
                if box_w > (margin_r - margin_l) * 0.40 or (margin_l > 0 and x > margin_l + 10):
                    line_x = margin_l + indent_px
                else:
                    line_x = x + indent_px

            min_render_x = min(min_render_x, line_x)
            max_render_x = max(max_render_x, line_x + int(line_w))

            chunks = self._split_line_by_spans(line, spans) if spans else [(line, None)]
            curr_x = line_x
            for chunk_text, chunk_style in chunks:
                if not chunk_text:
                    continue
                chunk_fill = fill
                chunk_font = font
                if chunk_style:
                    c_col = chunk_style.get("color")
                    if c_col:
                        c_lower = c_col.lower()
                        if c_lower in ("yellow", "gold", "amber"):
                            chunk_fill = "#EAB308"
                        elif c_lower == "blue":
                            chunk_fill = "#2563EB"
                        elif c_lower == "red":
                            chunk_fill = "#DC2626"
                        elif c_lower in ("green", "emerald"):
                            chunk_fill = "#059669"
                        elif c_lower == "purple":
                            chunk_fill = "#7C3AED"
                        else:
                            chunk_fill = c_col

                if letter_spacing_px != 0:
                    for ch in chunk_text:
                        draw.text((curr_x, line_y), ch, fill=chunk_fill, font=chunk_font)
                        curr_x += int(round(draw.textlength(ch, font=chunk_font) + letter_spacing_px))
                else:
                    draw.text((curr_x, line_y), chunk_text, fill=chunk_fill, font=chunk_font)
                    try:
                        curr_x += int(round(draw.textlength(chunk_text, font=chunk_font)))
                    except Exception:
                        curr_x += int(round(len(chunk_text) * (font_size * 0.55)))

            if underline:
                u_y = line_y + int(font_size * 1.06) + int(1 * scale_y)
                draw.line([(line_x, u_y), (line_x + int(line_w), u_y)], fill=fill, width=line_thickness)

            if strikethrough:
                s_y = line_y + int(font_size * 0.54)
                draw.line([(line_x, s_y), (line_x + int(line_w), s_y)], fill=fill, width=line_thickness)

        if min_render_x == 999999:
            min_render_x = x
            max_render_x = x + 10

        return (min_render_x, min_render_y, max_render_x, max_render_y)

    def render_page(
        self,
        doc: UnifiedDocument,
        page_id: int = 0,
        highlight_elem_id: Optional[str] = None,
        highlight_box_color: Optional[str] = None,
        show_all_boxes: bool = False,
        box_width: int = 3,
        draw_border: bool = False
    ) -> Image.Image:
        """
        Renders a page of a UnifiedDocument into a PIL Image.
        Uses base page image when available for pixel-perfect fidelity.
        """
        page: Optional[DocumentPage] = None
        for p in doc.pages:
            if p.page_id == page_id:
                page = p
                break

        if page is None:
            if doc.pages:
                page = doc.pages[0]
            else:
                return Image.new("RGB", (800, 1000), color=self.default_bg)

        # 1. Base Layer: Use rendered bitmap if available, else blank canvas
        has_base_image = False
        if page.image_path and os.path.exists(page.image_path):
            try:
                canvas = Image.open(page.image_path).convert("RGB")
                has_base_image = True
            except Exception:
                has_base_image = False

        if not has_base_image:
            page_w = int(page.width) if page.width > 0 else 800
            page_h = int(page.height) if page.height > 0 else 1000
            canvas = Image.new("RGB", (page_w, page_h), color=self.default_bg)

        draw = ImageDraw.Draw(canvas)
        scale_x = canvas.width / page.width if page.width > 0 else 1.0
        scale_y = canvas.height / page.height if page.height > 0 else 1.0
        margin_l = int(54 * scale_x)
        margin_r = canvas.width - int(54 * scale_x)

        active_rendered_bbox = None

        for el in page.elements:
            x1 = int(el.bbox[0] * scale_x)
            y1 = int(el.bbox[1] * scale_y)
            x2 = int(el.bbox[2] * scale_x)
            y2 = int(el.bbox[3] * scale_y)
            box_w = max(1, x2 - x1)
            box_h = max(1, y2 - y1)

            style = el.style
            font_size = int(round(getattr(style, "font_size", 12) * scale_y))
            font_family = getattr(style, "font_family", "DejaVu Sans")
            is_bold = getattr(style, "bold", False)
            is_italic = getattr(style, "italic", False)
            is_underline = getattr(style, "underline", False)
            is_strike = getattr(style, "strikethrough", False)
            align = getattr(style, "alignment", "left").lower()
            text_color = getattr(style, "color", self.default_text_color)
            is_highlighted = getattr(style, "highlight", False)
            indent_px = int(getattr(style, "indent", 0.0) * scale_x)
            letter_spacing_px = int(round(getattr(style, "letter_spacing", 0.0) * scale_x))
            line_spacing = getattr(style, "line_spacing", 1.15)
            is_sub = getattr(style, "subscript", False)
            is_sup = getattr(style, "superscript", False)
            spans = getattr(el, "metadata", {}).get("spans", [])

            draw_col = text_color
            if draw_col and draw_col.lower() in ("yellow", "gold", "amber"):
                draw_col = "#EAB308"
            elif not draw_col:
                draw_col = self.default_text_color

            is_target_elem = False
            if highlight_elem_id is not None:
                if isinstance(highlight_elem_id, (list, tuple, set)):
                    is_target_elem = el.id in highlight_elem_id
                else:
                    is_target_elem = (el.id == highlight_elem_id)

            if is_highlighted:
                overlay_color = "#FEF08A" if text_color in ("#000000", "#0F172A", "", "yellow", "#EAB308") else text_color
                draw.rectangle([x1 - 2, y1 - 2, x2 + 2, y2 + 2], fill=overlay_color)
                font = self._get_font(max(10, font_size), bold=is_bold, italic=is_italic, font_family=font_family)
                r_box = self._draw_styled_text(
                    draw, el.text, font, x1, y1 + 2, fill="#0F172A",
                    font_size=font_size, align=align, box_w=box_w,
                    scale_x=scale_x, scale_y=scale_y, indent_px=indent_px,
                    letter_spacing_px=letter_spacing_px, underline=is_underline,
                    strikethrough=is_strike, line_spacing=line_spacing,
                    margin_l=margin_l, margin_r=margin_r,
                    spans=spans, subscript=is_sub, superscript=is_sup
                )
                if is_target_elem:
                    active_rendered_bbox = r_box

            elif is_target_elem and has_base_image:
                # Non-destructive canvas patch: Clear target area cleanly across element bounds
                clear_x1 = max(0, x1 - 4)
                clear_x2 = min(canvas.width, x2 + 4)
                # For wide headers or elements spanning significant width, align clear area with margins
                if box_w > (canvas.width * 0.40) or (margin_l > 0 and x1 > margin_l + 10 and align in ("left", "center", "right")):
                    clear_x1 = max(0, min(x1 - 4, margin_l))
                    clear_x2 = min(canvas.width, max(x2 + 4, margin_r))

                clear_y1 = max(0, y1 - 2)

                # Find neighboring non-target elements strictly below this element to prevent bleeding into subsequent text
                next_elems_below = [
                    oe for oe in page.elements
                    if oe.id != el.id
                    and (not isinstance(highlight_elem_id, (list, tuple, set)) or oe.id not in highlight_elem_id)
                    and (oe.bbox[1] * scale_y) > (y1 + 4)
                ]
                max_safe_y2 = int(min(oe.bbox[1] * scale_y for oe in next_elems_below) - 2) if next_elems_below else canvas.height

                # Ensure clear_y2 cleanly covers element bounds without overlapping subsequent text
                clear_y2 = min(canvas.height, y2 + 2, max_safe_y2)
                if clear_y2 <= clear_y1:
                    clear_y2 = min(canvas.height, y2 + 2)

                draw.rectangle([clear_x1, clear_y1, clear_x2, clear_y2], fill=self.default_bg)

                font = self._get_font(max(10, font_size), bold=is_bold, italic=is_italic, font_family=font_family)
                r_box = self._draw_styled_text(
                    draw, el.text, font, x1, y1 + 2, fill=draw_col,
                    font_size=font_size, align=align, box_w=box_w,
                    scale_x=scale_x, scale_y=scale_y, indent_px=indent_px,
                    letter_spacing_px=letter_spacing_px, underline=is_underline,
                    strikethrough=is_strike, line_spacing=line_spacing,
                    margin_l=margin_l, margin_r=margin_r,
                    spans=spans, subscript=is_sub, superscript=is_sup
                )
                if active_rendered_bbox is None:
                    active_rendered_bbox = r_box
                else:
                    active_rendered_bbox = (
                        min(active_rendered_bbox[0], r_box[0]),
                        min(active_rendered_bbox[1], r_box[1]),
                        max(active_rendered_bbox[2], r_box[2]),
                        max(active_rendered_bbox[3], r_box[3])
                    )

            elif not has_base_image:
                font = self._get_font(max(10, font_size), bold=is_bold, italic=is_italic, font_family=font_family)
                r_box = self._draw_styled_text(
                    draw, el.text, font, x1, y1 + 2, fill=draw_col,
                    font_size=font_size, align=align, box_w=box_w,
                    scale_x=scale_x, scale_y=scale_y, indent_px=indent_px,
                    letter_spacing_px=letter_spacing_px, underline=is_underline,
                    strikethrough=is_strike, line_spacing=line_spacing,
                    margin_l=margin_l, margin_r=margin_r,
                    spans=spans, subscript=is_sub, superscript=is_sup
                )
                if is_target_elem:
                    active_rendered_bbox = r_box

            if show_all_boxes:
                draw.rectangle([x1, y1, x2, y2], outline="#CBD5E1", width=1)

            # Highlight target element if explicitly requested
            if draw_border and is_target_elem:
                border_col = highlight_box_color if highlight_box_color else "#10B981"
                h_x1, h_y1, h_x2, h_y2 = active_rendered_bbox if active_rendered_bbox else (x1, y1, x2, y2)
                for offset in range(box_width):
                    draw.rectangle(
                        [h_x1 - offset - 3, h_y1 - offset - 3, h_x2 + offset + 3, h_y2 + offset + 3],
                        outline=border_col
                    )

        return canvas


def render_canvas(
    doc: UnifiedDocument,
    page_id: int = 0,
    highlight_elem_id: Optional[str] = None,
    highlight_box_color: Optional[str] = None,
    show_all_boxes: bool = False,
    draw_border: bool = False
) -> Image.Image:
    """
    Utility entry point for dynamic canvas rendering.
    """
    renderer = DocumentCanvasRenderer()
    return renderer.render_page(
        doc,
        page_id=page_id,
        highlight_elem_id=highlight_elem_id,
        highlight_box_color=highlight_box_color,
        show_all_boxes=show_all_boxes,
        draw_border=draw_border
    )


def render_native_office_page(
    doc: UnifiedDocument,
    page_id: int = 0,
    highlight_elem_id: Optional[str] = None,
    highlight_box_color: Optional[str] = None,
    dpi: int = 150
) -> Image.Image:
    """
    Renders the UnifiedDocument page via DocxDocumentExporter + headless LibreOffice + PyMuPDF
    for 100% faithful Word OpenXML layout and typography.
    Falls back gracefully to render_canvas if LibreOffice is unavailable or fails.
    """
    import tempfile
    import shutil
    import subprocess
    import io
    import pymupdf
    from export import DocxDocumentExporter

    soffice_bin = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice_bin:
        return render_canvas(
            doc,
            page_id=page_id,
            highlight_elem_id=highlight_elem_id,
            highlight_box_color=highlight_box_color
        )

    try:
        stream = DocxDocumentExporter.export_to_stream(doc)
        with tempfile.TemporaryDirectory(prefix="office_render_") as td:
            docx_path = os.path.join(td, "doc.docx")
            with open(docx_path, "wb") as f:
                f.write(stream.getvalue())

            cmd = [soffice_bin, "--headless", "--convert-to", "pdf", docx_path, "--outdir", td]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            if res.returncode != 0:
                return render_canvas(doc, page_id=page_id, highlight_elem_id=highlight_elem_id, highlight_box_color=highlight_box_color)

            pdf_path = os.path.join(td, "doc.pdf")
            if not os.path.exists(pdf_path):
                pdfs = [os.path.join(td, f) for f in os.listdir(td) if f.lower().endswith(".pdf")]
                if not pdfs:
                    return render_canvas(doc, page_id=page_id, highlight_elem_id=highlight_elem_id, highlight_box_color=highlight_box_color)
                pdf_path = pdfs[0]

            pdf_doc = pymupdf.open(pdf_path)
            target_p = min(max(0, page_id), len(pdf_doc) - 1)
            page = pdf_doc[target_p]
            pix = page.get_pixmap(dpi=dpi)
            img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")

            # If highlight_elem_id is specified, locate its element in doc and draw bounding box overlay
            if highlight_elem_id:
                target_elem = None
                if target_p < len(doc.pages):
                    for el in doc.pages[target_p].elements:
                        if el.id == highlight_elem_id:
                            target_elem = el
                            break
                if target_elem and target_elem.bbox and len(target_elem.bbox) == 4:
                    draw = ImageDraw.Draw(img)
                    orig_page = doc.pages[target_p]
                    doc_w = orig_page.width or 800.0
                    doc_h = orig_page.height or 1000.0
                    img_w, img_h = img.size
                    scale_x = img_w / doc_w
                    scale_y = img_h / doc_h
                    bx1 = int(target_elem.bbox[0] * scale_x)
                    by1 = int(target_elem.bbox[1] * scale_y)
                    bx2 = int(target_elem.bbox[2] * scale_x)
                    by2 = int(target_elem.bbox[3] * scale_y)
                    border_col = highlight_box_color if highlight_box_color else "#0284C7"
                    for offset in range(3):
                        draw.rectangle(
                            [bx1 - offset - 2, by1 - offset - 2, bx2 + offset + 2, by2 + offset + 2],
                            outline=border_col
                        )

            return img
    except Exception:
        return render_canvas(doc, page_id=page_id, highlight_elem_id=highlight_elem_id, highlight_box_color=highlight_box_color)

