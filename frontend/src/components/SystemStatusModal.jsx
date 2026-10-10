import React from 'react';
import { X, CheckCircle, AlertTriangle, HardDrive, Cpu, FolderCheck } from 'lucide-react';

export default function SystemStatusModal({ isOpen, onClose, systemStatus }) {
  if (!isOpen) return null;

  const gpu = systemStatus?.gpu || {};
  const chk = systemStatus?.checkpoints || {};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Cpu size={22} color="#10B981" />
            System Hardware & Checkpoints Configuration
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Hardware Stats */}
          <div style={{ background: '#080D1A', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94A3B8', marginBottom: '0.5rem', fontWeight: 700 }}>
              Hardware Accelerator
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
              <div><b>Device:</b> {systemStatus?.device?.toUpperCase()}</div>
              <div><b>GPU:</b> {gpu?.name || systemStatus?.device_name || 'N/A'}</div>
              <div><b>Allocated VRAM:</b> {gpu?.allocated_mb || 0} MB</div>
              <div><b>Total VRAM:</b> {gpu?.total_mb || 'N/A'} MB</div>
            </div>
          </div>

          {/* Checkpoints Status */}
          <div style={{ background: '#080D1A', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94A3B8', marginBottom: '0.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <HardDrive size={16} /> Checkpoints Directory
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#38BDF8', marginBottom: '0.85rem' }}>
              {chk?.checkpoint_dir}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Custom Model (<code>best_model.pt</code>):</span>
                {chk?.custom_model?.exists ? (
                  <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                    <CheckCircle size={15} /> Ready ({chk?.custom_model?.size_mb} MB)
                  </span>
                ) : (
                  <span style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                    <AlertTriangle size={15} /> Missing from checkpoints/
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Subword Tokenizer (<code>tokenizer.json</code>):</span>
                {chk?.tokenizer?.exists ? (
                  <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                    <CheckCircle size={15} /> Ready
                  </span>
                ) : (
                  <span style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                    <AlertTriangle size={15} /> Missing
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Foundation VLM Backbone:</span>
                <span style={{ color: '#38BDF8', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                  {chk?.vlm?.model_identifier}
                </span>
              </div>
            </div>
          </div>

          {/* Checkpoint Guidance note */}
          <div style={{ fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.5, background: 'rgba(99, 102, 241, 0.08)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            💡 <b>External Checkpoint Loading:</b> You can put your downloaded model checkpoints into <code>./checkpoints/</code> directly, or customize the directory path in <code>.env</code> using <code>CHECKPOINT_DIR=/your/custom/path</code>.
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="action-btn action-btn-secondary" style={{ width: 'auto' }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
