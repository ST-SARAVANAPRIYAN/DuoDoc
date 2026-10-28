import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Check, AlertCircle } from 'lucide-react';
import { uploadDocument } from '../api/libraryApi';

export default function ImportDocumentModal({ isOpen, onClose, folders = [], onUploaded }) {
  const [file, setFile] = useState(null);
  const [folderId, setFolderId] = useState('');
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith('.pdf') && !name.endsWith('.docx') && !name.endsWith('.png') && !name.endsWith('.jpg')) {
      setError('Please upload a PDF, DOCX, or PNG/JPG image file.');
      return;
    }
    setError(null);
    setFile(selectedFile);
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      const res = await uploadDocument(file, {
        folderId: folderId || undefined,
        title: title.trim() || undefined
      });
      onUploaded(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
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
          <span className="neo-window-title">import_document.sys</span>
          <button className="neo-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={15} />
          </button>
        </div>

        <div className="neo-window-body">
          <form onSubmit={handleUpload} className="space-y-4">
            {/* Drag & Drop Zone */}
            <div
              className={`neo-dropzone ${isDragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
              />
              <div className="flex flex-col items-center justify-center py-6 text-center">
                {file ? (
                  <>
                    <FileText size={36} className="text-emerald-400 mb-2" />
                    <div className="font-bold text-sm">{file.name}</div>
                    <div className="text-xs opacity-70 font-mono mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB · Ready to parse
                    </div>
                  </>
                ) : (
                  <>
                    <Upload size={32} className="opacity-75 mb-2" />
                    <div className="font-bold text-sm">Drag & Drop PDF or Word (.docx)</div>
                    <div className="text-xs opacity-70 font-mono mt-1">
                      or click to browse your local filesystem
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Document Title */}
            <div>
              <label className="neo-label">Document Title</label>
              <input
                type="text"
                className="neo-input"
                placeholder="Custom title for library display..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Target Folder Selector */}
            <div>
              <label className="neo-label">Destination Category / Folder</label>
              <select
                className="neo-select"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
              >
                <option value="">📁 Uncategorized Documents</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
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
                disabled={isUploading || !file}
              >
                {isUploading ? 'Parsing & Ingesting...' : 'Import to Library'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
