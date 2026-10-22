"""
Document Library & Custom Folder Management Routes.
Backed by MongoDB for persistent folder hierarchy, document metadata, and chat history.
"""

import os
import time
import shutil
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from pydantic import BaseModel
from bson import ObjectId

from database.mongodb import get_db
from routes.auth_routes import get_current_user
from session_store import store_document, get_document
from parser import DocxDocumentParser, PdfDocumentParser
from render import render_canvas

router = APIRouter(prefix="/api/library", tags=["Document Library"])


class CreateFolderRequest(BaseModel):
    name: str
    color: Optional[str] = "#39ff14"
    icon: Optional[str] = "folder"
    description: Optional[str] = ""


class UpdateFolderRequest(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None


class MoveDocumentRequest(BaseModel):
    folder_id: Optional[str] = None  # None for uncategorized


class UpdateDocumentRequest(BaseModel):
    title: Optional[str] = None
    tags: Optional[List[str]] = None


class SaveChatMessageRequest(BaseModel):
    role: str
    text: str
    thought: Optional[Dict[str, Any]] = None
    citation: Optional[Dict[str, Any]] = None
    confidence: Optional[float] = None
    agentSteps: Optional[List[Dict[str, Any]]] = None


# --- FOLDER ENDPOINTS ---

@router.get("/folders")
def list_folders(current_user: dict = Depends(get_current_user)):
    db = get_db()
    if db is None:
        return {"folders": []}

    owner_id = str(current_user.get("id") or current_user.get("_id", "system"))
    folders_col = db["folders"]
    docs_col = db["documents"]

    # Retrieve folders for this user or global system folders
    user_folders = list(folders_col.find({
        "$or": [{"owner_id": owner_id}, {"owner_id": "system"}]
    }))

    out = []
    for f in user_folders:
        f_id = str(f["_id"])
        doc_count = docs_col.count_documents({"folder_id": f_id})
        out.append({
            "id": f_id,
            "name": f.get("name", "Untitled Folder"),
            "color": f.get("color", "#39ff14"),
            "icon": f.get("icon", "folder"),
            "description": f.get("description", ""),
            "doc_count": doc_count,
            "created_at": f.get("created_at", time.time())
        })

    # Add count for uncategorized
    uncategorized_count = docs_col.count_documents({
        "$and": [
            {"$or": [{"folder_id": None}, {"folder_id": ""}]},
            {"$or": [{"owner_id": owner_id}, {"owner_id": "system"}]}
        ]
    })

    return {
        "folders": out,
        "uncategorized_count": uncategorized_count,
        "total_documents": docs_col.count_documents({})
    }


@router.post("/folders")
def create_folder(req: CreateFolderRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable.")

    owner_id = str(current_user.get("id") or current_user.get("_id", "system"))
    folders_col = db["folders"]

    # Check for duplicate folder name
    if folders_col.find_one({"owner_id": owner_id, "name": req.name.strip()}):
        raise HTTPException(status_code=400, detail=f"Folder '{req.name.strip()}' already exists.")

    res = folders_col.insert_one({
        "name": req.name.strip(),
        "owner_id": owner_id,
        "color": req.color or "#39ff14",
        "icon": req.icon or "folder",
        "description": req.description or "",
        "created_at": time.time()
    })

    f_id = str(res.inserted_id)
    return {
        "id": f_id,
        "name": req.name.strip(),
        "color": req.color,
        "icon": req.icon,
        "description": req.description,
        "doc_count": 0,
        "message": f"Folder '{req.name.strip()}' created successfully."
    }


@router.delete("/folders/{folder_id}")
def delete_folder(folder_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable.")

    try:
        obj_id = ObjectId(folder_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid folder ID.")

    folders_col = db["folders"]
    docs_col = db["documents"]

    folder = folders_col.find_one({"_id": obj_id})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found.")

    # Unassign documents from this folder
    docs_col.update_many({"folder_id": folder_id}, {"$set": {"folder_id": None}})
    folders_col.delete_one({"_id": obj_id})

    return {"message": f"Folder '{folder.get('name')}' deleted. Contained files moved to Uncategorized."}


# --- DOCUMENT ENDPOINTS ---

@router.get("/documents")
def list_documents(
    folder_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    file_type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    if db is None:
        return {"documents": []}

    docs_col = db["documents"]
    folders_col = db["folders"]
    and_clauses: List[Dict[str, Any]] = []

    if folder_id:
        if folder_id == "uncategorized":
            and_clauses.append({"$or": [{"folder_id": None}, {"folder_id": ""}]})
        elif folder_id != "all":
            and_clauses.append({"folder_id": folder_id})

    if file_type and file_type != "all":
        and_clauses.append({"file_type": file_type.lower()})

    if search and search.strip():
        s = search.strip()
        and_clauses.append({
            "$or": [
                {"title": {"$regex": s, "$options": "i"}},
                {"filename": {"$regex": s, "$options": "i"}},
                {"tags": {"$regex": s, "$options": "i"}}
            ]
        })

    # Role-based visibility: Admins see all, others see own and system docs
    owner_id = str(current_user.get("id") or current_user.get("_id", "system"))
    user_role = current_user.get("role", "user")
    if user_role != "admin":
        and_clauses.append({"$or": [{"owner_id": owner_id}, {"owner_id": "system"}]})

    query_filter = {"$and": and_clauses} if and_clauses else {}
    docs = list(docs_col.find(query_filter).sort("last_opened_at", -1))

    # Build folder lookup
    all_folders = {str(f.get("_id", "")): f for f in folders_col.find({})}

    out = []
    for d in docs:
        f_id = d.get("folder_id")
        f_info = all_folders.get(f_id) if f_id else None

        out.append({
            "id": str(d["_id"]),
            "document_id": d.get("document_id"),
            "title": d.get("title") or d.get("filename"),
            "filename": d.get("filename"),
            "file_type": d.get("file_type", "pdf"),
            "file_path": d.get("file_path"),
            "file_size": d.get("file_size", 0),
            "page_count": d.get("page_count", 1),
            "tags": d.get("tags", []),
            "status": d.get("status", "ready"),
            "folder_id": f_id,
            "folder_name": f_info.get("name") if f_info else None,
            "folder_color": f_info.get("color") if f_info else None,
            "uploaded_at": d.get("uploaded_at", time.time()),
            "last_opened_at": d.get("last_opened_at", time.time())
        })

    return {"documents": out, "count": len(out)}


@router.post("/documents/{document_id}/move")
@router.patch("/documents/{document_id}/move")
def move_document(document_id: str, req: MoveDocumentRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable.")

    docs_col = db["documents"]
    doc = docs_col.find_one({"document_id": document_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    docs_col.update_one(
        {"document_id": document_id},
        {"$set": {"folder_id": req.folder_id, "last_opened_at": time.time()}}
    )

    return {"message": f"Document '{doc.get('title')}' moved successfully.", "folder_id": req.folder_id}


@router.put("/documents/{document_id}")
def update_document(document_id: str, req: UpdateDocumentRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable.")

    docs_col = db["documents"]
    doc = docs_col.find_one({"document_id": document_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    updates: Dict[str, Any] = {}
    if req.title:
        updates["title"] = req.title.strip()
    if req.tags is not None:
        updates["tags"] = req.tags

    if updates:
        docs_col.update_one({"document_id": document_id}, {"$set": updates})

    return {"message": "Document updated successfully.", "updates": updates}


@router.delete("/documents/{document_id}")
def delete_document(document_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable.")

    docs_col = db["documents"]
    chat_col = db["chat_sessions"]
    doc = docs_col.find_one({"document_id": document_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Remove database entries
    docs_col.delete_one({"document_id": document_id})
    chat_col.delete_many({"document_id": document_id})

    # Safely remove file on disk if exists in uploads/
    fpath = doc.get("file_path")
    if fpath and fpath.startswith("uploads/") and os.path.exists(fpath):
        try:
            os.remove(fpath)
        except Exception:
            pass

    return {"message": f"Document '{doc.get('title')}' and its chat history deleted."}


@router.post("/upload")
async def import_document(
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Imports a new document file (.pdf, .docx, or image), parses it into UnifiedDocument,
    saves it to disk and MongoDB, and associates it with the designated folder.
    """
    db = get_db()
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    ext = os.path.splitext(file.filename)[1].lower().replace(".", "")
    if ext not in ("pdf", "docx", "png", "jpg", "jpeg"):
        raise HTTPException(status_code=400, detail="Unsupported format. Upload PDF, DOCX, or PNG/JPEG image.")

    os.makedirs("uploads", exist_ok=True)
    raw_id = f"doc_{int(time.time())}_{os.urandom(3).hex()}"
    save_filename = f"{raw_id}_{file.filename}"
    save_path = os.path.join("uploads", save_filename)

    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = os.path.getsize(save_path)

    # Parse document into UnifiedDocument AST & generate visual page bitmaps
    renders_dir = os.path.join("uploads", "renders", raw_id)
    os.makedirs(renders_dir, exist_ok=True)
    try:
        if ext in ("docx", "doc"):
            parser = DocxDocumentParser(render_dpi=150)
            parsed_doc = parser.parse(save_path, output_image_dir=renders_dir)
        else:
            parser = PdfDocumentParser(render_dpi=150)
            parsed_doc = parser.parse(save_path, output_image_dir=renders_dir)

        # Ensure every page has a raster bitmap path
        for p_idx, page in enumerate(parsed_doc.pages):
            if not page.image_path or not os.path.exists(page.image_path):
                img = render_canvas(parsed_doc, page_id=p_idx)
                img_path = os.path.join(renders_dir, f"page_{p_idx}.png")
                img.save(img_path)
                page.image_path = str(img_path)

        parsed_doc.document_id = raw_id
        store_document(raw_id, parsed_doc)
        page_count = len(parsed_doc.pages)
    except Exception as parse_err:
        page_count = 1

    doc_title = title.strip() if title else file.filename.replace("-", " ").replace("_", " ").title()
    owner_id = str(current_user.get("id") or current_user.get("_id", "system"))

    if db is not None:
        db["documents"].insert_one({
            "document_id": raw_id,
            "owner_id": owner_id,
            "folder_id": folder_id if folder_id and folder_id != "uncategorized" else None,
            "title": doc_title,
            "filename": file.filename,
            "file_type": ext,
            "file_path": save_path,
            "file_size": file_size,
            "page_count": page_count,
            "tags": [ext, "custom-upload"],
            "status": "ready",
            "uploaded_at": time.time(),
            "last_opened_at": time.time()
        })

    return {
        "document_id": raw_id,
        "title": doc_title,
        "filename": file.filename,
        "file_type": ext,
        "page_count": page_count,
        "folder_id": folder_id,
        "message": f"Successfully imported '{file.filename}' into document library."
    }


# --- CHAT SESSION HISTORY ---

@router.get("/documents/{document_id}/chat")
def get_chat_history(document_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if db is None:
        return {"messages": []}

    chat_col = db["chat_sessions"]
    session = chat_col.find_one({"document_id": document_id})
    if not session:
        return {"messages": []}

    return {"messages": session.get("messages", [])}


@router.post("/documents/{document_id}/chat")
def save_chat_message(document_id: str, req: SaveChatMessageRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if db is None:
        return {"status": "skipped"}

    chat_col = db["chat_sessions"]
    user_id = str(current_user.get("id") or current_user.get("_id", "system"))

    msg_obj = {
        "id": f"msg_{int(time.time()*1000)}",
        "role": req.role,
        "text": req.text,
        "thought": req.thought,
        "citation": req.citation,
        "confidence": req.confidence,
        "agentSteps": req.agentSteps,
        "timestamp": time.strftime("%H:%M")
    }

    chat_col.update_one(
        {"document_id": document_id},
        {
            "$push": {"messages": msg_obj},
            "$set": {"user_id": user_id, "updated_at": time.time()}
        },
        upsert=True
    )

    return {"status": "saved", "message_id": msg_obj["id"]}
