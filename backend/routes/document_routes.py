"""
Document Upload, Retrieval & Benchmark Routes
"""

import os
import uuid
import json
import logging
from pathlib import Path
from typing import List, Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image

from config import UPLOAD_DIR, RENDERS_DIR, FUNSD_DIR, CORPUS_DIR, BASE_DIR
from parser import DocxDocumentParser
from render import render_canvas
from schema import UnifiedDocument, DocumentPage, DocumentElement
from schemas import DocumentSummaryDTO, PageDTO, ElementDTO, BenchmarkSampleDTO
from session_store import store_document, get_document

logger = logging.getLogger("DocumentRoutes")
router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.post("/upload", response_model=DocumentSummaryDTO)
async def upload_document(file: UploadFile = File(...)):
    """
    Ingests a native Microsoft Word (.docx) document, compiles high-fidelity visual layouts,
    extracts elements into UnifiedDocument AST, and rasterizes visual page bitmaps.
    """
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".docx", ".doc"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}'. The system is configured strictly for Microsoft Word (.docx) documents."
        )

    doc_id = f"doc_{uuid.uuid4().hex[:10]}"
    dest_path = UPLOAD_DIR / f"{doc_id}_{filename}"

    with open(dest_path, "wb") as f:
        content = await file.read()
        f.write(content)

    doc_renders_dir = RENDERS_DIR / doc_id
    os.makedirs(doc_renders_dir, exist_ok=True)

    try:
        parser = DocxDocumentParser(render_dpi=150)
        unified_doc = parser.parse(str(dest_path), output_image_dir=str(doc_renders_dir))

        # Ensure every page has a raster bitmap path
        for p_idx, page in enumerate(unified_doc.pages):
            if not page.image_path or not os.path.exists(page.image_path):
                img = render_canvas(unified_doc, page_id=p_idx)
                img_path = doc_renders_dir / f"page_{p_idx}.png"
                img.save(img_path)
                page.image_path = str(img_path)

        unified_doc.document_id = doc_id
        store_document(doc_id, unified_doc)

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


@router.get("/benchmarks/samples", response_model=List[BenchmarkSampleDTO])
def get_benchmark_samples():
    """
    Returns pre-configured evaluation samples from FUNSD and Office corpus
    for instant browser testing without requiring manual file upload.
    """
    samples: List[BenchmarkSampleDTO] = []
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
