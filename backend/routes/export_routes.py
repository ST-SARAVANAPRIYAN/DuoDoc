"""
Export Routes: Native Microsoft Word DOCX Generation
"""

import io
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from export import DocxDocumentExporter
from session_store import get_document

router = APIRouter(prefix="/api/export", tags=["Export"])


@router.get("/{doc_id}")
def export_docx(doc_id: str):
    """
    Converts a UnifiedDocument AST into native Microsoft Word (.docx)
    and streams the file for download.
    """
    # Check for modified version first
    doc = get_document(f"{doc_id}_modified")
    if not doc:
        doc = get_document(doc_id)

    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{doc_id}' not found.")

    docx_stream = DocxDocumentExporter.export_to_stream(doc)
    filename = f"{doc_id}_manipulated.docx"

    return StreamingResponse(
        docx_stream,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
