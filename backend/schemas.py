"""
Pydantic Schemas for FastAPI API Endpoints
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ElementDTO(BaseModel):
    id: str
    type: str
    page: int
    bbox: List[float]
    text: str = ""
    style: Dict[str, Any] = Field(default_factory=dict)


class PageDTO(BaseModel):
    page_id: int
    width: float
    height: float
    image_url: Optional[str] = None
    elements: List[ElementDTO] = Field(default_factory=list)


class DocumentSummaryDTO(BaseModel):
    document_id: str
    filename: str
    page_count: int
    pages: List[PageDTO]


class QARequest(BaseModel):
    document_id: str
    page_idx: int = 0
    query: str
    engine: str = "qwopus-9b"  # "qwopus-9b", "dual-layer-vlm", or "custom-compact"
    scope_mode: str = "whole_doc"  # "whole_doc" or "selected_region"
    region_bbox: Optional[List[float]] = None  # [x1, y1, x2, y2] in pt


class QAResponse(BaseModel):
    document_id: str
    page_idx: int
    query: str
    answer: str
    grounded_element_id: Optional[str] = None
    grounded_bbox: Optional[List[float]] = None
    evidence_text: Optional[str] = None
    confidence: float
    reasoning: str
    latency_ms: float
    engine: str
    scope_mode: str = "whole_doc"
    citation_label: Optional[str] = None
    interpretability: Optional[Dict[str, Any]] = None


class ManipulateRequest(BaseModel):
    document_id: str
    page_idx: int = 0
    instruction: str
    target_id: Optional[str] = None
    target_text: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
    engine: str = "qwopus-9b"  # "qwopus-9b", "dual-layer-vlm", or "custom-compact"
    render_engine: str = "native-office"  # "native-office" (LibreOffice 150 DPI) or "canvas" (PIL)


class ManipulateResponse(BaseModel):
    document_id: str
    page_idx: int
    success: bool
    target_element_id: Optional[str] = None
    target_index: Optional[int] = None
    target_text: Optional[str] = None
    target_bbox: Optional[List[float]] = None
    operation: Optional[str] = None
    property: Optional[str] = None
    value: Any = None
    confidence: float
    decision: str  # "EXECUTE", "REQUEST_CONFIRMATION", "ABSTAIN"
    reasoning: str
    state_diff: Dict[str, Any] = Field(default_factory=dict)
    re_rendered_image_url: Optional[str] = None
    latency_ms: float
    engine: str
    undo_count: int = 0
    redo_count: int = 0
    applied_plans: List[Dict[str, Any]] = Field(default_factory=list)
    error: Optional[str] = None


class CheckpointActionRequest(BaseModel):
    document_id: str
    page_idx: int = 0
    render_engine: str = "native-office"


class CheckpointActionResponse(BaseModel):
    document_id: str
    page_idx: int
    success: bool
    undo_count: int = 0
    redo_count: int = 0
    re_rendered_image_url: Optional[str] = None
    message: str


class BenchmarkSampleDTO(BaseModel):
    id: str
    label: str
    document_id: str
    instruction: str
    task_type: str
    image_url: str
    elements: List[Dict[str, Any]]
