import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Search,
  FileText,
  AlertCircle,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import ScrollableDocumentViewer from '../components/ScrollableDocumentViewer';
import AgenticChatSidecar from '../components/AgenticChatSidecar';
import ThemeToggle from '../components/ThemeToggle';
import { uploadDocument, fetchDocument, runQA, streamQA } from '../api/client';
import { getDocuments, getChatHistory, saveChatMessage } from '../api/libraryApi';

export default function UnderstandingView({ activeEngine, selectedDocument, onBackToLibrary }) {
  const [docSummary, setDocSummary] = useState(null);
  const [scopeMode, setScopeMode] = useState('whole_doc'); // 'whole_doc' | 'selected_region'
  const [selectedPassage, setSelectedPassage] = useState(null); // { pageIdx, elementId, text, bbox, type }
  const [activeCitation, setActiveCitation] = useState(null); // { pageIdx, bbox, label }

  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);
  const viewerRef = useRef(null);
  const composerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const activeTimerRef = useRef(null);

  // Load selected document when passed from Library
  useEffect(() => {
    if (selectedDocument) {
      setIsLoading(true);
      fetchDocument(selectedDocument.document_id)
        .then(async (doc) => {
          setDocSummary(doc);
          setSelectedPassage(null);
          setActiveCitation(null);
          setScopeMode('whole_doc');

          // Load chat history from MongoDB
          try {
            const histRes = await getChatHistory(selectedDocument.document_id);
            if (histRes.messages && histRes.messages.length > 0) {
              setMessages(histRes.messages);
            } else {
              setMessages([
                {
                  id: 'welcome-1',
                  role: 'assistant',
                  text: `### ${selectedDocument.title || selectedDocument.filename}\n\nDocument loaded into workspace. You can ask questions across the whole document, or drag to highlight specific paragraphs, tables, or architecture diagrams on the canvas.`,
                  scopeMode: 'whole_doc',
                  engine: activeEngine,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }
              ]);
            }
          } catch (e) {
            console.warn('Could not load chat history:', e);
          }
        })
        .catch((err) => setError(err.message))
        .finally(() => setIsLoading(false));
    }
  }, [selectedDocument]);

  // Auto-load most recent document from library if none explicitly selected
  useEffect(() => {
    if (!selectedDocument && !docSummary) {
      setIsLoading(true);
      getDocuments({ limit: 1 })
        .then(async (res) => {
          if (res.documents && res.documents.length > 0) {
            const first = res.documents[0];
            const doc = await fetchDocument(first.document_id);
            setDocSummary(doc);
            setSelectedPassage(null);
            setActiveCitation(null);
            setScopeMode('whole_doc');

            try {
              const histRes = await getChatHistory(first.document_id);
              if (histRes.messages && histRes.messages.length > 0) {
                setMessages(histRes.messages);
              } else {
                setMessages([
                  {
                    id: 'welcome-1',
                    role: 'assistant',
                    text: `### ${first.title || first.filename}\n\nDocument loaded from library. You can ask questions across the whole document, or drag to highlight specific paragraphs, tables, or architecture diagrams on the canvas.`,
                    scopeMode: 'whole_doc',
                    engine: activeEngine,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  }
                ]);
              }
            } catch (e) {
              console.warn('Could not load chat history:', e);
            }
          }
        })
        .catch((err) => console.warn('Could not auto-load first document:', err))
        .finally(() => setIsLoading(false));
    }
  }, [selectedDocument]);

  // Upload Word (.docx) handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const summary = await uploadDocument(file);
      setDocSummary(summary);
      setSelectedPassage(null);
      setActiveCitation(null);
      setScopeMode('whole_doc');

      setMessages([
        {
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          text: `Loaded "${summary.filename}" (${summary.page_count} pages). High-fidelity layout and text extracted. Ask any question to begin analysis.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // User sends a question in the chat
  const handleSendMessage = async (queryText) => {
    if (!docSummary) {
      setError('Please upload a document or select a sample first.');
      return;
    }

    const currentPassage = scopeMode === 'selected_region' && selectedPassage ? selectedPassage : null;
    const userMsgId = `user-${Date.now()}`;
    const userMsg = {
      id: userMsgId,
      role: 'user',
      text: queryText,
      quotedPassage: currentPassage ? currentPassage.text : null,
      scopeMode: currentPassage ? 'selected_region' : scopeMode,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (docSummary?.document_id) {
      saveChatMessage(docSummary.document_id, userMsg).catch((e) => console.warn('Failed saving user message:', e));
    }
    setIsLoading(true);
    setError(null);

    const assistantMsgId = `assistant-${Date.now()}`;
    const initialAssistantMsg = {
      id: assistantMsgId,
      role: 'assistant',
      text: '',
      thought: {
        reasoning: '',
        isThinking: true,
        thoughtTime: 0,
      },
      status: 'thinking',
      scopeMode: currentPassage ? 'selected_region' : 'whole_doc',
      engine: activeEngine,
      agentSteps: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, initialAssistantMsg]);

    const timerStart = Date.now();
    const timerInterval = setInterval(() => {
      const elapsed = (Date.now() - timerStart) / 1000;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId && m.thought?.isThinking
            ? { ...m, thought: { ...m.thought, thoughtTime: elapsed } }
            : m
        )
      );
    }, 100);
    activeTimerRef.current = timerInterval;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const targetPageIdx = currentPassage ? currentPassage.pageIdx : 0;
      const targetRegionBbox = currentPassage ? currentPassage.bbox : null;

      const formattedQuery = currentPassage
        ? `[Focus Passage]: "${currentPassage.text}"\nQuestion: ${queryText}`
        : queryText;

      let hasAnswerStarted = false;

      await streamQA({
        documentId: docSummary.document_id,
        pageIdx: targetPageIdx,
        query: formattedQuery,
        engine: activeEngine,
        scopeMode: currentPassage ? 'selected_region' : 'whole_doc',
        regionBbox: targetRegionBbox,
        abortSignal: abortController.signal,
        onThoughtDelta: (delta) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantMsgId) return m;
              const steps = [...(m.agentSteps || [])];

              if (delta.includes('Strategy:') || delta.includes('formulating navigation plan')) {
                const stratMatch = delta.match(/Strategy:\s*([^\n]+)/);
                const stratText = stratMatch ? stratMatch[1].trim() : 'Analyzing semantic query intent and document structure...';
                if (!steps.some((s) => s.type === 'plan')) {
                  steps.unshift({
                    id: `plan_${Date.now()}`,
                    type: 'plan',
                    title: 'Formulating Navigation Plan',
                    content: stratText,
                    status: 'completed',
                  });
                }
              }

              if (delta.includes('Verification Guard:')) {
                const guardText = delta.replace(/^[>\s\n*⚠️]+/, '').trim();
                steps.push({
                  id: `verify_${Date.now()}`,
                  type: 'verification',
                  title: 'Verification Guard & Re-routing',
                  content: guardText,
                  status: 'warning',
                });
              }

              if (delta.includes('Evidence localized on') || delta.includes('Synthesizing verified multimodal answer')) {
                if (!steps.some((s) => s.type === 'synthesis')) {
                  steps.push({
                    id: `synth_${Date.now()}`,
                    type: 'synthesis',
                    title: 'Multimodal Grounding & Evidence Fusion',
                    content: 'Visual raster and structural AST elements synchronized for multimodal synthesis.',
                    status: 'completed',
                  });
                }
              }

              return {
                ...m,
                status: 'thinking',
                agentSteps: steps,
                thought: {
                  ...m.thought,
                  reasoning: (m.thought?.reasoning || '') + delta,
                  isThinking: true,
                },
              };
            })
          );
        },
        onAgentStep: (stepEvt) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantMsgId) return m;
              const steps = [...(m.agentSteps || [])];

              if (stepEvt.type === 'tool_call') {
                steps.push({
                  id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                  type: 'tool',
                  tool: stepEvt.tool,
                  args: stepEvt.args || {},
                  status: 'running',
                  title: `Execute Cognitive Tool: ${stepEvt.tool}`,
                });
              } else if (stepEvt.type === 'tool_result') {
                const lastToolIdx = [...steps].reverse().findIndex((s) => s.type === 'tool' && s.status === 'running');
                if (lastToolIdx !== -1) {
                  const actualIdx = steps.length - 1 - lastToolIdx;
                  steps[actualIdx] = {
                    ...steps[actualIdx],
                    status: 'completed',
                    summary: stepEvt.summary,
                    output: stepEvt.output,
                  };
                } else {
                  steps.push({
                    id: `res_${Date.now()}`,
                    type: 'tool',
                    tool: stepEvt.tool,
                    status: 'completed',
                    summary: stepEvt.summary,
                    output: stepEvt.output,
                    title: `Executed: ${stepEvt.tool}`,
                  });
                }
              }

              return {
                ...m,
                agentSteps: steps,
              };
            })
          );
        },
        onAnswerDelta: (delta) => {
          if (!hasAnswerStarted) {
            hasAnswerStarted = true;
            clearInterval(timerInterval);
            activeTimerRef.current = null;
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    status: 'answering',
                    thought: {
                      ...m.thought,
                      isThinking: false,
                    },
                    text: (m.text || '') + delta,
                  }
                : m
            )
          );
        },
        onDone: (result) => {
          clearInterval(timerInterval);
          activeTimerRef.current = null;
          abortControllerRef.current = null;
          const citationObj = result.grounded_bbox
            ? {
                pageIdx: result.page_idx ?? targetPageIdx,
                bbox: result.grounded_bbox,
                label: result.citation_label || `Page ${(result.page_idx ?? targetPageIdx) + 1}`,
              }
            : null;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    status: 'completed',
                    text: result.answer || m.text,
                    evidenceText: result.evidence_text,
                    citation: citationObj,
                    thought: {
                      ...m.thought,
                      isThinking: false,
                      reasoning: result.reasoning || m.thought?.reasoning,
                    },
                    confidence: result.confidence,
                    latency: result.latency_ms,
                    engine: result.engine,
                    interpretability: result.interpretability,
                  }
                : m
            )
          );

          if (citationObj) {
            setActiveCitation(citationObj);
            viewerRef.current?.scrollToPageAndBbox(citationObj.pageIdx, citationObj.bbox);
          }

          if (docSummary?.document_id) {
            saveChatMessage(docSummary.document_id, {
              role: 'assistant',
              text: result.answer || '',
              thought: { reasoning: result.reasoning || '' },
              citation: citationObj,
              confidence: result.confidence,
              agentSteps: result.agentSteps || []
            }).catch((e) => console.warn('Failed saving assistant message:', e));
          }
        },
        onError: (err) => {
          clearInterval(timerInterval);
          activeTimerRef.current = null;
          abortControllerRef.current = null;
          if (err.name === 'AbortError' || abortController.signal.aborted) {
            return;
          }
          console.error('QA inference failed:', err);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    status: 'error',
                    text: `Inference Error: ${err.message || 'Failed to complete question answering request.'}`,
                    thought: { ...(m.thought || {}), isThinking: false },
                  }
                : m
            )
          );
        },
      });
    } catch (err) {
      clearInterval(timerInterval);
      activeTimerRef.current = null;
      abortControllerRef.current = null;
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        return;
      }
      console.error('QA stream dispatch error:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                status: 'error',
                text: `Inference Error: ${err.message || 'Failed to complete question answering request.'}`,
                thought: { ...(m.thought || {}), isThinking: false },
              }
            : m
        )
      );
    } finally {
      clearInterval(timerInterval);
      activeTimerRef.current = null;
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (activeTimerRef.current) {
      clearInterval(activeTimerRef.current);
      activeTimerRef.current = null;
    }
    setIsLoading(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.status === 'thinking' || m.status === 'answering'
          ? {
              ...m,
              status: 'completed',
              text: (m.text || '') + (m.text ? '\n\n' : '') + '*(Generation stopped by user)*',
              thought: { ...(m.thought || {}), isThinking: false },
            }
          : m
      )
    );
  };

  // Citation badge clicked in chat: smooth scroll to that page & bbox
  const handleCitationClick = (citation) => {
    if (!citation) return;
    setActiveCitation(citation);
    viewerRef.current?.scrollToPageAndBbox(citation.pageIdx, citation.bbox);
  };

  // Passage selection callbacks
  const handleSelectPassage = (passageData) => {
    setSelectedPassage(passageData);
    setScopeMode('selected_region');
  };

  const handleClearPassage = () => {
    setSelectedPassage(null);
    setScopeMode('whole_doc');
  };

  const handleAskAboutPassage = () => {
    composerRef.current?.focus();
  };

  return (
    <div className="agentic-understanding-container portfolio-root">
      {/* Hidden file input for DOCX upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.doc,.pdf"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Top Context & Status Bar */}
      <div className="understanding-top-bar neo-window">
        <div className="neo-window-header">
          <div className="neo-window-dots">
            <span className="dot-red" />
            <span className="dot-yellow" />
            <span className="dot-green" />
          </div>
          <span className="neo-window-title font-mono">workspace.qa // dual_vlm</span>
        </div>
        <div className="understanding-top-bar-body flex items-center justify-between p-3">
          <div className="top-bar-left flex items-center gap-3">
            {onBackToLibrary && (
              <button
                type="button"
                className="neo-btn-back"
                onClick={onBackToLibrary}
                title="Return to Document Library"
              >
                <ArrowLeft size={14} />
                <span>&larr; Library</span>
              </button>
            )}
            <div>
              <h2 className="workspace-heading font-mono text-base font-bold">
                {docSummary?.filename || selectedDocument?.title || 'Document Understanding'}
              </h2>
              <div className="workspace-subheading font-mono text-xs opacity-75">
                {selectedDocument
                  ? `Active Document (${selectedDocument.file_type?.toUpperCase()} \u2022 ${docSummary?.page_count || selectedDocument.page_count} pages) \u2022 Grounded dual-representation VLM analysis`
                  : 'Dual-representation VLM analysis \u2022 Select any paragraph or passage on canvas to ground queries'}
              </div>
            </div>
          </div>

          <div className="top-bar-right">
            <button
              type="button"
              className="neo-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} />
              <span>Upload Document</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="system-error-banner-clean">
          <AlertCircle size={15} />
          <span>{error}</span>
          <button type="button" className="error-close-btn" onClick={() => setError(null)}>
            &times;
          </button>
        </div>
      )}

      {/* Split Workspace Layout */}
      <div className="agentic-split-layout">
        {/* Left Pane: Scrollable Document Canvas with Interactive Text Layer */}
        <div className="viewer-pane">
          <ScrollableDocumentViewer
            ref={viewerRef}
            docSummary={docSummary}
            selectedPassage={selectedPassage}
            onSelectPassage={handleSelectPassage}
            onClearPassage={handleClearPassage}
            activeCitation={activeCitation}
            onAskAboutPassage={handleAskAboutPassage}
          />
        </div>

        {/* Right Pane: Agentic Chat Sidecar */}
        <div className="sidecar-pane">
          <AgenticChatSidecar
            composerRef={composerRef}
            messages={messages}
            onSendMessage={handleSendMessage}
            onStopGeneration={handleStopGeneration}
            isLoading={isLoading}
            scopeMode={scopeMode}
            setScopeMode={setScopeMode}
            selectedPassage={selectedPassage}
            onClearPassage={handleClearPassage}
            activeEngine={activeEngine}
            docSummary={docSummary}
            onCitationClick={handleCitationClick}
            onClearMessages={() => setMessages([])}
            onUploadClick={() => fileInputRef.current?.click()}
            onOpenLibrary={onBackToLibrary}
          />
        </div>
      </div>
    </div>
  );
}
