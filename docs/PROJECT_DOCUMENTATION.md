# Deep Learning System for Multimodal Document Understanding and Manipulation

**Department of Artificial Intelligence and Data Science**  
**M. Kumarasamy College of Engineering, Karur - 639 113**  
*(An Autonomous Institution Affiliated to Anna University, Chennai)*

---

### Project Identification & Team Metadata
* **Project Title:** DEEP LEARNING SYSTEM FOR MULTIMODAL DOCUMENT UNDERSTANDING AND MANIPULATION
* **Department:** Department of Artificial Intelligence and Data Science
* **Institution:** M. Kumarasamy College of Engineering, Karur
* **Team Members (as per College Records):**
  * **Saravana Priyan S T** – `927623BAD100`
  * **Sardheesh M** – `927623BAD101`
  * **Venkat Ragav N** – `927623BAD123`
  * **Vishnu V** – `927623BAD125`
* **Project Guide:** **Ms. C. BAVITHRA**, M.E., (Ph.D.), Assistant Professor / AI & DS
* **Target Milestone:** Project Work Phase I (Review I) $\to$ Phase II (Review II) Official Project Report

---

## 1. Problem Statement & Project Objectives (Slide 2 & 3 Alignment)

### 1.1 Problem Statement
Modern digital documents contain diverse and interrelated information in the form of text, tables, images, charts, signatures, and complex layouts. Existing document processing systems often handle these elements independently, making it difficult to understand the document as a cohesive whole. Furthermore, traditional systems maintain a sharp disconnect between **document understanding** (reading, information retrieval, question answering) and **document manipulation** (editing, styling, re-formatting). 

For the current milestone (**Review II**), our primary research and implementation focus is on building the comprehensive **Multimodal Document Understanding Foundation**—enabling deep cross-modal reasoning between text, layout, figures, and tables across multi-page documents. The manipulation and document generation modules are designed as the subsequent milestone (**Review III / Final Review**).

### 1.2 Objectives
1. **Intelligent Multimodal Understanding Framework:** Develop an intelligent framework for comprehensive document understanding by jointly analyzing textual, structural, visual, and spatial information present in digital documents.
2. **Unified Document Representation:** Establish a unified representation of document content and structure that captures fine-grained relationships between text, tables, figures, charts, and layouts.
3. **Cross-Modal Reasoning & Retrieval:** Enable robust cross-modal reasoning to detect cross-element linkages, support evidence-grounded question answering, and execute structure-aware document retrieval.
4. **Autonomous Cognitive Navigation:** Deploy a modular document agent equipped with human-reader tools to autonomously navigate document hierarchies, resolve figure captions, and verify visual diagrams.
5. **Architectural Foundation for Future Manipulation:** Lay the formal mathematical and structural representation necessary to support grounded document manipulation and validation in the subsequent phase.

---

## 2. Literature Survey & Research Gaps (Slide 4, 5, 6, 9 Alignment)

### 2.1 Literature Survey Matrix (9 Benchmark Papers)

| Sl. No. | Title of the Paper | Authors | Journal / Conference & Year | Problem Identified | Proposed Solution & Relation to Our System |
| :---: | :--- | :--- | :---: | :--- | :--- |
| **1** | *Scaling Beyond Context: A Survey of Multimodal Retrieval-Augmented Generation for Document Understanding* | Sensen Gao et al. | **ACL 2026** | OCR-based systems lose visual/structural information; MLLMs struggle with long multimodal documents. | Surveys fine-grained multimodal RAG. Informs our top-K cross-page evidence routing and structural AST grounding. |
| **2** | *M-LongDoc: A Benchmark for Multimodal Super-Long Document Understanding and a Retrieval-Aware Tuning Framework* | Yew Ken Chia et al. | **EMNLP 2025** | MLLMs struggle with super-long documents containing mixed text, figures, tables, and evidence retrieval. | Guides our multi-page continuous canvas viewer and section hierarchy clustering algorithms. |
| **3** | *MMDocIR: Benchmarking Multimodal Retrieval for Long Documents* | Kuicai Dong et al. | **EMNLP 2025** | Retrieval benchmarks inadequately evaluate multimodal elements such as figures, tables, and layouts. | Informs our dual-representation cross-modal fusion scoring ($S_{\text{fused}} = 0.65 S_{\text{struct}} + 0.35 S_{\text{visual}}$). |
| **4** | *Is Cognition Consistent with Perception? Assessing and Mitigating Multimodal Knowledge Conflicts in Document Understanding* | Zirui Shao et al. | **EMNLP 2025** | Multimodal LLMs generate conflicting answers when visual signals contradict textual assumptions. | Inspires our Multi-Turn Verification Guard which catches visual mismatches and initiates corrective re-routing. |
| **5** | *DocEdit-v2: Document Structure Editing Via Multimodal LLM Grounding* | Manan Suri et al. | **EMNLP 2024** | Natural-language document editing requires identifying the correct region and interpreting structural ops. | Benchmark for our upcoming manipulation design and directive fusion specifications. |
| **6** | *Pix2Struct: Screenshot Parsing as Pretraining for Visual Language Understanding* | Kenton Lee et al. | **ICML 2023** | Visually situated information (documents, tables) is difficult to represent via text-centric models. | Justifies our 150 DPI visual rasterization layer paired with PyMuPDF 2D coordinate extraction. |
| **7** | *DePlot: One-shot Visual Language Reasoning by Plot-to-Table Translation* | Fangyu Liu et al. | **Findings of ACL 2023** | Direct reasoning over complex charts/tables is fragile and requires specialized pre-training. | Informs our tabular clustering engine (`InspectTableTool`) that reconstructs structured markdown tables. |
| **8** | *DocFormer: End-to-End Transformer for Document Understanding* | Srikar Appalaraju et al. | **ICCV 2021** | Visual and spatial features are often decoupled from textual tokens in early multimodal backbones. | Foundation for our cross-modal fusion transformer combining text, ViT patches, and 2D bounding boxes. |
| **9** | *LayoutLM: Pre-training of Text and Layout for Document Image Understanding* | Yiheng Xu et al. | **KDD 2020** | Traditional NLP treats documents as 1D text, ignoring 2D spatial coordinates $[x_1, y_1, x_2, y_2]$. | Direct baseline for our 2D Spatial Layout Encoder and FUNSD benchmark training. |

### 2.2 Research Gaps Addressed
1. **Fragmented Modality Processing:** Existing systems handle text, tables, or charts as isolated pipelines. Our system provides **joint multimodal understanding** across all document elements.
2. **Weak Cross-Modal Reasoning:** Current VLMs struggle with fine-grained alignment between captions and graphics. Our system implements **caption-aware figure proximity linking ($\le 85\text{ pt}$)** and composite bounding box extraction.
3. **Limited Structural Grounding:** Image-only VLMs see document appearance but lack access to exact underlying structural AST element IDs and metadata. Our system bridges pixels to AST nodes directly.
4. **Multi-Turn Verification Absence:** Existing document QA models stop after a single visual crop even if a header logo was mistakenly targeted. Our system introduces an **Autonomous Verification Guard** that audits observations and re-routes.

---

## 3. Academic Review Roadmap & Phased Execution

To reflect our actual project implementation accurately, the roadmap is partitioned into two clear stages:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   CURRENT SCOPE (Review I & Review II Milestone)                 │
│              "Multimodal Document Processing & Understanding Core"               │
│                                                                                  │
│   [STATUS: 100% COMPLETED, BENCHMARKED & VERIFIED]                               │
│   • Module 1: Document Parser (Heterogeneous DOCX/PDF Ingestion)                 │
│   • Module 2: Structural Representation (AST Elements & Typography Tracking)     │
│   • Module 3: Visual Representation (150 DPI Bitmaps & High-Res Crop Endpoint)   │
│   • Module 4: Multimodal Fusion Core (ViT Patches + 2D Layout Encoder + Ranker)  │
│   • Module 5: Unified Document Model (UnifiedDocument Schema & Pointer Heads)    │
│   • Module 6: Understanding Module (Dual-Layer VLM, ReAct Agent, Figure Grounding)│
│   • Antigravity IDE-Style Web Application (React 19 + FastAPI + SSE Streaming)   │
│   • 26/26 Unit Tests Passing, FUNSD Training & Real Paper Benchmarks Verified     │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    UPCOMING SCOPE (Review III / Final Review)                    │
│                "Grounded Document Manipulation & Validation Engine"              │
│                                                                                  │
│   [STATUS: UNTOUCHED / PLANNED FOR FINAL REVIEW]                                 │
│   • Module 7: Manipulation Module (Instruction Interpretation & Operation Plan) │
│   • Module 8: Validation & Execution (Safety Gate, Dynamic Canvas, Word Export)  │
│   • Natural Language Editing Playground & Side-by-Side Canvas Diff Studio        │
│   • End-to-End Evaluation of Grounded Document Mutations on Scanned Forms        │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Specification of Project Modules (Slide 11 & 12 Alignment)

Below is the detailed implementation specification for each of the **8 Modules** defined on Slide 12 of the college presentation, clearly distinguishing between completed modules and upcoming work:

### Module 1: Document Parser
* **Main Function (PPT):** *Extract document content and structure from heterogeneous documents.*
* **Status:** **COMPLETED & VERIFIED (Review I & II Focus)**
* **Codebase Implementation:** [`src/parser/docx_parser.py`](file:///home/saravana/projects/final-year-project/src/parser/docx_parser.py), [`src/parser/pdf_parser.py`](file:///home/saravana/projects/final-year-project/src/parser/pdf_parser.py)
* **Key Achievements:**
  * **Native Headless Office Compiler:** Utilizes headless LibreOffice (`soffice --headless --convert-to pdf`) and PyMuPDF (`fitz`) to compile native Word `.docx` documents into vector PDFs in $<1.5$ seconds.
  * **100% Multi-Column Layout Fidelity:** Preserves IEEE two-column paper formats, author grids, mathematical formulas, and margins without column-collapse defects.
  * **Element Extraction:** Automatically identifies and extracts paragraph runs, heading style tiers (`Title`, `Heading 1` to `Heading 6`), table grids via `page.find_tables()`, and embedded graphic bitmaps via `page.get_image_info(xrefs=True)`.
  * **Coordinate Normalization:** Emits exact physical 2D bounding boxes $[x_1, y_1, x_2, y_2]$ in points alongside 150 DPI RGB page bitmap rasters.

---

### Module 2: Structural Representation
* **Main Function (PPT):** *Represent text, tables, layout, styles and relationships.*
* **Status:** **COMPLETED & VERIFIED (Review I & II Focus)**
* **Codebase Implementation:** [`src/schema/document.py`](file:///home/saravana/projects/final-year-project/src/schema/document.py)
* **Key Achievements:**
  * **Hierarchical AST Nodes:** Implements `DocumentElement` dataclass representing discrete semantic blocks (`heading`, `paragraph`, `table_row`, `image`).
  * **Fine-Grained Typographic Catalog (`ElementStyle`):** Tracks 12 typographic and layout attributes: `font_size`, `font_family`, `bold`, `italic`, `underline`, `strikethrough`, `color`, `alignment` (`left`, `center`, `right`, `justify`), `indent`, `line_spacing`, and `letter_spacing` (tracking).
  * **Integrity Validator:** Built-in `validate_integrity()` guarantees element ID uniqueness, page boundary containment, and coordinate validity.

---

### Module 3: Visual Representation
* **Main Function (PPT):** *Represent page visuals, charts, images and signatures.*
* **Status:** **COMPLETED & VERIFIED (Review I & II Focus)**
* **Codebase Implementation:** [`src/render/canvas.py`](file:///home/saravana/projects/final-year-project/src/render/canvas.py), [`src/agent/tools/visual_inspector_tool.py`](file:///home/saravana/projects/final-year-project/src/agent/tools/visual_inspector_tool.py), [`backend/routes/document_routes.py`](file:///home/saravana/projects/final-year-project/backend/routes/document_routes.py)
* **Key Achievements:**
  * **High-Resolution Page Bitmaps:** Generates 150 DPI base RGB page rasters reflecting authentic fonts and spatial dimensions.
  * **Spatial Visual Patch Cropping (`/api/documents/{id}/crop`):** Renders high-resolution cropped sub-regions around any bounding box $[x_1, y_1, x_2, y_2]$ with safety padding.
  * **Embedded Diagram & Flowchart Extraction:** Isolates embedded images, flowcharts, architectures, and tables for high-fidelity inspection by downstream multimodal reasoning engines.

---

### Module 4: Multimodal Fusion
* **Main Function (PPT):** *Combine information across modalities (text, vision, layout).*
* **Status:** **COMPLETED & VERIFIED (Review I & II Focus)**
* **Codebase Implementation:** [`src/models/vision.py`](file:///home/saravana/projects/final-year-project/src/models/vision.py), [`src/models/layout.py`](file:///home/saravana/projects/final-year-project/src/models/layout.py), [`src/models/fusion.py`](file:///home/saravana/projects/final-year-project/src/models/fusion.py), [`backend/routes/intelligence_routes.py`](file:///home/saravana/projects/final-year-project/backend/routes/intelligence_routes.py)
* **Key Achievements:**
  * **Vision Transformer (ViT) Patch Encoder:** Converts $224\times224$ visual bitmaps into 196 patch projection tokens $[B, 196, 256]$.
  * **2D Spatial Layout Encoder:** 2-layer MLP transforming normalized 6D bounding boxes $[x_1, y_1, x_2, y_2, w, h] \in [0, 1]^6$ fused with element type embeddings.
  * **Cross-Modal Attention:** Self-attention stack merging text tokens, visual patch tokens, and spatial layout coordinates with distinct modality indicators (`TEXT=0`, `VISION=1`, `LAYOUT=2`).
  * **Dual-Representation Mathematical Fusion Ranker:**
    $$S_{\text{fused}} = 0.65 \cdot S_{\text{struct}} + 0.35 \cdot S_{\text{visual}}$$
    Weights structural token relevance against visual typographic hierarchy and spatial position, eliminating front-matter author metadata hallucination.

---

### Module 5: Unified Document Model
* **Main Function (PPT):** *Maintain elements, properties, locations and relationships.*
* **Status:** **COMPLETED & VERIFIED (Review I & II Focus)**
* **Codebase Implementation:** [`src/schema/document.py`](file:///home/saravana/projects/final-year-project/src/schema/document.py), [`src/models/full_model.py`](file:///home/saravana/projects/final-year-project/src/models/full_model.py)
* **Key Achievements:**
  * **Unified Multimodal Container (`UnifiedDocument`):** Encapsulates multi-page document structures, page dimensions, physical image raster paths, and element hierarchies into a serializable, mutable object.
  * **Element Grounding Pointer Heads:** Cross-attentive pointer scoring candidate layout elements for Evidence Retrieval (Stage 5A) and Target Localization.
  * **Bidirectional Grounding Sync:** Maps every extracted paragraph and heading to its exact physical coordinates, enabling one-click smooth scrolling (`scrollToPageAndBbox`) and animated bounding box highlights.

---

### Module 6: Understanding Module
* **Main Function (PPT):** *Question answering, retrieval, summarization, analysis and cross-modal reasoning.*
* **Status:** **COMPLETED & VERIFIED (Review I & II Focus)**
* **Codebase Implementation:** [`src/models/vlm_engine.py`](file:///home/saravana/projects/final-year-project/src/models/vlm_engine.py), [`src/agent/orchestrator.py`](file:///home/saravana/projects/final-year-project/src/agent/orchestrator.py), [`src/agent/tools/*`](file:///home/saravana/projects/final-year-project/src/agent/tools/)
* **Key Achievements:**
  * **Multi-Engine Foundation Backbones:**
    * `Qwopus 3.5 9B` (Claude-distilled GGUF running via CUDA `llama-server` on port 8085 with 8K context and mmproj visual projection).
    * `Qwen2-VL-2B-Instruct` (Dual-Layer Foundation VLM running on PyTorch CUDA bfloat16).
    * Custom Baseline Model (~3.9M parameters scratch PyTorch model).
  * **Modular Autonomous ReAct Document Agent (`src/agent/`):**
    * Multi-step cognitive loop: $\text{Thought} \to \text{Action} \to \text{Observation} \to \text{Synthesis}$.
    * Human-Reader Tools: `get_document_outline`, `search_document`, `read_section`, `inspect_visual_region`, `inspect_table`.
  * **Caption-Aware Figure & Diagram Target Resolution (`_resolve_figure_target`):**
    * Regex figure token parsing (`Figure 1`, `Figure 5`, `Fig. 3`).
    * Proximity linking ($\le 85\text{ pt}$) linking figure captions to adjacent graphic blocks.
    * Composite bounding box extraction enclosing both the graphic diagram and its caption.
    * Top-of-page header logo filtering ($y < 150$, height $< 80\text{ pt}$) preventing logo misidentification.
  * **Autonomous Multi-Turn Verification Guard:**
    * Audits visual observations: detects whether the inspected page corresponds to the requested figure.
    * Automatically triggers a corrective navigation turn across the document hierarchy if a mismatch occurs.
  * **Streaming Scratchpad Isolation:**
    * Cleanly separates system instructions (`role: "system"`) and diverts model planning monologues to `thought_delta`, ensuring assistant response bubbles show only clean, structured Markdown answers.

---

### Module 7: Manipulation Module
* **Main Function (PPT):** *Instruction interpretation, target identification and operation planning.*
* **Status:** **UNTOUCHED / PLANNED FOR REVIEW III (Upcoming Phase)**
* **Proposed Scope & Planned Design:**
  * **Natural-Language Editing Grounding:** Translating arbitrary user instructions (e.g. *"Change the section heading to 18pt bold and amber"*) into structured AST mutation operations (`SET_STYLE`, `REPLACE_TEXT`, `HIGHLIGHT_ELEMENT`).
  * **Compound Directive Parsing:** Extracting compound multi-property updates from natural language including font size, weights, alignments, indentation, line spacing, and color tokens.
  * **Cross-Attentive Target Localization:** Leveraging pointer heads to map editing directives to exact physical AST element IDs.
  * *Implementation Status:* Formally designed and architected in schema; scheduled for implementation and empirical evaluation in Phase II (Review III).

---

### Module 8: Validation & Execution
* **Main Function (PPT):** *Verify constraints, safe abstention, apply modifications and export documents.*
* **Status:** **UNTOUCHED / PLANNED FOR REVIEW III (Upcoming Phase)**
* **Proposed Scope & Planned Design:**
  * **Deterministic Safety Gate:** Mathematical boundary validator enforcing constraints on font sizes $\in [6, 72]\text{ pt}$, margins, indents, and color sanitization before any modification touches the document state.
  * **Safe Abstention Policy:** Margin and entropy thresholds to safely abstain (`ABSTAIN` / `REQUEST_CONFIRMATION`) when model confidence is ambiguous.
  * **Dynamic Canvas Re-Rendering Engine:** Non-destructive bounding box erasing and TrueType font rendering to show live Before vs After document diffs.
  * **Native Microsoft Word DOCX Exporter:** Re-serializing modified AST elements back into editable Word OpenXML `.docx` files.
  * *Implementation Status:* Pipeline specification established; live execution engine scheduled for development in Phase II (Review III).

---

## 5. System Architecture & Active Workflow (Slide 8 & 10 Alignment)

The diagram below reflects the active document processing and multimodal understanding workflow evaluated for Review II:

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Researcher
    participant UI as React 19 Frontend
    participant API as FastAPI Backend
    participant Agent as ReAct Document Agent
    participant VLM as Qwopus 3.5 9B / Qwen2-VL

    User->>UI: Uploads Document (.docx / .pdf)
    UI->>API: POST /api/documents/upload
    API->>API: Parse via LibreOffice + PyMuPDF
    API-->>UI: Emits UnifiedDocument AST + 150 DPI Page Bitmaps

    Note over UI, VLM: Active Review II Understanding Workflow
    User->>UI: Submits Query ("explain Figure 5")
    UI->>API: POST /api/intelligence/qa/stream (SSE)
    API->>Agent: stream_agent_execution(doc, query)
    Agent->>Agent: _resolve_figure_target (links caption heading_4_2 to image_4_0 on Page 5)
    Agent-->>UI: Emits "Cognitive Planning Card" (SSE)
    Agent->>Agent: execute_tool(inspect_visual_region, page=5, bbox=[...])
    Agent-->>UI: Emits "Tool Execution Card" (Rendered 455x271 crop)
    Agent->>VLM: stream_question(image_crop, relevant_ast_elements)
    VLM-->>UI: Streams Thought & Formatted Answer Tokens
    Agent-->>UI: Yields "done" (Citations, Grounded BBox, Confidence 98%)
```

---

## 6. Hardware Specifications & Resource Envelope

The entire system was developed, trained, and evaluated on local workstation hardware:
* **GPU:** NVIDIA GeForce RTX 4050 Laptop GPU (6 GB GDDR6 Dedicated VRAM, Ada Lovelace, Compute Capability 8.9).
* **System RAM:** 16 GB DDR5 RAM.
* **Operating System:** Linux (Ubuntu 24.04 LTS / Debian).
* **VRAM Partitioning & Isolation:**
  * **`Qwopus 3.5 9B` (`llama-server`):** 24 GPU offloaded layers + mmproj offload $\to$ **5.25 GB VRAM** (882 MB safety headroom).
  * **`Qwen2-VL-2B`:** Evaluated in `bfloat16` CUDA acceleration $\to$ **3.50 GB VRAM**.
  * **Custom Baseline Model (~3.9M params):** PyTorch Mixed-Precision (AMP) $\to$ **<0.8 GB VRAM**.

---

## 7. Experimental Results & Verification Benchmarks

### 7.1 FUNSD Academic Corpus Benchmark (Scanned Forms)
* **Dataset:** 4,655 real multimodal document samples (199 real scanned forms, 3,508 train, 1,147 test).
* **Validation Metrics (25 Epochs on NVIDIA RTX 4050):**
  * Target Grounding Accuracy @1: **28.80%** (18.5× random baseline across 64 elements).
  * Target Grounding Accuracy @3: **50.93%**.
  * Operation Classification Accuracy: **100.00%**.
  * Property Identification Accuracy: **99.70%**.
  * Action / Answer Value Accuracy: **99.41%**.
  * Inference Latency: **1.94 ms (P50 / Median)**, **2.11 ms (P95)**.

### 7.2 Real Document Understanding Benchmarks
1. **IEEE 5-Page Formatted Academic Paper (`project_paper.docx`):**
   * **Multi-Column Layout:** 100% two-column IEEE format preservation matching Microsoft Word.
   * **Abstract Grounding:** Page 1 Block `#paragraph_0_19` (`[44.8, 298.6, 291.0, 557.0]`), Joint Confidence **94.5%**.
   * **Figure 1 Flowchart Architecture:** Page 2 composite bbox `[324.65, 38.5, 552.9, 173.18]`, Joint Confidence **97.9%**. Visual crop read 3-tier architecture (*User Interaction* $\to$ *Core Processing* $\to$ *Modular Intelligence Services*).
   * **Table 1 Metrics Table:** Page 3 Block `#paragraph_2_13`, Joint Confidence **98.0%**. Complete table reconstructed.
2. **Corporate Strategy Document (`POM SSA 1.docx`):**
   * **Conclusion Reasoning:** Section 6 (`#heading_3_4`) & body (`#paragraph_3_5`), bbox `[42.55, 263.71, 572.75, 357.29]`.
   * **Evolutionary Leadership Loop Diagram:** `#image_1_0` on Page 2 (bbox `[42.5, 406.35, 531.35, 649.35]`, 513×267 px crop). Visually OCR-read all 4 cyclical phases.
3. **Academic Paper with Embedded Diagrams & Logos (`SSA2-formatted.docx`):**
   * **Figure 5 Feature Importance Attribution:** `_resolve_figure_target` excluded Page 1 IBM logo and grounded `image_4_0` on Page 5 (caption `heading_4_2`, composite bbox `[81.55, 168.60, 512.47, 415.77]`). Visual crop (455×271 px) synthesized full attribution breakdown with **0% logo mismatch**.

### 7.3 Unit Test Suite & Codebase Integrity
* **Full Unit Test Suite:** **26/26 unit tests passing** cleanly in 7.03 seconds (`.venv/bin/pytest tests/`):
  * `tests/test_agent.py`: 7/7 passed.
  * `tests/test_execution.py`: 8/8 passed.
  * `tests/test_models.py`: 6/6 passed.
  * `tests/test_parser.py`: 2/2 passed.
  * `tests/test_schema.py`: 3/3 passed.
* **Frontend Production Build:** Vite build cleanly compiled in 1.00s with 0 errors (`npm run build`).

---

## 8. Frontend UI/UX: Step-by-Step Agentic IDE Experience

The frontend is built with **React 19 + Vite** with a modern dark slate design system (zero Tailwind, zero AI-slop neon halos, strict Inter and JetBrains Mono typography):
1. **Continuous Scrollable Multi-Page Document Viewer (`ScrollableDocumentViewer.jsx`):**
   * Continuous multi-page canvas with smooth zoom (In, Out, 100%, Fit) and quick-jump page chips.
   * **Vector Text Layer:** Interactive DOM selection layer supporting browser text highlighting and AABB marquee drag selection for multi-block text, embedded tables, and figures.
2. **Step-by-Step Agentic IDE Execution Feed (`AgenticChatSidecar.jsx`):**
   * Renders agent progress as individual action cards:
     * **Cognitive Planning Card:** Strategy formulation with cyan accent and `Strategized` badge.
     * **Tool Execution Card:** Tool badge (`inspect_visual_region`), parameter pills, live running spinner / green completion checkmark, and observation preview.
     * **Verification Guard Card:** Highlights corrective re-routing if a mismatch is detected.
     * **Multimodal Synthesis Card:** Confirms visual raster + AST evidence synchronization.
     * **Collapsible Raw Cognitive Log:** Clean dropdown allowing inspection of raw model monologues.
3. **Dual Representation & Multimodal Fusion Inspector:**
   * Visual patch crop preview, AST node attributes, and real-time score meters for Structural Semantic Relevance, Visual Layout Score, and Joint Multimodal Confidence.

---

## 9. Deliverables Summary & Milestone Status for Review II

| College Presentation Module (Slide 12) | Implementation Scope & Target | Review II Milestone Status |
| :--- | :--- | :---: |
| **1. Document Parser** | Native Headless Office Compiler + PyMuPDF Extraction | **100% COMPLETED & VERIFIED** |
| **2. Structural Representation** | Unified AST Dataclass (`DocumentElement`, `ElementStyle`) | **100% COMPLETED & VERIFIED** |
| **3. Visual Representation** | 150 DPI Bitmaps, High-Res Visual Patch Cropping Endpoint | **100% COMPLETED & VERIFIED** |
| **4. Multimodal Fusion** | ViT Patches + 2D Layout Encoder + Cross-Modal Fusion Transformer | **100% COMPLETED & VERIFIED** |
| **5. Unified Document Model** | `UnifiedDocument` Schema Container & Grounding Pointer Heads | **100% COMPLETED & VERIFIED** |
| **6. Understanding Module** | Qwopus 3.5 9B / Qwen2-VL, ReAct Agent, Caption Proximity Linking | **100% COMPLETED & VERIFIED** |
| **7. Manipulation Module** | Natural Language Instruction Interpretation & Operation Planning | **UNTOUCHED (Planned for Review III)** |
| **8. Validation & Execution** | Safety Gate, Abstention Policy, Canvas Patching & Word Export | **UNTOUCHED (Planned for Review III)** |
| **User Interface & Integration** | React 19 Continuous Viewer, Marquee Drag, Step-by-Step IDE Feed | **100% COMPLETED & VERIFIED** |
| **Quality Assurance** | 26/26 Pytest Suite Passed, Production Build Clean (1.00s) | **100% COMPLETED & VERIFIED** |

---

*Report compiled for M. Kumarasamy College of Engineering, Department of AI & DS, Project Review II.*
