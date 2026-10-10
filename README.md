# IntelliDoc | Deep Learning System for Multimodal Document Understanding and Manipulation

**Department of Artificial Intelligence and Data Science**  
**M. Kumarasamy College of Engineering, Karur**  
**Team 15:** Saravana Priyan S T, Sardheesh M, Venkat Ragav N, Vishnu V  
**Project Guide:** Ms. C. Bavithra  
**Target Milestone:** Project Review I $\to$ Review II Ready  

---

## 🏗️ Project Architecture & Reorganized Structure

```
final-year-project/
├── backend/                  # FastAPI REST Microservice
│   ├── app.py                # Main application entrypoint & static mount
│   ├── session_store.py      # In-memory document and model caching
│   ├── schemas.py            # Pydantic request/response models
│   └── routes/               # Modular REST routes
│       ├── system_routes.py        # /api/system/status (GPU, Checkpoints)
│       ├── document_routes.py      # /api/documents/upload, /benchmarks/samples
│       ├── intelligence_routes.py  # /api/intelligence/qa, /manipulate
│       └── export_routes.py        # /api/export/{doc_id} (.docx stream)
│
├── frontend/                 # Modern React 19 Frontend (Vite + Vanilla CSS)
│   ├── src/
│   │   ├── api/client.js     # Backend fetch client
│   │   ├── components/       # Header, DocumentCanvas, SystemStatusModal
│   │   ├── views/            # SpecificationView, UnderstandingView, ManipulationView
│   │   ├── index.css         # Rich dark-mode design system
│   │   └── App.jsx
│   ├── index.html
│   └── vite.config.js        # Port 5173 with proxy to backend port 8000
│
├── src/                      # Core Deep Learning & Document Pipeline
│   ├── config.py             # Configurable checkpoint paths & hardware config
│   ├── schema/               # UnifiedDocument AST dataclasses
│   ├── parser/               # Heterogeneous PDF (PyMuPDF) & DOCX parsers
│   ├── render/               # Dynamic visual canvas rasterization
│   ├── models/               # DualLayerVLMSystem, ViT, Layout, Fusion transformers
│   ├── execution/            # Safety gate, AST state executor, abstention policy
│   ├── export/               # Native Microsoft Word (.docx) generation
│   └── evaluation/           # Benchmark suites (FUNSD evaluation)
│
├── checkpoints/              # Checkpoint directory (User-configurable via .env)
│   ├── README.md             # How to place downloaded model weights
│   ├── best_model.pt         # (Custom 3.9M baseline weights)
│   ├── tokenizer.json        # Subword vocabulary JSON
│   └── val_map.json          # Target value classes
│
├── data/                     # FUNSD dataset & Office corpus manifests
├── docs/                     # Presentations, PDFs, and phase tracking log
├── college-docs/             # Project paper (.docx) & Review slides (.pptx)
├── tests/                    # 15/15 unit test suite (pytest)
├── requirements.txt          # Python dependencies
├── .env.example              # Environment variables template
├── run.sh                    # Unified one-click runner (starts & stops both together)
├── run_backend.sh            # FastAPI backend launcher
└── run_frontend.sh           # React Vite frontend launcher
```

---

## 🚀 Quickstart: Unified Runner (Starts & Stops Both Together)

To launch both the **FastAPI Backend (port 8000)** and **React Frontend (port 5173)** simultaneously with automatic shutdown:

```bash
./run.sh
```

* **React Frontend:** Open **`http://localhost:5173`**
* **FastAPI Backend:** Open **`http://localhost:8000`** *(API Docs: `http://localhost:8000/docs`)*
* **Clean Shutdown:** Press `Ctrl+C` in the terminal to immediately terminate both servers and release all ports & GPU resources.

---

## ⚙️ Model Checkpoints & Configuration

You can place your downloaded model weights in `./checkpoints/` or set custom paths via `.env`:
* Copy `.env.example` to `.env`:
  ```bash
  cp .env.example .env
  ```
* Customize any paths:
  * `CHECKPOINT_DIR=/path/to/checkpoints`
  * `CUSTOM_MODEL_PATH=/path/to/best_model.pt`
  * `VLM_MODEL_PATH=Qwen/Qwen2-VL-2B-Instruct` *(or a local directory containing downloaded weights)*

---

## 🧪 Verification & Unit Tests
Run the complete test suite:
```bash
.venv/bin/pytest tests/ -v
```
All **15/15 unit tests pass** across schema integrity, parsers, vision-language backbones, and safety execution gates.
