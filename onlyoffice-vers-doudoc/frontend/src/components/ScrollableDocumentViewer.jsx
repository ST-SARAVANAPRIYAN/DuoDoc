import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import {
  FileText,
  ZoomIn,
  ZoomOut,
  X,
  MapPin,
  MessageSquare,
  Sparkles,
  Check
} from 'lucide-react';

const ScrollableDocumentViewer = forwardRef(function ScrollableDocumentViewer(
  {
    docSummary,
    selectedPassage,
    onSelectPassage,
    onClearPassage,
    activeCitation,
    onAskAboutPassage,
  },
  ref
) {
  const [zoom, setZoom] = useState(1.0);
  const [activeHighlightPage, setActiveHighlightPage] = useState(null);
  const containerRef = useRef(null);
  const pageRefs = useRef({});

  // Imperative handle for smooth scrolling to a specific page & citation bbox
  useImperativeHandle(ref, () => ({
    scrollToPageAndBbox: (pageIdx, bbox) => {
      const pageEl = pageRefs.current[pageIdx];
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setActiveHighlightPage(pageIdx);
        setTimeout(() => setActiveHighlightPage(null), 3000);
      }
    },
    scrollToPage: (pageIdx) => {
      const pageEl = pageRefs.current[pageIdx];
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }));

  const handleZoomIn = () => setZoom((z) => Math.min(+(z + 0.15).toFixed(2), 2.2));
  const handleZoomOut = () => setZoom((z) => Math.max(+(z - 0.15).toFixed(2), 0.6));
  const handleZoomReset = () => setZoom(1.0);

  // Handle clicking a structured block (paragraph, image, heading, table)
  const handleBlockClick = (e, pageIdx, el) => {
    e.stopPropagation();
    if (!el) return;

    // Check if user highlighted a specific sub-string with the mouse
    const selection = window.getSelection();
    const highlightedText = selection && !selection.isCollapsed ? selection.toString().trim() : '';

    if (!highlightedText && selectedPassage?.elementId === el.id && !selectedPassage?.selectedText) {
      onClearPassage();
      return;
    }

    const passageText = (el.text && el.text.trim())
      ? el.text.trim()
      : (el.type === 'image' ? `[Embedded Figure / Diagram on Page ${pageIdx + 1}]` : `[${el.type}]`);

    onSelectPassage({
      pageIdx,
      elementId: el.id,
      text: passageText,
      selectedText: highlightedText && highlightedText.length > 0 ? highlightedText : null,
      bbox: el.bbox,
      type: el.type,
      style: el.style || {},
    });
  };

  const handleBlockMouseUp = (e, pageIdx, el) => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      const highlightedText = selection.toString().trim();
      if (highlightedText.length > 0) {
        e.stopPropagation();
        const passageText = el.text ? el.text.trim() : `[${el.type}]`;
        onSelectPassage({
          pageIdx,
          elementId: el.id,
          text: passageText,
          selectedText: highlightedText,
          bbox: el.bbox,
          type: el.type,
          style: el.style || {},
        });
      }
    }
  };

  const pages = docSummary?.pages || [];
  const totalPages = pages.length;

  return (
    <div className="scrollable-doc-viewer neo-window" ref={containerRef}>
      <div className="neo-window-header">
        <div className="neo-window-dots">
          <span className="dot-red" />
          <span className="dot-yellow" />
          <span className="dot-green" />
        </div>
        <span className="neo-window-title font-mono">document.canvas</span>
      </div>

      {/* Top Toolbar */}
      <div className="viewer-toolbar">
        <div className="toolbar-left">
          <FileText size={15} className="toolbar-doc-icon" />
          <span className="doc-filename" title={docSummary?.filename || ''}>
            {docSummary?.filename || 'Document Viewer'}
          </span>
          {totalPages > 0 && (
            <span className="doc-page-counter">
              {totalPages} {totalPages === 1 ? 'page' : 'pages'}
            </span>
          )}
        </div>

        <div className="toolbar-right">
          {/* Zoom Controls */}
          <div className="zoom-controls">
            <button
              type="button"
              className="zoom-btn"
              onClick={handleZoomOut}
              disabled={zoom <= 0.6}
              title="Zoom out"
            >
              <ZoomOut size={13} />
            </button>
            <span
              className="zoom-value"
              onClick={handleZoomReset}
              title="Reset to 100%"
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className="zoom-btn"
              onClick={handleZoomIn}
              disabled={zoom >= 2.2}
              title="Zoom in"
            >
              <ZoomIn size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Selection Banner when text is selected */}
      {selectedPassage && (
        <div className="passage-floating-action-bar">
          <div className="passage-floating-left">
            <span className="passage-page-badge">Page {selectedPassage.pageIdx + 1}</span>
            <span className="passage-quote-preview" title={selectedPassage.text}>
              &ldquo;{selectedPassage.text.length > 70
                ? `${selectedPassage.text.slice(0, 70)}...`
                : selectedPassage.text}&rdquo;
            </span>
          </div>

          <div className="passage-floating-actions">
            {onAskAboutPassage && (
              <button
                type="button"
                className="passage-action-ask-btn"
                onClick={onAskAboutPassage}
              >
                <MessageSquare size={13} />
                <span>Ask in Chat</span>
              </button>
            )}
            <button
              type="button"
              className="passage-action-clear-btn"
              onClick={onClearPassage}
              title="Clear selection"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Quick Page Jump Bar */}
      {totalPages > 1 && (
        <div className="page-quick-bar">
          <span className="quick-bar-label">Jump to:</span>
          {pages.map((p, idx) => (
            <button
              key={p.page_id ?? idx}
              type="button"
              className={`quick-page-chip ${
                selectedPassage?.pageIdx === idx ? 'chip-active-passage' : ''
              } ${activeCitation?.pageIdx === idx ? 'chip-active-citation' : ''}`}
              onClick={() => {
                const el = pageRefs.current[idx];
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      )}

      {/* Pages Container */}
      <div className="viewer-viewport">
        {totalPages > 0 ? (
          <div
            className="pages-stack"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
            }}
          >
            {pages.map((page, pIdx) => {
              const docW = page.width || 800;
              const docH = page.height || 1000;
              const isCitationOnThisPage = activeCitation && activeCitation.pageIdx === pIdx;
              const isCitationActive = activeHighlightPage === pIdx;
              const isPassageOnThisPage = selectedPassage && selectedPassage.pageIdx === pIdx;

              return (
                <div
                  key={page.page_id ?? pIdx}
                  className={`page-card ${isCitationActive ? 'page-card-spotlight' : ''}`}
                  ref={(el) => (pageRefs.current[pIdx] = el)}
                >
                  {/* Page Header Indicator */}
                  <div className="page-header-strip">
                    <span className="page-header-number">Page {pIdx + 1}</span>
                    <span className="page-header-dim">{Math.round(docW)} &times; {Math.round(docH)} pt</span>
                  </div>

                  {/* Canvas + Text Layer Wrapper */}
                  <div
                    className="page-canvas-wrapper"
                    onClick={() => {
                      // Clicking background deselects active block
                      if (selectedPassage) onClearPassage();
                    }}
                  >
                    {/* Rendered Visual Bitmap */}
                    <img
                      src={page.image_url}
                      alt={`Page ${pIdx + 1}`}
                      className="page-image"
                      draggable={false}
                    />

                    {/* Interactive Text Overlay Layer */}
                    <div className="page-text-overlay-layer">
                      {page.elements?.map((el) => {
                        const isThisBlockSelected =
                          isPassageOnThisPage && selectedPassage?.elementId === el.id;

                        const leftPct = (el.bbox[0] / docW) * 100;
                        const topPct = (el.bbox[1] / docH) * 100;
                        const widthPct = ((el.bbox[2] - el.bbox[0]) / docW) * 100;
                        const heightPct = ((el.bbox[3] - el.bbox[1]) / docH) * 100;

                        return (
                          <div
                            key={el.id}
                            className={`doc-text-block ${
                              isThisBlockSelected ? 'doc-block-selected' : ''
                            } ${el.type === 'image' ? 'doc-image-block' : ''}`}
                            style={{
                              left: `${leftPct}%`,
                              top: `${topPct}%`,
                              width: `${widthPct}%`,
                              height: `${heightPct}%`,
                            }}
                            onClick={(e) => handleBlockClick(e, pIdx, el)}
                            onMouseUp={(e) => handleBlockMouseUp(e, pIdx, el)}
                            title={el.text ? `${el.type} (${el.id}): "${el.text.slice(0, 50)}..."` : `${el.type} (${el.id})`}
                          >
                            <span className="selectable-text-content">{el.text}</span>
                            {isThisBlockSelected && (
                              <div className="doc-block-selection-pill">
                                <span>
                                  {selectedPassage?.selectedText ? `“${selectedPassage.selectedText}”` : el.id}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Active Passage Highlight Overlay (if selection is from non-block) */}
                    {isPassageOnThisPage && selectedPassage.bbox && selectedPassage.bbox.length === 4 && !page.elements?.some(e => e.id === selectedPassage.elementId) && (
                      <div
                        className="passage-focus-overlay"
                        style={{
                          left: `${(selectedPassage.bbox[0] / docW) * 100}%`,
                          top: `${(selectedPassage.bbox[1] / docH) * 100}%`,
                          width: `${((selectedPassage.bbox[2] - selectedPassage.bbox[0]) / docW) * 100}%`,
                          height: `${Math.max(
                            ((selectedPassage.bbox[3] - selectedPassage.bbox[1]) / docH) * 100,
                            2
                          )}%`,
                        }}
                      >
                        <div className="passage-focus-tag">
                          <span>Focus Passage</span>
                        </div>
                      </div>
                    )}

                    {/* Citation Grounding Box */}
                    {isCitationOnThisPage && activeCitation.bbox && activeCitation.bbox.length === 4 && (() => {
                      const isNearTop = (activeCitation.bbox[1] / docH) < 0.04;
                      return (
                        <div
                          className="citation-grounding-overlay"
                          style={{
                            left: `${(activeCitation.bbox[0] / docW) * 100}%`,
                            top: `${(activeCitation.bbox[1] / docH) * 100}%`,
                            width: `${((activeCitation.bbox[2] - activeCitation.bbox[0]) / docW) * 100}%`,
                            height: `${Math.max(
                              ((activeCitation.bbox[3] - activeCitation.bbox[1]) / docH) * 100,
                              2.5
                            )}%`,
                          }}
                        >
                          <div
                            className="citation-grounding-tag"
                            style={isNearTop ? { top: 'auto', bottom: '-22px' } : undefined}
                          >
                            <MapPin size={10} />
                            <span>{activeCitation.label || `Page ${pIdx + 1}`}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-viewport-placeholder">
            <FileText size={42} className="empty-icon" />
            <div className="empty-title">No document loaded</div>
            <div className="empty-subtitle">
              Upload a Word (.docx) document or select a sample to begin
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default ScrollableDocumentViewer;
