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

export async function runQA({
  documentId,
  pageIdx = 0,
  query,
  engine = 'qwopus-9b',
  scopeMode = 'whole_doc',
  regionBbox = null,
}) {
  const res = await fetch(`${API_BASE}/intelligence/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: documentId,
      page_idx: pageIdx,
      query,
      engine,
      scope_mode: scopeMode,
      region_bbox: regionBbox,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'QA inference failed');
  }
  return res.json();
}

export async function streamQA({
  documentId,
  pageIdx = 0,
  query,
  engine = 'qwopus-9b',
  scopeMode = 'whole_doc',
  regionBbox = null,
  abortSignal,
  onThoughtDelta,
  onAgentStep,
  onAnswerDelta,
  onDone,
  onError,
}) {
  try {
    const res = await fetch(`${API_BASE}/intelligence/qa/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: documentId,
        page_idx: pageIdx,
        query,
        engine,
        scope_mode: scopeMode,
        region_bbox: regionBbox,
      }),
      signal: abortSignal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Streaming QA request failed');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let doneReceived = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6).trim();
        if (dataStr === '[DONE]') continue;

        let payload;
        try {
          payload = JSON.parse(dataStr);
        } catch (parseErr) {
          console.debug('SSE chunk parse info:', parseErr);
          continue;
        }

        if (payload.type === 'thought_delta') {
          if (onThoughtDelta) onThoughtDelta(payload.delta);
        } else if (payload.type === 'tool_call') {
          if (onAgentStep) {
            onAgentStep({
              type: 'tool_call',
              tool: payload.tool,
              args: payload.args || {},
            });
          }
          if (onThoughtDelta) {
            onThoughtDelta(`\n> 🛠️ **Agent Action**: Calling tool \`${payload.tool}\` with \`${JSON.stringify(payload.args || {})}\`...\n`);
          }
        } else if (payload.type === 'tool_result') {
          if (onAgentStep) {
            onAgentStep({
              type: 'tool_result',
              tool: payload.tool,
              summary: payload.summary || '',
              output: payload.output || '',
            });
          }
          if (onThoughtDelta) {
            onThoughtDelta(`> 📋 **Observation**: ${payload.summary || 'Retrieved results.'}\n\n`);
          }
        } else if (payload.type === 'answer_delta') {
          if (onAnswerDelta) onAnswerDelta(payload.delta);
        } else if (payload.type === 'done') {
          doneReceived = true;
          if (onDone) onDone(payload.result);
        } else if (payload.type === 'error') {
          throw new Error(payload.error || 'Server reported an error during streaming.');
        }
      }
    }

    if (!doneReceived && !abortSignal?.aborted) {
      throw new Error('Streaming connection closed before response was completed.');
    }
  } catch (err) {
    if (err.name === 'AbortError' || abortSignal?.aborted) {
      console.log('QA stream generation aborted by user.');
      return;
    }
    if (onError) onError(err);
    else throw err;
  }
}

export async function runManipulation({
  documentId,
  pageIdx = 0,
  instruction,
  targetId = null,
  targetText = null,
  properties = null,
  engine = 'qwopus-9b',
  renderEngine = 'native-office',
}) {
  const res = await fetch(`${API_BASE}/intelligence/manipulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: documentId,
      page_idx: pageIdx,
      instruction,
      target_id: targetId,
      target_text: targetText,
      properties: properties,
      engine,
      render_engine: renderEngine,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Document manipulation failed');
  }
  return res.json();
}

export async function undoManipulation({ documentId, pageIdx = 0, renderEngine = 'native-office' }) {
  const res = await fetch(`${API_BASE}/intelligence/manipulate/undo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: documentId,
      page_idx: pageIdx,
      render_engine: renderEngine,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Undo manipulation failed');
  }
  return res.json();
}

export async function redoManipulation({ documentId, pageIdx = 0, renderEngine = 'native-office' }) {
  const res = await fetch(`${API_BASE}/intelligence/manipulate/redo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: documentId,
      page_idx: pageIdx,
      render_engine: renderEngine,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Redo manipulation failed');
  }
  return res.json();
}

export async function getCheckpoints(documentId) {
  const res = await fetch(`${API_BASE}/intelligence/manipulate/checkpoints/${documentId}`);
  if (!res.ok) return { undo_count: 0, redo_count: 0 };
  return res.json();
}

export function getExportUrl(docId) {
  return `${API_BASE}/export/${docId}`;
}
