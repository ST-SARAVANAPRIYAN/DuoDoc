import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Search,
  FileText,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import ScrollableDocumentViewer from '../components/ScrollableDocumentViewer';
import AgenticChatSidecar from '../components/AgenticChatSidecar';
import { uploadDocument, fetchBenchmarkSamples, fetchDocument, runQA, streamQA } from '../api/client';

export default function UnderstandingView({ activeEngine }) {
  const [docSummary, setDocSummary] = useState(null);
  const [benchmarkSamples, setBenchmarkSamples] = useState([]);
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

  // Load benchmark samples on mount & auto-load featured paper
  useEffect(() => {
    fetchBenchmarkSamples()
      .then(async (samples) => {
        setBenchmarkSamples(samples);
        if (samples.length > 0 && !docSummary) {
          const featured = samples.find((s) => s.id === 'doc_70c0156668') || samples[0];
          handleSelectBenchmark(featured.id, samples);
        }
      })
      .catch((err) => console.warn('Could not load benchmark samples:', err));
  }, []);

  // Select a benchmark or pre-loaded document
  const handleSelectBenchmark = async (sampleId, samplesList = benchmarkSamples) => {
    const sample = samplesList.find((s) => s.id === sampleId);
    if (!sample) return;

    setError(null);
    setIsLoading(true);

    try {
      if (sample.document_id === 'doc_70c0156668') {
        const doc = await fetchDocument('doc_70c0156668');
        setDocSummary(doc);
      } else {
        setDocSummary({
          document_id: sample.document_id,
          filename: sample.label,
          page_count: 1,
          pages: [
            {
              page_id: 0,
              width: 800,
              height: 1000,
              image_url: sample.image_url,
              elements: sample.elements,
            },
          ],
        });
      }

      // Reset state for new document
      setSelectedPassage(null);
      setActiveCitation(null);
      setScopeMode('whole_doc');

      // Initialize welcome message for this document
      setMessages([
        {
          id: 'welcome-1',
          role: 'assistant',
          text: `Loaded "${sample.label}". You can ask any question across the document, or click any paragraph / highlight text on the canvas to focus your query.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.error('Failed to load document:', err);
      setError(`Failed to load document: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

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
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    status: 'thinking',
                    thought: {
                      ...m.thought,
                      reasoning: (m.thought?.reasoning || '') + delta,
                      isThinking: true,
                    },
                  }
                : m
            )
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
    <div className="agentic-understanding-container">
      {/* Hidden file input for DOCX upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.doc"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Top Context & Status Bar */}
      <div className="understanding-top-bar">
        <div className="top-bar-left">
          <h2 className="workspace-heading">Document Understanding</h2>
          <div className="workspace-subheading">
            Dual-representation VLM analysis &bull; Select any paragraph or passage on the document to ground queries
          </div>
        </div>

        <div className="top-bar-right">
          <button
            type="button"
            className="action-btn-clean"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} />
            <span>Upload Document</span>
          </button>
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
            benchmarkSamples={benchmarkSamples}
            onSelectBenchmark={handleSelectBenchmark}
          />
        </div>
      </div>
    </div>
  );
}
