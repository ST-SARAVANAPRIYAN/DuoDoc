"""
High-Fidelity Document Canvas Rendering Engine
Implements Slide 10: Stages 2 & 7 (Visual Representation & Document Generation).

Renders UnifiedDocument models into high-resolution pixel images using scalable TrueType fonts,
supporting non-destructive base raster patching and dynamic highlight overlays.
"""

import os
from typing import Optional, List, Tuple
from PIL import Image, ImageDraw, ImageFont
from schema import UnifiedDocument, DocumentPage, DocumentElement

# System TrueType font paths on Linux
FONT_FAMILIES = {
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
        if any(term in fam_key for term in ("serif", "times", "georgia", "roman")):
            category = "serif"
        elif any(term in fam_key for term in ("mono", "courier", "code", "consolas")):
            category = "mono"
        else:
            category = "sans"

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
        margin_r: int = 746
    ) -> Tuple[int, int, int, int]:
        """
        Draws text with complete typographic attributes and returns bounding box (min_x, min_y, max_x, max_y).
        """
        # Multi-line handling with word wrapping
        raw_paragraphs = text.split("\n")
        page_printable_w = max(150, margin_r - margin_l - indent_px)
        max_wrap_w = page_printable_w if (box_w <= 0 or box_w > 500) else max(box_w, 150)

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

            if letter_spacing_px != 0:
                line_w = sum(draw.textlength(ch, font=font) + letter_spacing_px for ch in line)
            else:
                try:
                    line_w = draw.textlength(line, font=font)
                except Exception:
                    line_w = len(line) * (font_size * 0.55)

            if align == "center":
                if box_w > 0 and box_w < 350:
                    line_x = max(x, x + int((box_w - line_w) / 2))
                else:
                    line_x = max(margin_l, int(margin_l + indent_px + (page_printable_w - line_w) / 2))
            elif align == "right":
                if box_w > 0 and box_w < 350:
                    line_x = max(x, x + box_w - int(line_w) - 4)
                else:
                    line_x = max(margin_l, margin_r - int(line_w) - 4)
            else:
                # Left or justify
                line_x = x + indent_px

            min_render_x = min(min_render_x, line_x)
            max_render_x = max(max_render_x, line_x + int(line_w))

            if letter_spacing_px != 0:
                curr_x = line_x
                for ch in line:
                    draw.text((curr_x, line_y), ch, fill=fill, font=font)
                    curr_x += int(round(draw.textlength(ch, font=font) + letter_spacing_px))
            else:
                draw.text((line_x, line_y), line, fill=fill, font=font)

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
        box_width: int = 3
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

            draw_col = text_color
            if draw_col and draw_col.lower() in ("yellow", "gold", "amber"):
                draw_col = "#EAB308"
            elif not draw_col:
                draw_col = self.default_text_color

            # If element was explicitly modified or highlighted
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
                    margin_l=margin_l, margin_r=margin_r
                )
                if highlight_elem_id == el.id:
                    active_rendered_bbox = r_box

            elif highlight_elem_id is not None and el.id == highlight_elem_id and has_base_image:
                # Non-destructive canvas patch: Clear target area cleanly across bounds
                clear_x1 = max(0, min(x1 - 4, margin_l))
                clear_x2 = min(canvas.width, max(x2 + 4, margin_r))
                clear_y1 = max(0, y1 - 4)
                est_h = max(box_h + 8, int(font_size * line_spacing * 2) + 12)
                clear_y2 = min(canvas.height, y1 + est_h)
                draw.rectangle([clear_x1, clear_y1, clear_x2, clear_y2], fill=self.default_bg)

                font = self._get_font(max(10, font_size), bold=is_bold, italic=is_italic, font_family=font_family)
                r_box = self._draw_styled_text(
                    draw, el.text, font, x1, y1 + 2, fill=draw_col,
                    font_size=font_size, align=align, box_w=box_w,
                    scale_x=scale_x, scale_y=scale_y, indent_px=indent_px,
                    letter_spacing_px=letter_spacing_px, underline=is_underline,
                    strikethrough=is_strike, line_spacing=line_spacing,
                    margin_l=margin_l, margin_r=margin_r
                )
                active_rendered_bbox = r_box

            elif not has_base_image:
                font = self._get_font(max(10, font_size), bold=is_bold, italic=is_italic, font_family=font_family)
                r_box = self._draw_styled_text(
                    draw, el.text, font, x1, y1 + 2, fill=draw_col,
                    font_size=font_size, align=align, box_w=box_w,
                    scale_x=scale_x, scale_y=scale_y, indent_px=indent_px,
                    letter_spacing_px=letter_spacing_px, underline=is_underline,
                    strikethrough=is_strike, line_spacing=line_spacing,
                    margin_l=margin_l, margin_r=margin_r
                )
                if highlight_elem_id == el.id:
                    active_rendered_bbox = r_box

            if show_all_boxes:
                draw.rectangle([x1, y1, x2, y2], outline="#CBD5E1", width=1)

            # Highlight target element
            if highlight_elem_id is not None and el.id == highlight_elem_id:
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
    show_all_boxes: bool = False
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
        show_all_boxes=show_all_boxes
    )
