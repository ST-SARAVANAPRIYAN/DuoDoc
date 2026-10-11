import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  ChevronDown,
  ChevronUp,
  MapPin,
  Copy,
  Check,
  Trash2,
  FileText,
  Upload,
  BookOpen,
  Highlighter,
  X,
  Sparkles,
  Quote,
  Layers,
  Eye,
  Code2,
  Cpu,
  ExternalLink,
  Square
} from 'lucide-react';

function formatInline(str) {
  if (!str) return '';
  const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} className="bold-token">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={idx} className="inline-code-token">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function renderFormattedAnswer(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) {
      elements.push(<div key={`sp-${i}`} style={{ height: '0.4rem' }} />);
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={i} className="answer-heading-h3">
          {formatInline(line.slice(4))}
        </h4>
      );
      continue;
    }

    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="answer-heading-h2">
          {formatInline(line.slice(3))}
        </h3>
      );
      continue;
    }

    if (/^\s*[-*•]\s+/.test(line)) {
      const bulletContent = line.replace(/^\s*[-*•]\s+/, '');
      elements.push(
        <div key={i} className="answer-bullet-item">
          <span className="bullet-dot">•</span>
          <span>{formatInline(bulletContent)}</span>
        </div>
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const match = line.match(/^\s*(\d+)\.\s+(.*)/);
      if (match) {
        elements.push(
          <div key={i} className="answer-numbered-item">
            <span className="number-index">{match[1]}.</span>
            <span>{formatInline(match[2])}</span>
          </div>
        );
        continue;
      }
    }

    elements.push(
      <p key={i} className="answer-paragraph">
        {formatInline(line)}
      </p>
    );
  }

  return elements;
}

export default function AgenticChatSidecar({
  messages,
  onSendMessage,
  onStopGeneration,
  isLoading,
  scopeMode,
  setScopeMode,
  selectedPassage,
  onClearPassage,
  activeEngine,
  docSummary,
  onCitationClick,
  onClearMessages,
  onUploadClick,
  benchmarkSamples,
  onSelectBenchmark,
  composerRef,
}) {
  const [inputText, setInputText] = useState('');
  const [expandedThoughts, setExpandedThoughts] = useState({});
  const [expandedTraces, setExpandedTraces] = useState({});
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [showDocSelector, setShowDocSelector] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const isUserScrolledUp = useRef(false);

  // User-aware auto-scroll: only scrolls to bottom if user has NOT manually scrolled up
  useEffect(() => {
    if (!isUserScrolledUp.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleContainerScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isUp = distanceToBottom > 75;
    isUserScrolledUp.current = isUp;
    setShowScrollBottom(isUp);
  };

  const scrollToBottom = () => {
    isUserScrolledUp.current = false;
    setShowScrollBottom(false);
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Expose focus to parent if needed
  useEffect(() => {
    if (composerRef) {
      composerRef.current = {
        focus: () => textareaRef.current?.focus(),
      };
    }
  }, [composerRef]);

  const toggleThought = (msgId) => {
    setExpandedThoughts((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const toggleTrace = (msgId) => {
    setExpandedTraces((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleCopyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 1800);
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isLoading) return;
    isUserScrolledUp.current = false;
    setShowScrollBottom(false);
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const quickPrompts = [
    'What is the proposed system architecture and methodology?',
    'Who are the authors of this paper?',
    'Summarize the core contributions',
    'What experimental results and metrics are reported?',
  ];

  return (
    <div className="agentic-sidecar">
      {/* Header Bar */}
      <div className="sidecar-header">
        <div className="agent-identity">
          <div className="agent-avatar-clean">
            <Sparkles size={14} className="agent-spark-icon" />
          </div>
          <div>
            <div className="agent-name">Autonomous Document Agent</div>
            <div className="agent-status-tag">
              <span className="clean-status-dot" />
              <span>
                Ready &bull;{' '}
                {activeEngine === 'qwopus-9b'
                  ? 'Cognitive ReAct Agent (Qwopus 3.5 9B)'
                  : activeEngine === 'dual-layer-vlm'
                  ? 'Dual-Layer VLM Agent'
                  : 'Compact Baseline'}
              </span>
            </div>
          </div>
        </div>

        <div className="sidecar-actions">
          <button
            type="button"
            className="action-icon-btn"
            onClick={() => setShowDocSelector(!showDocSelector)}
            title="Switch Document"
          >
            <FileText size={14} />
          </button>

          <button
            type="button"
            className="action-icon-btn"
            onClick={onClearMessages}
            title="Clear Chat History"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Document Selector Drawer */}
      {showDocSelector && (
        <div className="doc-selector-drawer">
          <div className="drawer-header">
            <span className="drawer-title">Switch Document</span>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={() => setShowDocSelector(false)}
            >
              &times;
            </button>
          </div>

          <div style={{ marginBottom: '0.65rem' }}>
            <button
              type="button"
              className="drawer-action-btn"
              onClick={() => {
                setShowDocSelector(false);
                onUploadClick();
              }}
            >
              <Upload size={13} /> Upload Word Document (.docx)
            </button>
          </div>

          {benchmarkSamples && benchmarkSamples.length > 0 && (
            <div className="benchmark-list">
              <div className="drawer-section-label">Benchmark Documents</div>
              {benchmarkSamples.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`benchmark-item-btn ${
                    docSummary?.document_id === s.document_id ? 'benchmark-active' : ''
                  }`}
                  onClick={() => {
                    onSelectBenchmark(s.id);
                    setShowDocSelector(false);
                  }}
                >
                  <div className="benchmark-item-title">{s.label}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scope Selector Pills */}
      <div className="scope-selector-container">
        <div className="scope-segmented-bar">
          <button
            type="button"
            className={`scope-segment-btn ${scopeMode === 'whole_doc' ? 'segment-active' : ''}`}
            onClick={() => {
              setScopeMode('whole_doc');
            }}
          >
            <BookOpen size={12} />
            <span>Whole Document</span>
          </button>

          <button
            type="button"
            className={`scope-segment-btn ${scopeMode === 'selected_region' ? 'segment-active' : ''}`}
            onClick={() => {
              setScopeMode('selected_region');
            }}
          >
            <Highlighter size={12} />
            <span>Selected Passage</span>
            {selectedPassage && <span className="segment-indicator-dot" />}
          </button>
        </div>
      </div>

      {/* Messages Stream */}
      <div
        className="chat-messages-container"
        ref={messagesContainerRef}
        onScroll={handleContainerScroll}
      >
        {messages.length === 0 ? (
          <div className="empty-chat-welcome">
            <div className="welcome-icon-box">
              <FileText size={22} />
            </div>
            <div className="welcome-title">Research &amp; Explore</div>
            <p className="welcome-description">
              Ask questions across the full document, or click any paragraph / highlight text on the document to focus the analysis.
            </p>

            <div className="welcome-prompts-section">
              <div className="prompts-grid">
                {quickPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    className="welcome-prompt-chip"
                    onClick={() => {
                      setInputText(prompt);
                      textareaRef.current?.focus();
                    }}
                  >
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`message-row ${
                msg.role === 'user' ? 'message-row-user' : 'message-row-assistant'
              }`}
            >
              <div className="message-content-wrapper">
                {/* User Message Bubble */}
                {msg.role === 'user' && (
                  <div className="user-message-bubble">
                    {msg.quotedPassage && (
                      <div className="user-quoted-passage">
                        <Quote size={11} className="quote-icon" />
                        <span className="quote-text">{msg.quotedPassage}</span>
                      </div>
                    )}
                    <div className="user-message-text">{msg.text}</div>
                    <div className="message-time-subtle">{msg.timestamp || ''}</div>
                  </div>
                )}

                {/* Assistant Message Bubble */}
                {msg.role === 'assistant' && (
                  <div className="assistant-message-bubble">
                    {/* Progressive Live Thinking Box */}
                    {(msg.status === 'thinking' || msg.thought?.isThinking || msg.thought?.reasoning) && (
                      <div
                        className={`modern-thought-box ${
                          msg.thought?.isThinking ? 'thinking-active' : 'thinking-completed'
                        }`}
                      >
                        <button
                          type="button"
                          className="thought-box-header"
                          onClick={() => toggleThought(msg.id)}
                        >
                          <div className="thought-header-left">
                            {msg.thought?.isThinking ? (
                              <>
                                <Sparkles size={13} className="thought-sparkle-pulse" />
                                <span className="thought-status-text">Thinking...</span>
                                <span className="thought-timer-pill">
                                  {msg.thought?.thoughtTime
                                    ? `${msg.thought.thoughtTime.toFixed(1)}s`
                                    : '0.0s'}
                                </span>
                              </>
                            ) : (
                              <>
                                <Check size={13} className="thought-check-icon" />
                                <span className="thought-status-text">
                                  Thought for{' '}
                                  {msg.thought?.thoughtTime
                                    ? `${msg.thought.thoughtTime.toFixed(1)}s`
                                    : msg.latency
                                    ? `${(msg.latency / 1000).toFixed(1)}s`
                                    : '1.8s'}
                                </span>
                              </>
                            )}
                          </div>

                          <ChevronDown
                            size={12}
                            className={`accordion-chevron ${
                              (expandedThoughts[msg.id] ?? (msg.thought?.isThinking || !msg.text))
                                ? 'chevron-rotated'
                                : ''
                            }`}
                          />
                        </button>

                        {(expandedThoughts[msg.id] ?? (msg.thought?.isThinking || !msg.text)) && (
                          <div className="thought-box-body">
                            {msg.thought?.reasoning ? (
                              <div className="thought-reasoning-stream">
                                {msg.thought.reasoning.split('\n').map((line, idx) => {
                                  if (line.includes('Agent Action:')) {
                                    return (
                                      <div key={idx} className="thought-agent-action-chip">
                                        <span>🛠️</span>
                                        <span>{line.replace(/^>\s*/, '').replace(/\*\*/g, '')}</span>
                                      </div>
                                    );
                                  }
                                  if (line.includes('Observation:')) {
                                    return (
                                      <div key={idx} className="thought-agent-obs-chip">
                                        <span>📋</span>
                                        <span>{line.replace(/^>\s*/, '').replace(/\*\*/g, '')}</span>
                                      </div>
                                    );
                                  }
                                  return line.trim() ? <div key={idx} className="thought-text-line">{line}</div> : null;
                                })}
                                {msg.thought?.isThinking && (
                                  <span className="thought-blinking-cursor">|</span>
                                )}
                              </div>
                            ) : (
                              <div className="thought-loading-steps">
                                <div className="thought-step-item active">
                                  <span className="step-pulsing-dot" />
                                  <span>Autonomous Document Agent planning navigation...</span>
                                </div>
                                <div className="thought-step-item">
                                  <span className="step-pending-dot" />
                                  <span>Executing cognitive tool calls &amp; multimodal inspection...</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Answer Text */}
                    {msg.text && (
                      <div className="assistant-answer-text">
                        {renderFormattedAnswer(msg.text)}
                        {msg.status === 'answering' && (
                          <span className="streaming-cursor">|</span>
                        )}
                      </div>
                    )}

                    {/* Interpretability & Dual Representation Trace Inspector */}
                    {msg.interpretability && (
                      <div className="interpretability-accordion">
                        <button
                          type="button"
                          className={`interpretability-trigger ${
                            expandedTraces[msg.id] ? 'trigger-expanded' : ''
                          }`}
                          onClick={() => toggleTrace(msg.id)}
                        >
                          <div className="trigger-left">
                            <Layers size={13} className="trigger-icon" />
                            <span className="trigger-title">Autonomous Agent Evidence &amp; Grounding Trace</span>
                          </div>
                          <div className="trigger-right">
                            {msg.interpretability.stage_3_multimodal_fusion?.joint_confidence && (
                              <span className="joint-conf-chip">
                                {msg.interpretability.stage_3_multimodal_fusion.joint_confidence}% Fused
                              </span>
                            )}
                            <ChevronDown
                              size={12}
                              className={`accordion-chevron ${
                                expandedTraces[msg.id] ? 'chevron-rotated' : ''
                              }`}
                            />
                          </div>
                        </button>

                        {expandedTraces[msg.id] && (
                          <div className="interpretability-content">
                            {/* Side-by-Side: Visual (2B) vs. Structural (2A) */}
                            <div className="dual-rep-columns">
                              {/* Visual Representation Card (Stage 2B) */}
                              <div className="rep-column visual-rep-card">
                                <div className="rep-card-header">
                                  <div className="header-badge-group">
                                    <Eye size={12} className="rep-card-icon" />
                                    <span className="card-label">Visual Grounding Patch</span>
                                  </div>
                                  <span className="rep-page-badge">
                                    Page {msg.interpretability.stage_2_dual_representation?.visual?.page_number || 1}
                                  </span>
                                </div>

                                {msg.interpretability.stage_2_dual_representation?.visual?.crop_url && (
                                  <div className="visual-crop-wrapper">
                                    <img
                                      src={msg.interpretability.stage_2_dual_representation.visual.crop_url}
                                      alt="Grounded Visual Patch"
                                      className="visual-crop-img"
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  </div>
                                )}

                                <div className="rep-details-list">
                                  <div className="rep-detail-item">
                                    <span className="detail-key">Coordinates:</span>
                                    <span className="detail-val mono">
                                      [{msg.interpretability.stage_2_dual_representation?.visual?.bbox?.map(c => Math.round(c)).join(', ')}] pt
                                    </span>
                                  </div>
                                  <div className="rep-detail-item">
                                    <span className="detail-key">Patch Size:</span>
                                    <span className="detail-val mono">
                                      {msg.interpretability.stage_2_dual_representation?.visual?.dimensions_pt?.[0]} &times; {msg.interpretability.stage_2_dual_representation?.visual?.dimensions_pt?.[1]} pt
                                    </span>
                                  </div>
                                </div>

                                {msg.citation && (
                                  <button
                                    type="button"
                                    className="view-canvas-btn"
                                    onClick={() => onCitationClick(msg.citation)}
                                  >
                                    <span>Locate on Document Canvas</span>
                                    <ExternalLink size={10} />
                                  </button>
                                )}
                              </div>

                              {/* Structural AST Representation Card (Stage 2A) */}
                              <div className="rep-column structural-rep-card">
                                <div className="rep-card-header">
                                  <div className="header-badge-group">
                                    <Code2 size={12} className="rep-card-icon" />
                                    <span className="card-label">Structural Evidence Node</span>
                                  </div>
                                  <span className="rep-node-badge">
                                    #{msg.interpretability.stage_2_dual_representation?.structural?.element_id}
                                  </span>
                                </div>

                                <div className="rep-details-list">
                                  <div className="rep-detail-item">
                                    <span className="detail-key">Semantic Type:</span>
                                    <span className="detail-val tag">
                                      {msg.interpretability.stage_2_dual_representation?.structural?.type}
                                    </span>
                                  </div>
                                  <div className="rep-detail-item">
                                    <span className="detail-key">Typography:</span>
                                    <span className="detail-val">
                                      {msg.interpretability.stage_2_dual_representation?.structural?.font_family} ({msg.interpretability.stage_2_dual_representation?.structural?.font_size}pt, {msg.interpretability.stage_2_dual_representation?.structural?.bold ? 'Bold' : 'Regular'})
                                    </span>
                                  </div>
                                  <div className="rep-detail-item">
                                    <span className="detail-key">Alignment:</span>
                                    <span className="detail-val">
                                      {msg.interpretability.stage_2_dual_representation?.structural?.alignment}
                                    </span>
                                  </div>
                                </div>

                                <div className="structural-snippet-box">
                                  <div className="snippet-label">AST Node Content:</div>
                                  <p className="snippet-text">
                                    &ldquo;{msg.interpretability.stage_2_dual_representation?.structural?.text_preview}&rdquo;
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Stage 3: Multimodal Fusion Breakdown */}
                            <div className="fusion-breakdown-card">
                              <div className="rep-card-header">
                                <div className="header-badge-group">
                                  <Cpu size={12} className="rep-card-icon" />
                                  <span className="card-label">Multimodal Fusion &amp; Agent Confidence</span>
                                </div>
                              </div>

                              <div className="fusion-meters-grid">
                                <div className="meter-item">
                                  <div className="meter-header">
                                    <span className="meter-name">Structural Semantic Relevance</span>
                                    <span className="meter-num">
                                      {msg.interpretability.stage_3_multimodal_fusion?.structural_score}%
                                    </span>
                                  </div>
                                  <div className="meter-track">
                                    <div
                                      className="meter-fill meter-fill-struct"
                                      style={{
                                        width: `${msg.interpretability.stage_3_multimodal_fusion?.structural_score}%`,
                                      }}
                                    />
                                  </div>
                                </div>

                                <div className="meter-item">
                                  <div className="meter-header">
                                    <span className="meter-name">Visual Layout &amp; Hierarchy Score</span>
                                    <span className="meter-num">
                                      {msg.interpretability.stage_3_multimodal_fusion?.visual_layout_score}%
                                    </span>
                                  </div>
                                  <div className="meter-track">
                                    <div
                                      className="meter-fill meter-fill-visual"
                                      style={{
                                        width: `${msg.interpretability.stage_3_multimodal_fusion?.visual_layout_score}%`,
                                      }}
                                    />
                                  </div>
                                </div>

                                <div className="meter-item">
                                  <div className="meter-header">
                                    <span className="meter-name">Joint Multimodal Confidence</span>
                                    <span className="meter-num accent">
                                      {msg.interpretability.stage_3_multimodal_fusion?.joint_confidence}%
                                    </span>
                                  </div>
                                  <div className="meter-track">
                                    <div
                                      className="meter-fill meter-fill-joint"
                                      style={{
                                        width: `${msg.interpretability.stage_3_multimodal_fusion?.joint_confidence}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {msg.interpretability.stage_3_multimodal_fusion?.fusion_rationale && (
                                <p className="fusion-rationale-text">
                                  {msg.interpretability.stage_3_multimodal_fusion.fusion_rationale}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bottom Metadata & Citation */}
                    <div className="assistant-message-footer">
                      {msg.citation ? (
                        <button
                          type="button"
                          className="clean-citation-pill"
                          onClick={() => onCitationClick(msg.citation)}
                          title="Jump to grounded evidence in document"
                        >
                          <MapPin size={11} />
                          <span>{msg.citation.label || `Page ${msg.citation.pageIdx + 1}`}</span>
                        </button>
                      ) : (
                        <div />
                      )}

                      <button
                        type="button"
                        className="copy-btn-subtle"
                        onClick={() => handleCopyText(msg.text, msg.id)}
                        title="Copy answer"
                      >
                        {copiedMsgId === msg.id ? (
                          <Check size={12} color="#10B981" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Fallback Loading Indicator (only if no message is actively streaming) */}
        {isLoading &&
          !messages.some(
            (m) =>
              m.thought?.isThinking ||
              m.status === 'thinking' ||
              m.status === 'answering'
          ) && (
            <div className="message-row message-row-assistant">
              <div className="assistant-message-bubble loading-bubble-modern">
                <div className="typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="loading-label">Connecting to intelligence engine...</span>
              </div>
            </div>
          )}

        <div ref={chatEndRef} />
      </div>

      {/* Floating Jump to Latest Button */}
      {showScrollBottom && (
        <button
          type="button"
          className="scroll-to-bottom-floating-btn"
          onClick={scrollToBottom}
          title="Jump to latest output"
        >
          <ChevronDown size={13} />
          <span>Latest Tokens</span>
        </button>
      )}

      {/* Selected Passage Attachment Pill above composer */}
      {selectedPassage && (
        <div className="composer-passage-attachment">
          <div className="attachment-left">
            <Highlighter size={12} className="attachment-icon" />
            <span className="attachment-page-tag">Page {selectedPassage.pageIdx + 1}</span>
            <span className="attachment-snippet" title={selectedPassage.text}>
              &ldquo;{selectedPassage.text.length > 55
                ? `${selectedPassage.text.slice(0, 55)}...`
                : selectedPassage.text}&rdquo;
            </span>
          </div>
          <button
            type="button"
            className="attachment-clear-btn"
            onClick={onClearPassage}
            title="Detach passage"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Input Composer */}
      <form className="chat-composer-form" onSubmit={handleSubmit}>
        <div className="composer-container">
          <textarea
            ref={textareaRef}
            className="composer-textarea"
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedPassage
                ? `Ask about selected passage on Page ${selectedPassage.pageIdx + 1}...`
                : scopeMode === 'selected_region'
                ? 'Click any text on the document to select a passage...'
                : 'Ask a question about this document...'
            }
            disabled={isLoading || !docSummary}
          />

          {isLoading ? (
            <button
              type="button"
              className="composer-stop-btn"
              onClick={onStopGeneration}
              title="Stop Generation"
            >
              <Square size={11} fill="currentColor" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              className="composer-send-btn"
              disabled={!inputText.trim() || !docSummary}
              title="Send Message"
            >
              <Send size={13} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
