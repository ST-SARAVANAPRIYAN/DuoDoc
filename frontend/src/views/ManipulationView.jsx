import React, { useState } from 'react';
import { Edit3, Download, ShieldCheck, CheckCircle, AlertTriangle, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import DocumentCanvas from '../components/DocumentCanvas';
import { uploadDocument, runManipulation, getExportUrl } from '../api/client';

export default function ManipulationView({ activeEngine }) {
  const [docSummary, setDocSummary] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [instruction, setInstruction] = useState('Change the heading to 18pt bold emerald green');
  const [isLoading, setIsLoading] = useState(false);
  const [manipResult, setManipResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setManipResult(null);

    try {
      const summary = await uploadDocument(file);
      setDocSummary(summary);
      setCurrentPage(0);
      if (summary.pages?.[0]?.elements?.length > 0) {
        const firstHeading = summary.pages[0].elements.find((el) => el.type === 'heading') || summary.pages[0].elements[0];
        setInstruction(`Make the heading "${firstHeading.text.slice(0, 25)}" 18pt bold and color #059669`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!docSummary) {
      setError('Please upload a document to edit.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await runManipulation({
        documentId: docSummary.document_id,
        pageIdx: currentPage,
        instruction,
        engine: activeEngine,
      });
      setManipResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const activePage = docSummary?.pages?.[currentPage];
  const origImageUrl = activePage?.image_url;
  const reRenderedImageUrl = manipResult?.re_rendered_image_url;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.35rem' }}>
          Grounded Document Manipulation Studio
        </h2>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Slide 10: Stages 5B, 6, & 7 (Grounded Instruction Planning, Safety Gate & Live Canvas Re-Rendering)
        </div>
      </div>

      {/* Upload Header if no doc */}
      {!docSummary && (
        <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
          <label className="dropzone" style={{ margin: 0 }}>
            <input
              type="file"
              accept=".docx,.doc"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <div className="dropzone-icon">
              <Edit3 />
            </div>
            <div className="dropzone-title">Upload Word Document to Manipulate (.docx)</div>
            <div className="dropzone-desc">Upload Microsoft Word (.docx) to perform grounded structural and visual transformations</div>
          </label>
        </div>
      )}

      {docSummary && (
        <>
          {/* Top Control Bar */}
          <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label className="input-label">Natural Language Edit Instruction:</label>
                <input
                  type="text"
                  className="text-input"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="e.g. Set heading font size to 18pt bold and alignment to center"
                />
              </div>

              <button
                className="action-btn action-btn-primary"
                style={{ width: 'auto', minWidth: '240px' }}
                onClick={handleExecute}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Planning & Executing...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Execute Grounded Manipulation
                  </>
                )}
              </button>

              <label className="action-btn action-btn-secondary" style={{ width: 'auto', cursor: 'pointer' }}>
                <input
                  type="file"
                  accept=".docx,.doc"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                Change Word Doc
              </label>
            </div>

            {/* Quick Suggestions */}
            <div style={{ marginTop: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                Quick Formatting & Layout Presets:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {[
                  { label: '🔥 22pt Bold + Emerald Green', text: 'Make the main heading 22pt bold and color #059669' },
                  { label: '🔤 Center Align + Times New Roman', text: 'Center align heading and set font to Times New Roman' },
                  { label: '✏️ Underline & Strikethrough', text: 'Add underline and strikethrough to heading' },
                  { label: '📐 Indent 30pt', text: 'Indent paragraph by 30pt' },
                  { label: '📏 Double Line Spacing + 14pt', text: 'Double line spacing and 14pt font' },
                  { label: '↔️ Letter Spacing 3pt (Tracking)', text: 'Letter spacing 3pt with expanded tracking' },
                  { label: '💡 Highlight Yellow + Italic', text: 'Highlight paragraph in yellow and make italic' },
                  { label: '↩️ Remove Bold & Left Align', text: 'Remove bold and set alignment to left' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setInstruction(preset.text)}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-full)',
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.color = '#FFFFFF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: '8px', color: '#EF4444', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {/* Side-by-Side Canvases: Before vs After */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <DocumentCanvas
                title="1. Original Document Canvas (Before Execution)"
                imageUrl={origImageUrl}
                currentPage={currentPage}
                pageCount={docSummary.page_count}
                onPageChange={(p) => setCurrentPage(p)}
              />
            </div>

            <div>
              <DocumentCanvas
                title="2. Dynamic Visual Re-Rendering (After Execution)"
                imageUrl={reRenderedImageUrl || origImageUrl}
                currentPage={currentPage}
                pageCount={docSummary.page_count}
                onPageChange={(p) => setCurrentPage(p)}
                highlightColor="#0284C7"
              />
            </div>
          </div>

          {/* Execution & Audit Panel */}
          {manipResult && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr', gap: '1.5rem' }}>
              <div className="diagnostic-panel" style={{ marginTop: 0 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={16} /> Stage 6: Safety Validation & Action Audit
                </div>

                <div className="diag-item">
                  <div className="diag-key">Target Element ID</div>
                  <div className="diag-val" style={{ color: '#38BDF8', fontWeight: 700 }}>
                    {manipResult.target_element_id || 'N/A'}
                  </div>
                </div>

                {manipResult.target_text && (
                  <div className="diag-item">
                    <div className="diag-key">Target Text</div>
                    <div className="diag-val" style={{ color: 'var(--text-secondary)' }}>
                      "{manipResult.target_text.slice(0, 50)}"
                    </div>
                  </div>
                )}

                <div className="diag-item">
                  <div className="diag-key">Operation / Prop</div>
                  <div className="diag-val">
                    <code>{manipResult.operation}</code> → <code>{manipResult.property} = {String(manipResult.value)}</code>
                  </div>
                </div>

                <div className="diag-item">
                  <div className="diag-key">Safety Gate Decision</div>
                  <div className="diag-val">
                    <span className={`decision-badge ${manipResult.decision.toLowerCase()}`}>
                      {manipResult.decision}
                    </span>
                    {' '}(Confidence: {(manipResult.confidence * 100).toFixed(1)}%)
                  </div>
                </div>

                <div className="diag-item">
                  <div className="diag-key">Latency & Engine</div>
                  <div className="diag-val">
                    {manipResult.latency_ms} ms | {manipResult.engine}
                  </div>
                </div>
              </div>

              {/* State Diff & DOCX Export */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.65rem', color: '#10B981', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Atomic AST Style Mutation Diff</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Slide 10: Stage 6 State Transition</span>
                  </div>

                  {manipResult.state_diff?.before && manipResult.state_diff?.after ? (
                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                            <th style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>Property</th>
                            <th style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>Before</th>
                            <th style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>After</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(manipResult.state_diff.after).map((prop) => {
                            const bVal = manipResult.state_diff.before?.[prop];
                            const aVal = manipResult.state_diff.after?.[prop];
                            const changed = String(bVal) !== String(aVal);
                            return (
                              <tr
                                key={prop}
                                style={{
                                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                                  background: changed ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                                }}
                              >
                                <td style={{ padding: '4px 10px', fontWeight: changed ? 700 : 400, color: changed ? '#38BDF8' : 'var(--text-secondary)' }}>
                                  {prop}
                                </td>
                                <td style={{ padding: '4px 10px', color: 'var(--text-muted)' }}>
                                  {String(bVal)}
                                </td>
                                <td style={{ padding: '4px 10px', fontWeight: changed ? 700 : 400, color: changed ? '#10B981' : 'var(--text-primary)' }}>
                                  {String(aVal)}
                                  {changed && ' ✦'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <pre style={{ maxHeight: '160px', overflowY: 'auto' }}>
                      {JSON.stringify(manipResult.state_diff, null, 2)}
                    </pre>
                  )}
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <a
                    href={getExportUrl(docSummary.document_id)}
                    download
                    className="action-btn action-btn-primary"
                    style={{ textDecoration: 'none' }}
                  >
                    <Download size={18} />
                    Download Modified Word Document (.docx)
                  </a>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
