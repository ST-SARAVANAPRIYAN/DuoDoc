import React, { useState } from 'react';
import { X, Folder, Plus } from 'lucide-react';
import { createFolder } from '../api/libraryApi';

const COLOR_OPTIONS = [
  { label: 'Lime', value: '#39ff14' },
  { label: 'Cyan', value: '#00f0ff' },
  { label: 'Pink', value: '#ff007f' },
  { label: 'Yellow', value: '#ffe66d' },
  { label: 'Orange', value: '#ff7a45' },
  { label: 'Purple', value: '#b388ff' }
];

export default function CreateFolderModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#39ff14');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setLoading(true);
    try {
      const res = await createFolder({
        name: name.trim(),
        color,
        icon: 'folder',
        description: description.trim()
      });
      setName('');
      setDescription('');
      onCreated(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="neo-modal-backdrop" onClick={onClose}>
      <div className="neo-modal-window neo-window" onClick={(e) => e.stopPropagation()}>
        <div className="neo-window-header">
          <div className="neo-window-dots">
            <span className="dot-red" onClick={onClose} style={{ cursor: 'pointer' }} />
            <span className="dot-yellow" />
            <span className="dot-green" />
          </div>
          <span className="neo-window-title">new_category.sys</span>
          <button className="neo-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={15} />
          </button>
        </div>

        <div className="neo-window-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="neo-label">Category / Folder Name *</label>
              <input
                type="text"
                className="neo-input"
                placeholder="e.g. Cognitive Systems Research"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div>
              <label className="neo-label">Color Accent</label>
              <div className="flex gap-2 mt-1">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`color-pick-swatch ${color === c.value ? 'selected' : ''}`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setColor(c.value)}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="neo-label">Description (Optional)</label>
              <input
                type="text"
                className="neo-input"
                placeholder="Brief purpose of this folder..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {error && (
              <div className="neo-alert-box text-xs">
                <span>⚠️ {error}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="neo-btn-secondary flex-1"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="neo-btn-primary flex-1"
                disabled={loading || !name.trim()}
              >
                <Plus size={14} className="mr-1 inline" />
                {loading ? 'Creating...' : 'Create Folder'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
