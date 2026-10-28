import React from 'react';
import { Folder, MessageSquare, Sliders, User, Sparkles, LogIn, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';

export default function Header({
  activeTab,
  setActiveTab,
  activeEngine,
  setActiveEngine,
  systemStatus,
  onOpenStatusModal,
  onOpenAuthModal,
  selectedDocument
}) {
  const { user } = useAuth();
  const isGpu = systemStatus?.device === 'cuda';
  const isLanding = activeTab === 'home';

  // Landing Header for Homepage (Clean, No bulky workspace navbar)
  if (isLanding) {
    return (
      <header className="app-header landing-header neo-header">
        <div className="header-left-group">
          <div className="neo-window-dots" aria-hidden="true">
            <span className="dot-red" />
            <span className="dot-yellow" />
            <span className="dot-green" />
          </div>

          <div className="brand cursor-pointer" onClick={() => setActiveTab('home')}>
            <span className="brand-name">DOCUMIND</span>
            <span className="brand-sub">MULTIMODAL INTELLIGENCE</span>
          </div>
        </div>

        <div className="landing-header-right">
          <nav className="landing-quick-nav">
            <button
              type="button"
              className="landing-nav-link"
              onClick={() => setActiveTab('library')}
            >
              Document Library
            </button>
            <button
              type="button"
              className="landing-nav-link"
              onClick={() => setActiveTab('understanding')}
            >
              QA Workspace
            </button>
            <button
              type="button"
              className="landing-nav-link"
              onClick={() => setActiveTab('specs')}
            >
              Specs
            </button>
          </nav>

          <ThemeToggle />

          <button
            type="button"
            className="neo-btn-primary landing-signin-btn"
            onClick={() => setActiveTab(user && user.username !== 'guest' ? 'profile' : 'login')}
            title={user && user.username !== 'guest' ? 'View Profile' : 'Sign In'}
          >
            <User size={13} />
            <span>{user && user.username !== 'guest' ? user.name || user.username : 'Sign In'}</span>
          </button>
        </div>
      </header>
    );
  }

  // Full Workspace Header (Used inside Library, QA Chat, Specs, Manipulation)
  return (
    <header className="app-header neo-header">
      <div className="header-left-group">
        <div className="neo-window-dots" aria-hidden="true">
          <span className="dot-red" />
          <span className="dot-yellow" />
          <span className="dot-green" />
        </div>

        <div className="brand cursor-pointer" onClick={() => setActiveTab('home')} title="Return to Homepage">
          <span className="brand-name">DOCUMIND</span>
          <span className="brand-sub">INTELLIGENCE HUB</span>
        </div>
      </div>

      <nav className="nav-tabs neo-tabs">
        <button
          type="button"
          className={`nav-tab-btn ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => setActiveTab('library')}
        >
          <Folder size={14} />
          <span>1. Library</span>
        </button>

        <button
          type="button"
          className={`nav-tab-btn ${activeTab === 'understanding' ? 'active' : ''}`}
          onClick={() => setActiveTab('understanding')}
        >
          <MessageSquare size={14} />
          <span>2. QA &amp; Chat</span>
          {selectedDocument && <span className="active-doc-badge-dot" title={`Active: ${selectedDocument.filename}`} />}
        </button>

        <button
          type="button"
          className={`nav-tab-btn ${activeTab === 'specs' ? 'active' : ''}`}
          onClick={() => setActiveTab('specs')}
        >
          <Sliders size={14} />
          <span>3. Specs</span>
        </button>

        <button
          type="button"
          className={`nav-tab-btn ${activeTab === 'manipulation' ? 'active' : ''}`}
          onClick={() => setActiveTab('manipulation')}
        >
          <Sparkles size={14} />
          <span>4. Manipulation</span>
        </button>
      </nav>

      <div className="header-actions">
        <div className="engine-selector">
          <span className="engine-label font-mono text-[11px] opacity-70">Engine:</span>
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

        <ThemeToggle />

        <button
          type="button"
          className="neo-btn-user"
          onClick={() => setActiveTab('profile')}
          title="Account Settings & Profile View"
        >
          <User size={13} />
          <span className="user-name-text">{user?.name || user?.username || 'Guest'}</span>
          <span className={`role-pill role-${user?.role || 'user'}`}>
            {(user?.role || 'user').toUpperCase()}
          </span>
        </button>

        <button
          type="button"
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
