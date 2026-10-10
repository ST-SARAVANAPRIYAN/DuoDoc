/**
 * Centralized API Client for IntelliDoc Backend
 */

const API_BASE = '/api';

export async function fetchSystemStatus() {
  const res = await fetch(`${API_BASE}/system/status`);
  if (!res.ok) throw new Error('Failed to fetch system status');
  return res.json();
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Document upload and parsing failed');
  }
  return res.json();
}

export async function fetchDocument(docId) {
  const res = await fetch(`${API_BASE}/documents/${docId}`);
  if (!res.ok) throw new Error(`Document ${docId} not found`);
  return res.json();
}

export async function fetchBenchmarkSamples() {
  const res = await fetch(`${API_BASE}/documents/benchmarks/samples`);
  if (!res.ok) throw new Error('Failed to load benchmark samples');
  return res.json();
}

export async function runQA({ documentId, pageIdx = 0, query, engine = 'dual-layer-vlm' }) {
  const res = await fetch(`${API_BASE}/intelligence/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: documentId,
      page_idx: pageIdx,
      query,
      engine,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'QA inference failed');
  }
  return res.json();
}

export async function runManipulation({ documentId, pageIdx = 0, instruction, engine = 'dual-layer-vlm' }) {
  const res = await fetch(`${API_BASE}/intelligence/manipulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: documentId,
      page_idx: pageIdx,
      instruction,
      engine,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Document manipulation failed');
  }
  return res.json();
}

export function getExportUrl(docId) {
  return `${API_BASE}/export/${docId}`;
}
