import React, { useState, useEffect } from 'react';
import { Upload, Search, Sparkles, CheckCircle2, AlertCircle, FileText, Loader2 } from 'lucide-react';
import DocumentCanvas from '../components/DocumentCanvas';
import { uploadDocument, fetchBenchmarkSamples, runQA } from '../api/client';

export default function UnderstandingView({ activeEngine }) {
  const [docSummary, setDocSummary] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [benchmarkSamples, setBenchmarkSamples] = useState([]);
  const [selectedSampleId, setSelectedSampleId] = useState('');
  const [inputMode, setInputMode] = useState('upload'); // 'upload' or 'benchmark'

  const [query, setQuery] = useState('Find information for form field: "To:"');
  const [isLoading, setIsLoading] = useState(false);
  const [qaResult, setQaResult] = useState(null);
  const [error, setError] = useState(null);

  // Load benchmark samples on mount
  useEffect(() => {
    fetchBenchmarkSamples()
      .then((samples) => {
        setBenchmarkSamples(samples);
        if (samples.length > 0 && !docSummary) {
          setSelectedSampleId(samples[0].id);
        }
      })
      .catch((err) => console.warn('Could not fetch benchmark samples:', err));
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setQaResult(null);

    try {
      const summary = await uploadDocument(file);
      setDocSummary(summary);
      setCurrentPage(0);
      if (summary.pages?.[0]?.elements?.length > 0) {
        const firstEl = summary.pages[0].elements[0];
        setQuery(`What is the information regarding: "${firstEl.text.slice(0, 30)}"?`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectBenchmark = (sampleId) => {
    setSelectedSampleId(sampleId);
    const sample = benchmarkSamples.find((s) => s.id === sampleId);
    if (sample) {
      setDocSummary({
        document_id: sample.document_id,
        filename: sample.label,
        page_count: 1,
        pages: [
          {
            page_id: 0,
            image_url: sample.image_url,
            elements: sample.elements,
          },
        ],
      });
      setCurrentPage(0);
      setQuery(sample.instruction || 'Find information in this form');
      setQaResult(null);
    }
  };

  const handleRunQA = async () => {
    if (!docSummary) {
      setError('Please upload a document or select a benchmark sample first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await runQA({
        documentId: docSummary.document_id,
        pageIdx: currentPage,
        query,
        engine: activeEngine,
      });
      setQaResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const activePage = docSummary?.pages?.[currentPage];
  const activeImageUrl = activePage?.image_url;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.35rem' }}>
          Document Understanding & Evidence Retrieval
        </h2>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Slide 10: Stage 5A (Extractive Question Answering & Supporting Evidence Grounding)
        </div>
      </div>

      <div className="split-workspace">
        {/* Left Pane: Document Canvas */}
        <div>
          <DocumentCanvas
            title={`Evidence Overlay [${docSummary?.filename || 'No Document'}]`}
            imageUrl={activeImageUrl}
            currentPage={currentPage}
            pageCount={docSummary?.page_count || 1}
            onPageChange={(p) => setCurrentPage(p)}
            highlightBbox={qaResult?.grounded_bbox}
            highlightLabel={qaResult?.grounded_element_id ? `EVIDENCE: ${qaResult.grounded_element_id}` : null}
            highlightColor="#10B981"
          />
        </div>

        {/* Right Pane: Controls & Diagnostics */}
        <div className="glass-panel">
          {/* Mode Switcher */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <button
              className={`action-btn ${inputMode === 'upload' ? 'action-btn-primary' : 'action-btn-secondary'}`}
              style={{ flex: 1, padding: '0.55rem' }}
              onClick={() => setInputMode('upload')}
            >
              Upload Word (.docx)
            </button>
            <button
              className={`action-btn ${inputMode === 'benchmark' ? 'action-btn-primary' : 'action-btn-secondary'}`}
              style={{ flex: 1, padding: '0.55rem' }}
              onClick={() => {
                setInputMode('benchmark');
                if (benchmarkSamples.length > 0 && (!docSummary || !docSummary.document_id.startsWith('funsd'))) {
                  handleSelectBenchmark(benchmarkSamples[0].id);
                }
              }}
            >
              Real Scanned Benchmarks
            </button>
          </div>

          {/* Mode A: Drag & Drop Upload */}
          {inputMode === 'upload' && (
            <label className="dropzone">
              <input
                type="file"
                accept=".docx,.doc"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <div className="dropzone-icon">
                <Upload />
              </div>
              <div className="dropzone-title">Upload Word Document (.docx)</div>
              <div className="dropzone-desc">High-fidelity visual layout parsing, TrueType typography & 2D layout coordinates</div>
            </label>
          )}

          {/* Mode B: Benchmark Form Picker */}
          {inputMode === 'benchmark' && (
            <div className="input-group">
              <label className="input-label">Select International FUNSD Benchmark Form:</label>
              <select
                className="text-input"
                value={selectedSampleId}
                onChange={(e) => handleSelectBenchmark(e.target.value)}
              >
                {benchmarkSamples.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} — "{s.instruction.slice(0, 45)}..."
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Natural Language Information Request */}
          <div className="input-group">
            <label className="input-label">Natural Language Query / Field to Locate:</label>
            <input
              type="text"
              className="text-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Find invoice date or total amount"
            />
          </div>

          {/* Quick Query Suggestions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
            {['Find form field: "To:"', 'What is the date of this document?', 'Find Total Amount', 'Who is the author / sender?'].map((chip) => (
              <button
                key={chip}
                onClick={() => setQuery(chip)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Run Inference Button */}
          <button
            className="action-btn action-btn-primary"
            onClick={handleRunQA}
            disabled={isLoading || !docSummary}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Executing Neural Multimodal Inference...
              </>
            ) : (
              <>
                <Search size={18} />
                Run Neural Understanding Inference
              </>
            )}
          </button>

          {error && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: '8px', color: '#EF4444', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {/* Diagnostic Result Card */}
          {qaResult && (
            <div className="diagnostic-panel">
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={16} /> Neural Understanding Diagnostics (Stage 5A)
              </div>

              <div className="diag-item">
                <div className="diag-key">Extracted Answer</div>
                <div className="diag-val evidence-highlight-text">{qaResult.answer}</div>
              </div>

              <div className="diag-item">
                <div className="diag-key">Retrieved Element ID</div>
                <div className="diag-val" style={{ color: '#38BDF8', fontWeight: 700 }}>
                  {qaResult.grounded_element_id || 'N/A'}
                </div>
              </div>

              {qaResult.evidence_text && (
                <div className="diag-item">
                  <div className="diag-key">Evidence Snippet</div>
                  <div className="diag-val" style={{ color: 'var(--text-secondary)' }}>
                    "{qaResult.evidence_text}"
                  </div>
                </div>
              )}

              <div className="diag-item">
                <div className="diag-key">Cross-Modal Reasoning</div>
                <div className="diag-val" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: '0.82rem' }}>
                  {qaResult.reasoning}
                </div>
              </div>

              <div className="diag-item">
                <div className="diag-key">Confidence & Latency</div>
                <div className="diag-val">
                  <b>{(qaResult.confidence * 100).toFixed(1)}%</b> joint confidence | <b>{qaResult.latency_ms} ms</b>
                </div>
              </div>

              <div className="diag-item">
                <div className="diag-key">Active Engine</div>
                <div className="diag-val" style={{ fontSize: '0.78rem', color: '#6366F1' }}>
                  {qaResult.engine}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
