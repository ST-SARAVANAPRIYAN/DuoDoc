import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, ZoomIn, ZoomOut } from 'lucide-react';

export default function DocumentCanvas({
  title = "Document Canvas",
  imageUrl,
  currentPage = 0,
  pageCount = 1,
  onPageChange,
  highlightBbox = null,
  highlightLabel = null,
  highlightColor = "#10B981"
}) {
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2.5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.6));

  return (
    <div className="canvas-card">
      <div className="canvas-toolbar">
        <div className="canvas-title">
          <FileText size={16} color="#10B981" />
          <span>{title}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {pageCount > 1 && (
            <div className="page-controls">
              <button
                className="page-btn"
                disabled={currentPage <= 0}
                onClick={() => onPageChange && onPageChange(currentPage - 1)}
                title="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="page-badge">
                Page {currentPage + 1} / {pageCount}
              </span>
              <button
                className="page-btn"
                disabled={currentPage >= pageCount - 1}
                onClick={() => onPageChange && onPageChange(currentPage + 1)}
                title="Next Page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button className="page-btn" onClick={handleZoomOut} title="Zoom Out">
              <ZoomOut size={14} />
            </button>
            <button className="page-btn" onClick={handleZoomIn} title="Zoom In">
              <ZoomIn size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="canvas-viewport" ref={containerRef}>
        {imageUrl ? (
          <div style={{ position: 'relative', display: 'inline-block', transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.15s ease' }}>
            <img
              src={imageUrl}
              alt="Document Page Visual View"
              style={{ display: 'block', maxHeight: '620px' }}
            />

            {/* Evidence Bounding Box Overlay if coordinates available */}
            {highlightBbox && highlightBbox.length === 4 && (
              <div
                style={{
                  position: 'absolute',
                  // normalized relative percentage calculation
                  left: `${(highlightBbox[0] / 800) * 100}%`,
                  top: `${(highlightBbox[1] / 1000) * 100}%`,
                  width: `${((highlightBbox[2] - highlightBbox[0]) / 800) * 100}%`,
                  height: `${((highlightBbox[3] - highlightBbox[1]) / 1000) * 100}%`,
                  border: `2px solid ${highlightColor}`,
                  backgroundColor: `${highlightColor}22`,
                  boxShadow: `0 0 12px ${highlightColor}88`,
                  borderRadius: '3px',
                  pointerEvents: 'none',
                  zIndex: 10,
                  transition: 'all 0.25s ease'
                }}
              >
                {highlightLabel && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-20px',
                      left: '0',
                      background: highlightColor,
                      color: '#000',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '3px',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {highlightLabel}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No document loaded. Upload a document or select a benchmark form to begin.
          </div>
        )}
      </div>
    </div>
  );
}
