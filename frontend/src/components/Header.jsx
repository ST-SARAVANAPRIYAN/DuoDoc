import React from 'react';
import { Layers, Cpu, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Header({
  activeTab,
  setActiveTab,
  activeEngine,
  setActiveEngine,
  systemStatus,
  onOpenStatusModal
}) {
  const isGpu = systemStatus?.device === 'cuda';
  const customReady = systemStatus?.checkpoints?.custom_model?.exists;

  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo-icon">
          <Layers size={22} />
        </div>
        <div>
          <div className="brand-title">IntelliDoc</div>
          <div className="brand-subtitle">Multimodal Document Intelligence | Team 15</div>
        </div>
      </div>

      <nav className="nav-tabs">
        <button
          className={`nav-tab-btn ${activeTab === 'specs' ? 'active' : ''}`}
          onClick={() => setActiveTab('specs')}
        >
          1. Architecture & Specs
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'understanding' ? 'active' : ''}`}
          onClick={() => setActiveTab('understanding')}
        >
          2. Document Understanding (QA)
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'manipulation' ? 'active' : ''}`}
          onClick={() => setActiveTab('manipulation')}
        >
          3. Grounded Manipulation
        </button>
      </nav>

      <div className="header-actions">
        <div className="engine-selector">
          <span>Engine:</span>
          <select
            className="engine-select-dropdown"
            value={activeEngine}
            onChange={(e) => setActiveEngine(e.target.value)}
          >
            <option value="qwopus-9b">Qwopus 3.5 9B (Claude Distilled)</option>
            <option value="dual-layer-vlm">Dual-Layer VLM (Qwen2-VL-2B)</option>
            <option value="custom-compact">Custom Compact Baseline (~3.9M)</option>
          </select>
        </div>

        <button
          className="status-badge-btn"
          onClick={onOpenStatusModal}
          title="Click to view hardware & checkpoint status"
        >
          <span className="status-dot"></span>
          <span>{isGpu ? 'RTX 4050 CUDA' : 'CPU Mode'}</span>
        </button>
      </div>
    </header>
  );
}
