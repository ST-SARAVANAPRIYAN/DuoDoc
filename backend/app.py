"""
IntelliDoc FastAPI Backend Application
Serves REST API endpoints for:
- Document Parsing & Multi-Page Rasterization
- Dual-Layer Foundation VLM & Custom Compact QA
- Grounded Instruction Manipulation & Visual Re-Rendering
- Native Microsoft Word (.docx) Export
- Hardware & Checkpoint Health Status
"""

import os
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Ensure src and backend are on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = BASE_DIR / "src"
BACKEND_DIR = BASE_DIR / "backend"

for p in (str(SRC_DIR), str(BACKEND_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from config import UPLOAD_DIR
from routes.system_routes import router as system_router
from routes.document_routes import router as document_router
from routes.intelligence_routes import router as intelligence_router
from routes.export_routes import router as export_router
from routes.auth_routes import router as auth_router
from routes.document_library_routes import router as library_router
from database.mongodb import init_db

app = FastAPI(
    title="IntelliDoc Intelligence API",
    description="Multimodal Document Understanding & Grounded Manipulation REST API",
    version="2.0.0"
)

# Enable CORS for React Frontend (default Vite port 5173 and all origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Uploads & Renders so Frontend can load document images
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Include Routers
app.include_router(system_router)
app.include_router(auth_router)
app.include_router(library_router)
app.include_router(document_router)
app.include_router(intelligence_router)
app.include_router(export_router)


@app.on_event("startup")
def startup_event():
    try:
        init_db()
    except Exception as e:
        print(f"Startup MongoDB initialization warning: {e}")


@app.get("/")
def root():
    return {
        "system": "IntelliDoc Multimodal Document Intelligence System",
        "api_docs": "/docs",
        "status": "online"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
