"""
ONLYOFFICE Document Server Integration Routes
Handles document streaming, save callbacks, and configuration generation
for ONLYOFFICE Docs with the OneScript Bridge Plugin.
"""

import os
import json
import time
import urllib.request
import logging
from pathlib import Path
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from config import UPLOAD_DIR
from session_store import get_document, store_document
from schema import UnifiedDocument
from parser.docx_parser import DocxDocumentParser

logger = logging.getLogger("onlyoffice_routes")
router = APIRouter(prefix="/api/onlyoffice", tags=["ONLYOFFICE"])

# ONLYOFFICE Document Server URL on host
ONLYOFFICE_HOST = os.environ.get("ONLYOFFICE_HOST", "http://localhost:9000")
BACKEND_HOST = os.environ.get("BACKEND_HOST", "http://host.docker.internal:8000")


@router.get("/download/{document_id}")
def download_document_for_onlyoffice(document_id: str):
    """
    Streams the raw .docx file so ONLYOFFICE Document Server can load it.
    """
    doc_path = os.path.join(UPLOAD_DIR, f"{document_id}.docx")
    if not os.path.exists(doc_path):
        # Look for any matching file starting with document_id in uploads
        matched = [f for f in os.listdir(UPLOAD_DIR) if f.startswith(document_id) and f.endswith(".docx")]
        if matched:
            doc_path = os.path.join(UPLOAD_DIR, matched[0])
        else:
            raise HTTPException(status_code=404, detail=f"Document '{document_id}' not found.")

    return FileResponse(
        path=doc_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=os.path.basename(doc_path)
    )


@router.post("/callback/{document_id}")
async def onlyoffice_callback(document_id: str, request: Request):
    """
    ONLYOFFICE Document Server calls this endpoint when saving or updating documents.
    Status 2: Document is ready for saving (user closed or saved).
    Status 6: Force save triggered while editing.
    """
    try:
        body = await request.json()
    except Exception as e:
        logger.error(f"Invalid callback JSON: {e}")
        return JSONResponse({"error": 0})

    status = body.get("status")
    download_url = body.get("url")
    logger.info(f"[ONLYOFFICE Callback] doc_id: {document_id}, status: {status}")

    if (status in (2, 6)) and download_url:
        try:
            # Target save path
            target_path = os.path.join(UPLOAD_DIR, f"{document_id}.docx")
            matched = [f for f in os.listdir(UPLOAD_DIR) if f.startswith(document_id) and f.endswith(".docx")]
            if matched:
                target_path = os.path.join(UPLOAD_DIR, matched[0])

            logger.info(f"Downloading updated DOCX from ONLYOFFICE: {download_url} -> {target_path}")
            # Stream download to target file
            urllib.request.urlretrieve(download_url, target_path)
            logger.info(f"File {document_id} successfully updated on disk.")

            # Re-parse into UnifiedDocument AST and refresh memory / MongoDB store
            updated_doc = DocxDocumentParser().parse(target_path)
            updated_doc.document_id = document_id
            store_document(document_id, updated_doc)
            store_document(f"{document_id}_modified", updated_doc)
            logger.info(f"UnifiedDocument AST synchronized for {document_id} ({len(updated_doc.pages)} pages).")

        except Exception as save_err:
            logger.error(f"Failed to save callback document: {save_err}", exc_info=True)

    # ONLYOFFICE Document Server expects {"error": 0} to acknowledge successful receipt
    return JSONResponse({"error": 0})


@router.get("/config/{document_id}")
def get_onlyoffice_config(document_id: str, request: Request):
    """
    Generates the complete DocsAPI.DocEditor initialization configuration
    tailored for this document, including the OneScript bridge plugin autostart.
    """
    target_path = os.path.join(UPLOAD_DIR, f"{document_id}.docx")
    matched = [f for f in os.listdir(UPLOAD_DIR) if f.startswith(document_id) and f.endswith(".docx")]
    if matched:
        target_path = os.path.join(UPLOAD_DIR, matched[0])

    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Document file not found.")

    doc_name = os.path.basename(target_path)
    file_mtime = int(os.path.getmtime(target_path))
    session_key = f"{document_id}_{file_mtime}"

    # download_url and callback_url are accessed by ONLYOFFICE container (via host.docker.internal)
    download_url = f"{BACKEND_HOST}/api/onlyoffice/download/{document_id}"
    callback_url = f"{BACKEND_HOST}/api/onlyoffice/callback/{document_id}"

    # plugin_config_url is fetched by the user's web browser client
    client_host = request.headers.get("host", "localhost:8000")
    protocol = "https" if request.url.scheme == "https" else "http"
    plugin_config_url = f"{protocol}://{client_host}/plugins/onescript/config.json"

    config = {
        "document": {
            "fileType": "docx",
            "key": session_key,
            "title": doc_name,
            "url": download_url,
            "permissions": {
                "edit": True,
                "download": True,
                "print": True,
                "review": True
            }
        },
        "documentType": "word",
        "editorConfig": {
            "callbackUrl": callback_url,
            "user": {
                "id": "dev-user",
                "name": "OneScript Analyst"
            },
            "customization": {
                "header": False,
                "statusBar": True,
                "chat": False,
                "comments": False,
                "feedback": False,
                "help": False,
                "compactToolbar": True,
                "toolbarHideFileName": True,
                "leftMenu": False,
                "rightMenu": False,
                "ruler": False,
                "uiTheme": "theme-dark",
                "zoom": 100,
                "about": False
            },
            "plugins": {
                "pluginsData": [
                    plugin_config_url
                ],
                "autostart": [
                    "asc.{9FDA57E0-71DF-4658-92DB-30387D3DAC70}"
                ]
            }
        }
    }

    return {
        "success": True,
        "document_id": document_id,
        "config": config,
        "doc_server_api_url": f"{ONLYOFFICE_HOST}/web-apps/apps/api/documents/api.js"
    }
