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

  const [dragBox, setDragBox] = useState(null);
  const lastDragTimeRef = useRef(0);

  // Handle clicking a structured block (paragraph, image, heading, table)
  const handleBlockClick = (e, pageIdx, el) => {
    e.stopPropagation();
    // If user just completed a drag marquee selection, do not trigger single block click
    if (Date.now() - lastDragTimeRef.current < 250) {
      return;
    }
    if (!el) return;

    if (selectedPassage?.elementId === el.id) {
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
      bbox: el.bbox,
      type: el.type
    });
  };

  // Canvas Mouse Down: Start marquee drag selection
  const handleCanvasMouseDown = (e, pageIdx) => {
    if (e.button !== 0) return; // Only primary button
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDragBox({
      pageIdx,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      rectWidth: rect.width,
      rectHeight: rect.height,
      isDragging: false,
    });
  };

  // Canvas Mouse Move: Update marquee selection boundary
  const handleCanvasMouseMove = (e, pageIdx) => {
    if (!dragBox || dragBox.pageIdx !== pageIdx) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    const dist = Math.hypot(x - dragBox.startX, y - dragBox.startY);
    if (dist > 6) {
      setDragBox((prev) => (prev ? { ...prev, currentX: x, currentY: y, isDragging: true } : null));
    }
  };

  // Canvas Mouse Up: Complete drag or process text selection
  const handleCanvasMouseUp = (e, pageIdx, page) => {
    if (!dragBox || dragBox.pageIdx !== pageIdx) return;

    if (dragBox.isDragging) {
      lastDragTimeRef.current = Date.now();
      const rect = e.currentTarget.getBoundingClientRect();
      const minX = Math.min(dragBox.startX, dragBox.currentX);
      const maxX = Math.max(dragBox.startX, dragBox.currentX);
      const minY = Math.min(dragBox.startY, dragBox.currentY);
      const maxY = Math.max(dragBox.startY, dragBox.currentY);

      const wrapperW = rect.width || 800;
      const wrapperH = rect.height || 1000;
      const docW = page.width || 800;
      const docH = page.height || 1000;

      const ptX1 = Math.max(0, Math.round((minX / wrapperW) * docW * 10) / 10);
      const ptY1 = Math.max(0, Math.round((minY / wrapperH) * docH * 10) / 10);
      const ptX2 = Math.min(docW, Math.round((maxX / wrapperW) * docW * 10) / 10);
      const ptY2 = Math.min(docH, Math.round((maxY / wrapperH) * docH * 10) / 10);

      // Find all elements that intersect the dragged box
      const intersecting = (page.elements || []).filter((el) => {
        if (!el.bbox || el.bbox.length !== 4) return false;
        const [bx1, by1, bx2, by2] = el.bbox;
        return !(ptX2 < bx1 || ptX1 > bx2 || ptY2 < by1 || ptY1 > by2);
      });

      // Sort in natural reading order: top-to-bottom, left-to-right
      intersecting.sort((a, b) => {
        if (Math.abs(a.bbox[1] - b.bbox[1]) < 12) {
          return a.bbox[0] - b.bbox[0];
        }
        return a.bbox[1] - b.bbox[1];
      });

      let extractedText = '';
      if (intersecting.length > 0) {
        const textParts = intersecting
          .map((el) => {
            if (el.text && el.text.trim()) return el.text.trim();
            if (el.type === 'image') return '[Embedded Figure / Architecture Diagram]';
            if (el.type === 'table') return '[Embedded Table]';
            return '';
          })
          .filter(Boolean);
        extractedText = textParts.join('\n\n');
      }

      if (!extractedText) {
        extractedText = `[Region Selection: Page ${pageIdx + 1}]`;
      }

      onSelectPassage({
        pageIdx,
        elementId: intersecting.length === 1 ? intersecting[0].id : `region-${Date.now()}`,
        text: extractedText,
        bbox: [ptX1, ptY1, ptX2, ptY2],
        type: intersecting.length === 1 ? intersecting[0].type : 'selected_region',
      });
    } else {
      // Short click/drag: check native text selection
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        const selectedText = selection.toString().trim();
        if (selectedText.length > 2) {
          const matchingEls = (page.elements || []).filter(
            (el) => el.text && (el.text.includes(selectedText) || selectedText.includes(el.text.trim()))
          );
          let bbox = [0, 0, page.width || 800, 100];
          if (matchingEls.length > 0) {
            bbox = [
              Math.min(...matchingEls.map((e) => e.bbox[0])),
              Math.min(...matchingEls.map((e) => e.bbox[1])),
              Math.max(...matchingEls.map((e) => e.bbox[2])),
              Math.max(...matchingEls.map((e) => e.bbox[3])),
            ];
          }
          onSelectPassage({
            pageIdx,
            elementId: matchingEls[0]?.id || `sel-${Date.now()}`,
            text: selectedText,
            bbox,
            type: matchingEls[0]?.type || 'selection',
          });
        }
      }
    }

    setDragBox(null);
  };

  const pages = docSummary?.pages || [];
  const totalPages = pages.length;

  return (
    <div className="scrollable-doc-viewer" ref={containerRef}>
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
                    className={`page-canvas-wrapper ${
                      dragBox?.isDragging && dragBox.pageIdx === pIdx ? 'is-drag-selecting' : ''
                    }`}
                    onMouseDown={(e) => handleCanvasMouseDown(e, pIdx)}
                    onMouseMove={(e) => handleCanvasMouseMove(e, pIdx)}
                    onMouseUp={(e) => handleCanvasMouseUp(e, pIdx, page)}
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
                            title={el.text ? `${el.type}: "${el.text.slice(0, 50)}..."` : `${el.type}`}
                          >
                            <span className="selectable-text-content">{el.text}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Live Drag Marquee Box Preview */}
                    {dragBox && dragBox.isDragging && dragBox.pageIdx === pIdx && (
                      <div
                        className="selection-drag-box"
                        style={{
                          left: `${Math.min(dragBox.startX, dragBox.currentX)}px`,
                          top: `${Math.min(dragBox.startY, dragBox.currentY)}px`,
                          width: `${Math.abs(dragBox.currentX - dragBox.startX)}px`,
                          height: `${Math.abs(dragBox.currentY - dragBox.startY)}px`,
                        }}
                      >
                        <div className="selection-drag-badge">Selecting Region</div>
                      </div>
                    )}

                    {/* Active Passage Highlight Overlay (if selection is from drag/non-block) */}
                    {isPassageOnThisPage && selectedPassage.bbox && selectedPassage.bbox.length === 4 && (
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
                    {isCitationOnThisPage && activeCitation.bbox && activeCitation.bbox.length === 4 && (
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
                        <div className="citation-grounding-tag">
                          <MapPin size={10} />
                          <span>{activeCitation.label || `Page ${pIdx + 1}`}</span>
                        </div>
                      </div>
                    )}
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
