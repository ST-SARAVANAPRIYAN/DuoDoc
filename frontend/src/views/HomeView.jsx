import React from 'react';
import {
  Folder,
  MessageSquare,
  Sparkles,
  Sliders,
  Shield,
  Layers,
  Cpu,
  ArrowRight,
  CheckCircle2,
  Lock,
  UserCheck,
  FileText,
  Search,
  ExternalLink,
  Zap,
  Terminal,
  Database
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function HomeView({ onNavigate, systemStatus }) {
  const { user, switchRole } = useAuth();
  const isCuda = systemStatus?.device === 'cuda';

  const handleRoleSelect = async (roleName) => {
    try {
      await switchRole(roleName);
      onNavigate('library');
    } catch (e) {
      console.warn('Role switch:', e);
      onNavigate('library');
    }
  };

  return (
    <div className="home-view-root portfolio-root">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-window neo-window">
          {/* Terminal Window Header */}
          <div className="neo-window-header">
            <div className="neo-window-dots">
              <span className="dot-red" />
              <span className="dot-yellow" />
              <span className="dot-green" />
            </div>
            <span className="neo-window-title font-mono">system.kernel // init_vlm_v3.5</span>
            <div className="hero-header-badge">
              <span className="pulse-dot"></span>
              <span className="font-mono text-[11px] font-bold">
                {isCuda ? 'CUDA 12.4 • RTX 4050 6GB' : 'CPU BASELINE MODE'}
              </span>
            </div>
          </div>

          <div className="hero-window-body">
            <div className="hero-tag-row">
              <span className="hero-badge hero-badge-accent">FINAL YEAR PROJECT • TEAM 15</span>
              <span className="hero-badge">MKCE • AI &amp; DATA SCIENCE</span>
              <span className="hero-badge hero-badge-cyan">100% ON-PREMISE LOCAL PRIVACY</span>
            </div>

            <h1 className="hero-title">
              Deep Learning System for <span className="highlight-lime">Multimodal Document</span>{' '}
              Understanding &amp; <span className="highlight-cyan">Grounded Manipulation</span>
            </h1>

            <p className="hero-subtitle">
              Dual-representation Vision-Language Intelligence uniting pixel-precise visual page bounding boxes, 
              Word (.docx) &amp; PDF semantic AST parsing, and zero-hallucination safe abstention.
            </p>

            <div className="hero-actions">
              <button
                type="button"
                className="neo-btn-primary hero-btn-lg"
                onClick={() => onNavigate('library')}
              >
                <Folder size={16} />
                <span>Open Document Library</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="neo-btn hero-btn-lg"
                onClick={() => onNavigate('understanding')}
              >
                <MessageSquare size={16} />
                <span>Instant QA &amp; Chat</span>
              </button>

              <button
                type="button"
                className="neo-btn hero-btn-lg hero-btn-role"
                onClick={() => onNavigate('login')}
              >
                <UserCheck size={16} />
                <span>Sign In / Demo Roles</span>
              </button>
            </div>

            {/* Live Stats Row */}
            <div className="hero-stats-row">
              <div className="hero-stat-card">
                <span className="stat-value font-mono">9B</span>
                <span className="stat-label">Claude-Distilled Parameters</span>
              </div>
              <div className="hero-stat-divider" />
              <div className="hero-stat-card">
                <span className="stat-value font-mono">&lt; 25ms</span>
                <span className="stat-label">Grounding Anchor Sync</span>
              </div>
              <div className="hero-stat-divider" />
              <div className="hero-stat-card">
                <span className="stat-value font-mono">100%</span>
                <span className="stat-label">Local Data Privacy</span>
              </div>
              <div className="hero-stat-divider" />
              <div className="hero-stat-card">
                <span className="stat-value font-mono">0.0%</span>
                <span className="stat-label">OOD Hallucination Rate</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Infinite Neo Marquee Banner */}
      <section className="marquee-strip-wrapper">
        <div className="marquee-strip">
          <div className="marquee-content">
            <span>• DUAL-REPRESENTATION VLM</span>
            <span>• ZERO CLOUD TELEMETRY</span>
            <span>• NATIVE DOCX &amp; PDF RECONSTRUCTION</span>
            <span>• PIXEL BOUNDING BOX GROUNDING</span>
            <span>• SECTION HIERARCHY CLUSTERING</span>
            <span>• MONGODB PERSISTENCE</span>
            <span>• REVOLUTIONARY SAFE ABSTENTION</span>
            <span>• ROLE-BASED ACCESS CONTROL</span>
          </div>
          <div className="marquee-content" aria-hidden="true">
            <span>• DUAL-REPRESENTATION VLM</span>
            <span>• ZERO CLOUD TELEMETRY</span>
            <span>• NATIVE DOCX &amp; PDF RECONSTRUCTION</span>
            <span>• PIXEL BOUNDING BOX GROUNDING</span>
            <span>• SECTION HIERARCHY CLUSTERING</span>
            <span>• MONGODB PERSISTENCE</span>
            <span>• REVOLUTIONARY SAFE ABSTENTION</span>
            <span>• ROLE-BASED ACCESS CONTROL</span>
          </div>
        </div>
      </section>

      {/* Core Architectural Capabilities Bento Grid */}
      <section className="bento-section">
        <div className="section-header-row">
          <div className="section-title-box">
            <span className="section-label font-mono">// CORE_CAPABILITIES</span>
            <h2 className="section-heading">Engineered for Rigorous Document Intelligence</h2>
          </div>
          <span className="section-badge font-mono">6 ADVANCED MODULES</span>
        </div>

        <div className="features-bento-grid">
          {/* Card 1: Dual-Layer VLM */}
          <article className="bento-card neo-window bento-span-2">
            <div className="neo-window-header">
              <div className="neo-window-dots">
                <span className="dot-red" />
                <span className="dot-yellow" />
                <span className="dot-green" />
              </div>
              <span className="neo-window-title font-mono">module.01 // dual_vlm</span>
              <span className="badge-tag">FOUNDATION</span>
            </div>
            <div className="bento-card-body">
              <div className="bento-card-icon">
                <Cpu size={24} className="text-lime-400" />
              </div>
              <h3 className="bento-card-title">Dual-Representation Reasoning Architecture</h3>
              <p className="bento-card-text">
                Unifies high-resolution visual page bitmaps with semantic AST hierarchical trees. 
                Qwopus 3.5 9B reasons over spatial layouts, tables, and architecture diagrams simultaneously, 
                generating step-by-step thinking traces before answering.
              </p>
              <div className="bento-card-tags">
                <span className="tag-pill">Vision Projection</span>
                <span className="tag-pill">AST Trees</span>
                <span className="tag-pill">Thought Deltas</span>
              </div>
            </div>
          </article>

          {/* Card 2: Interactive Grounding */}
          <article className="bento-card neo-window">
            <div className="neo-window-header">
              <div className="neo-window-dots">
                <span className="dot-red" />
                <span className="dot-yellow" />
                <span className="dot-green" />
              </div>
              <span className="neo-window-title font-mono">module.02 // grounding</span>
            </div>
            <div className="bento-card-body">
              <div className="bento-card-icon">
                <TargetIcon size={24} className="text-cyan-400" />
              </div>
              <h3 className="bento-card-title">Interactive Canvas Grounding</h3>
              <p className="bento-card-text">
                Select any paragraph, formula, or figure on the document canvas. 
                The system locks focus, expands hierarchical context, and grounds answers with exact coordinate bounding boxes.
              </p>
              <div className="bento-card-tags">
                <span className="tag-pill">BBox Sync</span>
                <span className="tag-pill">Context Expansion</span>
              </div>
            </div>
          </article>

          {/* Card 3: Safe Abstention Gate */}
          <article className="bento-card neo-window">
            <div className="neo-window-header">
              <div className="neo-window-dots">
                <span className="dot-red" />
                <span className="dot-yellow" />
                <span className="dot-green" />
              </div>
              <span className="neo-window-title font-mono">module.03 // safety_gate</span>
            </div>
            <div className="bento-card-body">
              <div className="bento-card-icon">
                <Shield size={24} className="text-pink-400" />
              </div>
              <h3 className="bento-card-title">Safe Abstention Engine</h3>
              <p className="bento-card-text">
                Prevents hallucination when users ask out-of-domain questions (e.g. unrelated Python code or trivia). 
                Dual-defense filters decline politely in under 5ms without wasting GPU compute.
              </p>
              <div className="bento-card-tags">
                <span className="tag-pill">Zero Hallucination</span>
                <span className="tag-pill">OOD Gate</span>
              </div>
            </div>
          </article>

          {/* Card 4: Full-Stack Library */}
          <article className="bento-card neo-window bento-span-2">
            <div className="neo-window-header">
              <div className="neo-window-dots">
                <span className="dot-red" />
                <span className="dot-yellow" />
                <span className="dot-green" />
              </div>
              <span className="neo-window-title font-mono">module.04 // mongodb_library</span>
              <span className="badge-tag">PERSISTENCE</span>
            </div>
            <div className="bento-card-body">
              <div className="bento-card-icon">
                <Database size={24} className="text-yellow-400" />
              </div>
              <h3 className="bento-card-title">User Categories &amp; MongoDB Document Library</h3>
              <p className="bento-card-text">
                Create custom folders with dedicated color palettes. Ingest PDFs, Word DOCX files, and research papers. 
                Chat sessions and reasoning histories persist cleanly across logins.
              </p>
              <div className="bento-card-tags">
                <span className="tag-pill">MongoDB Atlas/Local</span>
                <span className="tag-pill">Custom Folders</span>
                <span className="tag-pill">Persistent Chat</span>
              </div>
            </div>
          </article>

          {/* Card 5: Native Manipulation */}
          <article className="bento-card neo-window">
            <div className="neo-window-header">
              <div className="neo-window-dots">
                <span className="dot-red" />
                <span className="dot-yellow" />
                <span className="dot-green" />
              </div>
              <span className="neo-window-title font-mono">module.05 // docx_manip</span>
            </div>
            <div className="bento-card-body">
              <div className="bento-card-icon">
                <Sparkles size={24} className="text-purple-400" />
              </div>
              <h3 className="bento-card-title">Grounded Word Manipulation</h3>
              <p className="bento-card-text">
                Targeted structural updates to fonts, styles, colors, and layouts directly in native Microsoft Word (.docx) 
                with instantaneous canvas re-rendering.
              </p>
              <div className="bento-card-tags">
                <span className="tag-pill">AST Run Patching</span>
                <span className="tag-pill">Live Export</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* Role-Based Personas Section */}
      <section className="roles-section">
        <div className="section-header-row">
          <div className="section-title-box">
            <span className="section-label font-mono">// ACCESS_CONTROL</span>
            <h2 className="section-heading">Tailored Experiences by User Role</h2>
          </div>
          <span className="section-badge font-mono">ROLE-BASED RBAC</span>
        </div>

        <div className="roles-grid roles-grid-2col">
          {/* Standard User Card */}
          <div
            className={`role-persona-card neo-window cursor-pointer ${user?.role === 'user' ? 'role-active-card' : ''}`}
            onClick={() => handleRoleSelect('user')}
          >
            <div className="neo-window-header">
              <span className="role-pill role-user">USER</span>
              <span className="neo-window-title font-mono">saravana // active</span>
            </div>
            <div className="role-persona-body">
              <h4 className="role-persona-title">Standard User &amp; Scholar</h4>
              <p className="role-persona-desc">
                Full access to personal document library, multi-page QA, interactive passage grounding, citation verification, custom folder management, and visual bounding boxes.
              </p>
              <ul className="role-feature-list font-mono text-xs">
                <li><CheckCircle2 size={13} className="inline text-lime-400 mr-1.5" />Multi-page PDF &amp; DOCX Analysis</li>
                <li><CheckCircle2 size={13} className="inline text-lime-400 mr-1.5" />Visual Bounding Box Citations</li>
                <li><CheckCircle2 size={13} className="inline text-lime-400 mr-1.5" />Autonomous Step-by-Step Reasoning</li>
                <li><CheckCircle2 size={13} className="inline text-lime-400 mr-1.5" />Custom Document Categories</li>
              </ul>
              <button type="button" className="neo-btn-primary role-switch-btn mt-4">
                <span>Enter as User</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Admin Card */}
          <div
            className={`role-persona-card neo-window cursor-pointer ${user?.role === 'admin' ? 'role-active-card' : ''}`}
            onClick={() => handleRoleSelect('admin')}
          >
            <div className="neo-window-header">
              <span className="role-pill role-admin">ADMINISTRATOR</span>
              <span className="neo-window-title font-mono">admin // sys</span>
            </div>
            <div className="role-persona-body">
              <h4 className="role-persona-title">System Administrator</h4>
              <p className="role-persona-desc">
                Monitor RTX 4050 hardware status, switch between VLM reasoning engines, inspect database indices, manage system checkpoints, and audit cross-folder permissions.
              </p>
              <ul className="role-feature-list font-mono text-xs">
                <li><CheckCircle2 size={13} className="inline text-pink-400 mr-1.5" />Hardware &amp; VRAM Telemetry</li>
                <li><CheckCircle2 size={13} className="inline text-pink-400 mr-1.5" />Engine Hot-Swapping (Qwopus / VLM)</li>
                <li><CheckCircle2 size={13} className="inline text-pink-400 mr-1.5" />Full MongoDB Admin Control</li>
                <li><CheckCircle2 size={13} className="inline text-pink-400 mr-1.5" />Cross-Tenant Security Management</li>
              </ul>
              <button type="button" className="neo-btn role-switch-btn mt-4">
                <span>Enter as Admin</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Team & Project Credential Footer */}
      <footer className="home-footer-strip neo-window">
        <div className="footer-col-left">
          <div className="footer-team-title">Team 15 • Final Year Project</div>
          <div className="footer-team-members">
            Saravana Priyan S T • Sardheesh M • Venkat Ragav N • Vishnu V
          </div>
          <div className="footer-guide">
            Guide: Ms. C. Bavithra, Assistant Professor • Dept of AI &amp; Data Science
          </div>
        </div>

        <div className="footer-col-right">
          <div className="footer-college font-mono">M. KUMARASAMY COLLEGE OF ENGINEERING</div>
          <div className="footer-sub font-mono text-xs opacity-60">Autonomous Institution • NAAC 'A' Grade • Karur</div>
          <div className="footer-links-row mt-2">
            <button type="button" className="footer-link-btn" onClick={() => onNavigate('specs')}>
              Technical Specs
            </button>
            <span className="opacity-30">&bull;</span>
            <button type="button" className="footer-link-btn" onClick={() => onNavigate('library')}>
              Document Library
            </button>
            <span className="opacity-30">&bull;</span>
            <button type="button" className="footer-link-btn" onClick={() => onNavigate('login')}>
              Login / Register
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TargetIcon({ size = 20, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
