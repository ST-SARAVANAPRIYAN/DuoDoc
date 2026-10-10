import React from 'react';
import { Layers, CheckCircle2, ShieldCheck, Cpu, Award, BookOpen } from 'lucide-react';

export default function SpecificationView({ activeEngine, systemStatus }) {
  const isVlm = activeEngine === 'dual-layer-vlm';

  const stages = [
    { num: "STAGE 1", title: "Document Parsing", desc: "Heterogeneous ingestion of native Microsoft Word (.docx) and arbitrary vector/scanned PDF documents into structured elements." },
    { num: "STAGE 2", title: "Dual Representation", desc: "Maintains complementary Structural AST (hierarchical elements, coordinates, typography) and Visual Representation (high-res page rasters)." },
    { num: "STAGE 3", title: "Multimodal Fusion", desc: "Cross-modal attention combining visual patches, 2D normalized bounding boxes, and text tokens into contextualized embeddings." },
    { num: "STAGE 4", title: "Unified Document Model", desc: "Schema abstraction enforcing ID uniqueness, page coordinate boundaries, and typographic integrity." },
    { num: "STAGE 5A", title: "Document Understanding", desc: "Extractive question answering and physical evidence grounding with pixel-accurate bounding box coordinates." },
    { num: "STAGE 5B", title: "Grounded Manipulation", desc: "Translates natural language editing instructions into validated atomic AST state operations (SET_STYLE, REPLACE_TEXT)." },
    { num: "STAGE 6", title: "Safety Gate & Abstention", desc: "Action safety validation enforcing allowable operations, font bounds, and entropy-based confidence calibration." },
    { num: "STAGE 7", title: "Dynamic Generation", desc: "Dynamic canvas visual re-rendering alongside native Microsoft Word (.docx) generation with preserved formatting." },
  ];

  const literature = [
    { paper: "DocEdit-v2 (EMNLP 2024)", authors: "M. Suri et al.", contribution: "Grounded multimodal document editing via region localization and structured operation generation." },
    { paper: "ColPali (ICLR 2025)", authors: "M. Faysse et al.", contribution: "Late-interaction vision-language embedding directly over visual document page images." },
    { paper: "Pix2Struct (ICML 2023)", authors: "K. Lee et al.", contribution: "Screenshot parsing pretraining for visual language and document layout understanding." },
    { paper: "FUNSD Benchmark (ICDAR)", authors: "Guillaume Jaume et al.", contribution: "Form Understanding in Noisy Scanned Documents benchmark containing real scanned forms with OCR bboxes." },
  ];

  return (
    <div>
      {/* Top Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          Deep Learning System for Multimodal Document Understanding and Manipulation
        </h1>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Department of Artificial Intelligence and Data Science | M. Kumarasamy College of Engineering | Team 15
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="metric-grid">
        <div className="metric-tile">
          <div className="metric-label">Model Architecture</div>
          <div className="metric-value">{isVlm ? "Dual-Layer VLM" : "ViT + Fusion"}</div>
          <div className="metric-hint">{isVlm ? "Layer 1 AST + Layer 2 Foundation" : "From Scratch Baseline"}</div>
        </div>
        <div className="metric-tile">
          <div className="metric-label">Trainable / Model Size</div>
          <div className="metric-value">{isVlm ? "2.2 Billion" : "3.90 Million"}</div>
          <div className="metric-hint">{isVlm ? "Qwen2-VL Foundation Backbone" : "Zero External Pretrained Weights"}</div>
        </div>
        <div className="metric-tile">
          <div className="metric-label">Hardware Acceleration</div>
          <div className="metric-value">RTX 4050 CUDA</div>
          <div className="metric-hint">6GB VRAM Laptop GPU Ready</div>
        </div>
        <div className="metric-tile">
          <div className="metric-label">Inference Latency</div>
          <div className="metric-value">{isVlm ? "~45 ms" : "1.94 ms"}</div>
          <div className="metric-hint">{isVlm ? "P50 Interactive Latency" : "P50 Batch Microsecond Latency"}</div>
        </div>
      </div>

      {/* Slide 2: Problem Statement & Motivation */}
      <div className="glass-panel" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.75rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={20} />
          1. Problem Statement & Motivation (Slide 2)
        </h3>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.92rem' }}>
          Modern digital documents contain diverse and interrelated information in the form of text, tables, images, charts, and complex layouts.
          Existing systems process these elements independently, creating a critical gap between <b>document understanding</b> and <b>document manipulation</b>.
          Our framework maintains complementary <b>Dual Representations</b> (Structural AST + Visual Canvas) to enable context-aware question answering and execute validated, structure-preserving document edits.
        </p>
      </div>

      {/* Slide 10: 7-Stage End-to-End System Architecture */}
      <div className="glass-panel" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.75rem', color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={20} />
          2. End-to-End 7-Stage System Architecture (Slide 10 Alignment)
        </h3>
        <div className="flow-step-grid" style={{ marginTop: '1.25rem' }}>
          {stages.map((stg) => (
            <div key={stg.num} className="flow-card">
              <div className="flow-card-num">{stg.num}</div>
              <div className="flow-card-title">{stg.title}</div>
              <div className="flow-card-desc">{stg.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Literature Foundations & Team */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
        <div className="glass-panel">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#6366F1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={18} />
            Literature Survey Foundations (Slides 4–6)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {literature.map((lit, i) => (
              <div key={i} style={{ background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{lit.paper}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{lit.authors}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{lit.contribution}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} />
            Project Review Credentials
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
            <div><b>Target Milestone:</b> Project Review I → Review II</div>
            <div><b>Institution:</b> M. Kumarasamy College of Engineering, Karur</div>
            <div><b>Department:</b> Artificial Intelligence & Data Science</div>
            <div><b>Project Guide:</b> Ms. C. Bavithra (Assistant Professor)</div>
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
              <b>Team 15 Members:</b>
              <ul style={{ paddingLeft: '1.25rem', marginTop: '0.35rem', color: 'var(--text-secondary)' }}>
                <li>Saravana Priyan S T (927623BAD100)</li>
                <li>Sardheesh M (927623BAD101)</li>
                <li>Venkat Ragav N (927623BAD123)</li>
                <li>Vishnu V (927623BAD125)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
