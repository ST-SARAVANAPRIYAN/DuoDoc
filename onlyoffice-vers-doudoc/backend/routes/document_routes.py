"""
Document Upload, Retrieval & Benchmark Routes
"""

import os
import uuid
import json
import logging
from pathlib import Path
from typing import List, Dict, Any
from io import BytesIO
from fastapi import APIRouter, UploadFile, File, HTTPException, Response
from PIL import Image

from config import UPLOAD_DIR, RENDERS_DIR, FUNSD_DIR, CORPUS_DIR, BASE_DIR
from parser import DocxDocumentParser, PdfDocumentParser
from render import render_canvas
from schema import UnifiedDocument, DocumentPage, DocumentElement
from schemas import DocumentSummaryDTO, PageDTO, ElementDTO, BenchmarkSampleDTO
from session_store import store_document, get_document
from database.mongodb import get_db

logger = logging.getLogger("DocumentRoutes")
router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.post("/upload", response_model=DocumentSummaryDTO)
async def upload_document(file: UploadFile = File(...)):
    """
    Ingests a native Microsoft Word (.docx) or PDF document, compiles high-fidelity visual layouts,
    extracts elements into UnifiedDocument AST, and rasterizes visual page bitmaps.
    """
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".docx", ".doc", ".pdf", ".png", ".jpg", ".jpeg"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}'. Upload Microsoft Word (.docx) or PDF documents."
        )

    doc_id = f"doc_{uuid.uuid4().hex[:10]}"
    dest_path = UPLOAD_DIR / f"{doc_id}_{filename}"

    with open(dest_path, "wb") as f:
        content = await file.read()
        f.write(content)

    doc_renders_dir = RENDERS_DIR / doc_id
    os.makedirs(doc_renders_dir, exist_ok=True)

    try:
        if ext in (".docx", ".doc"):
            parser = DocxDocumentParser(render_dpi=150)
            unified_doc = parser.parse(str(dest_path), output_image_dir=str(doc_renders_dir))
        else:
            parser = PdfDocumentParser(render_dpi=150)
            unified_doc = parser.parse(str(dest_path), output_image_dir=str(doc_renders_dir))

        # Only rasterize page 0 for fast preview thumbnail (avoids rendering 50+ pages during upload)
        if unified_doc.pages:
            p0 = unified_doc.pages[0]
            if not p0.image_path or not os.path.exists(p0.image_path):
                img = render_canvas(unified_doc, page_id=0)
                img_path = doc_renders_dir / "page_0.png"
                img.save(img_path)
                p0.image_path = str(img_path)

        unified_doc.document_id = doc_id
        store_document(doc_id, unified_doc)

        # Register in database if available
        try:
            db = get_db()
            if db is not None:
                db["documents"].insert_one({
                    "document_id": doc_id,
                    "owner_id": "system",
                    "folder_id": None,
                    "title": filename.replace("-", " ").replace("_", " ").title(),
                    "filename": filename,
                    "file_type": ext.replace(".", ""),
                    "file_path": str(dest_path),
                    "file_size": os.path.getsize(dest_path),
                    "page_count": len(unified_doc.pages),
                    "tags": [ext.replace(".", ""), "workspace-upload"],
                    "status": "ready",
                    "uploaded_at": os.path.getctime(dest_path),
                    "last_opened_at": os.path.getctime(dest_path)
                })
        except Exception:
            pass

        pages_dto = []
        for p in unified_doc.pages:
            img_rel_url = f"/uploads/renders/{doc_id}/{os.path.basename(p.image_path)}" if p.image_path else ""
            elements_dto = [
                ElementDTO(
                    id=el.id,
                    type=el.type,
                    page=el.page,
                    bbox=el.bbox,
                    text=el.text,
                    style=el.style.to_dict() if hasattr(el.style, "to_dict") else {}
                )
                for el in p.elements
            ]
            pages_dto.append(PageDTO(
                page_id=p.page_id,
                width=p.width,
                height=p.height,
                image_url=img_rel_url,
                elements=elements_dto
            ))

        return DocumentSummaryDTO(
            document_id=doc_id,
            filename=filename,
            page_count=len(unified_doc.pages),
            pages=pages_dto
        )

    except Exception as e:
        logger.error(f"Error parsing document: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Document parsing error: {str(e)}")


@router.get("/{doc_id}", response_model=DocumentSummaryDTO)
def get_document_by_id(doc_id: str):
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{doc_id}' not found.")

    pages_dto = []
    for p in doc.pages:
        img_rel_url = f"/uploads/renders/{doc_id}/{os.path.basename(p.image_path)}" if p.image_path else ""
        elements_dto = [
            ElementDTO(
                id=el.id,
                type=el.type,
                page=el.page,
                bbox=el.bbox,
                text=el.text,
                style=el.style.to_dict() if hasattr(el.style, "to_dict") else {}
            )
            for el in p.elements
        ]
        pages_dto.append(PageDTO(
            page_id=p.page_id,
            width=p.width,
            height=p.height,
            image_url=img_rel_url,
            elements=elements_dto
        ))

    return DocumentSummaryDTO(
        document_id=doc_id,
        filename=f"{doc_id}.docx",
        page_count=len(doc.pages),
        pages=pages_dto
    )


@router.get("/{doc_id}/crop")
def get_document_crop(
    doc_id: str,
    page_idx: int = 0,
    bbox: str = "",
    padding: int = 15
):
    """
    Returns high-resolution visual crop patch of a document element or region.
    Coordinates bbox format: 'x1,y1,x2,y2' in points.
    """
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if page_idx >= len(doc.pages):
        raise HTTPException(status_code=400, detail="Page index out of range")

    page = doc.pages[page_idx]
    if not page.image_path or not os.path.exists(page.image_path):
        img_pil = render_canvas(doc, page_id=page_idx)
    else:
        img_pil = Image.open(page.image_path).convert("RGB")

    if not bbox:
        buf = BytesIO()
        img_pil.save(buf, format="PNG")
        return Response(content=buf.getvalue(), media_type="image/png")

    try:
        coords = [float(x.strip()) for x in bbox.split(",")]
        if len(coords) != 4:
            raise ValueError()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid bbox format. Expected 'x1,y1,x2,y2'")

    x1, y1, x2, y2 = coords
    doc_w = page.width or 800.0
    doc_h = page.height or 1000.0
    img_w, img_h = img_pil.size

    scale_x = img_w / doc_w
    scale_y = img_h / doc_h

    min_x, max_x = min(x1, x2), max(x1, x2)
    min_y, max_y = min(y1, y2), max(y1, y2)

    px1 = max(0, int(min_x * scale_x) - padding)
    py1 = max(0, int(min_y * scale_y) - padding)
    px2 = min(img_w, int(max_x * scale_x) + padding)
    py2 = min(img_h, int(max_y * scale_y) + padding)

    if px2 <= px1 or py2 <= py1:
        px1, py1, px2, py2 = 0, 0, min(img_w, 200), min(img_h, 100)

    crop_img = img_pil.crop((px1, py1, px2, py2))
    buf = BytesIO()
    crop_img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


@router.get("/benchmarks/samples", response_model=List[BenchmarkSampleDTO])
def get_benchmark_samples():
    """
    Returns pre-configured evaluation samples from FUNSD and Office corpus
    for instant browser testing without requiring manual file upload.
    """
    samples: List[BenchmarkSampleDTO] = []

    # Check for featured multi-page academic document in uploads/
    featured_path = UPLOAD_DIR / "doc_70c0156668_project_paper.docx"
    if featured_path.exists():
        try:
            doc_id = "doc_70c0156668"
            doc = get_document(doc_id)
            if doc and len(doc.pages) > 0:
                first_p = doc.pages[0]
                first_img_url = f"/uploads/renders/{doc_id}/{os.path.basename(first_p.image_path)}" if first_p.image_path else ""
                samples.append(BenchmarkSampleDTO(
                    id=doc_id,
                    label=f"Featured: IEEE Project Paper ({len(doc.pages)} Pages, Two-Column)",
                    document_id=doc_id,
                    instruction="What is the proposed system architecture and core methodology?",
                    task_type="understanding",
                    image_url=first_img_url,
                    elements=[{"id": el.id, "text": el.text, "bbox": el.bbox} for el in first_p.elements[:25]]
                ))
        except Exception as e:
            logger.warning(f"Could not load featured document: {e}")

    manifest_funsd = FUNSD_DIR / "funsd_val.json"

    if manifest_funsd.exists():
        try:
            with open(manifest_funsd, "r", encoding="utf-8") as f:
                funsd_data = json.load(f)
            for i, s in enumerate(funsd_data[:12]):
                doc_id = f"funsd_sample_{i}"
                img_path = s.get("page_image", "")
                if not os.path.exists(img_path):
                    img_path = os.path.join(str(BASE_DIR), img_path)

                elements = [
                    DocumentElement(
                        id=el.get("id", f"e{j}"),
                        type=el.get("type", "paragraph"),
                        page=0,
                        bbox=el.get("bbox", [0, 0, 0, 0]),
                        text=el.get("text", "")
                    )
                    for j, el in enumerate(s.get("elements", []))
                ]

                # Store into document store
                doc_obj = UnifiedDocument(
                    document_id=doc_id,
                    pages=[DocumentPage(page_id=0, width=800.0, height=1000.0, elements=elements, image_path=img_path)]
                )
                store_document(doc_id, doc_obj)

                # Copy or link image to renders dir so static mount can serve it
                render_dest = RENDERS_DIR / doc_id
                os.makedirs(render_dest, exist_ok=True)
                dest_img = render_dest / "page_0.png"
                if os.path.exists(img_path) and not dest_img.exists():
                    try:
                        Image.open(img_path).save(dest_img)
                    except Exception:
                        pass

                samples.append(BenchmarkSampleDTO(
                    id=doc_id,
                    label=f"FUNSD Scanned Form {i+1} ({s.get('document_id', '')})",
                    document_id=doc_id,
                    instruction=s.get("instruction", "Find form information"),
                    task_type=s.get("task_type", "understanding"),
                    image_url=f"/uploads/renders/{doc_id}/page_0.png",
                    elements=s.get("elements", [])
                ))
        except Exception as e:
            logger.warning(f"Error loading FUNSD samples: {e}")

    return samples
