import React, { useState, useEffect } from 'react';
import {
  Folder,
  Plus,
  Search,
  FileText,
  Trash2,
  MoreVertical,
  ExternalLink,
  Tag,
  Upload,
  Calendar,
  Layers,
  ArrowRight,
  FolderPlus,
  Sparkles,
  Move,
  Check
} from 'lucide-react';
import { getFolders, getDocuments, deleteDocument, deleteFolder, moveDocument } from '../api/libraryApi';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import AuthModal from '../components/AuthModal';
import CreateFolderModal from '../components/CreateFolderModal';
import ImportDocumentModal from '../components/ImportDocumentModal';

export default function DocumentLibraryView({ onSelectDocument }) {
  const { user } = useAuth();
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [movingDocId, setMovingDocId] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [foldersRes, docsRes] = await Promise.all([
        getFolders(),
        getDocuments({
          folderId: selectedFolderId,
          search: searchQuery,
          fileType: fileTypeFilter
        })
      ]);
      setFolders(foldersRes.folders || []);
      setDocuments(docsRes.documents || []);
    } catch (err) {
      console.error('Failed to load library data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedFolderId, fileTypeFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      getDocuments({
        folderId: selectedFolderId,
        search: searchQuery,
        fileType: fileTypeFilter
      }).then((res) => setDocuments(res.documents || []));
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDeleteDoc = async (e, docId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this document from the library?')) return;
    try {
      await deleteDocument(docId);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteFolder = async (e, folderId, folderName) => {
    e.stopPropagation();
    if (!window.confirm(`Delete folder '${folderName}'? Contained documents will become Uncategorized.`)) return;
    try {
      await deleteFolder(folderId);
      if (selectedFolderId === folderId) setSelectedFolderId('all');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMoveDoc = async (e, docId, targetFolderId) => {
    e.stopPropagation();
    try {
      await moveDocument(docId, targetFolderId || null);
      setMovingDocId(null);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const activeFolder = folders.find((f) => f.id === selectedFolderId);

  return (
    <div className="library-root portfolio-root">
      {/* Library Banner / Action Bar */}
      <div className="library-action-bar neo-window">
        <div className="flex items-center gap-2">
          <div className="neo-window-dots">
            <span className="dot-red" />
            <span className="dot-yellow" />
            <span className="dot-green" />
          </div>
          <span className="neo-window-title font-mono text-xs">catalog.explorer</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="neo-btn"
            onClick={() => setIsCreateFolderOpen(true)}
          >
            <FolderPlus size={14} />
            <span>+ New Category</span>
          </button>

          <button
            type="button"
            className="neo-btn-primary flex items-center gap-1.5"
            onClick={() => setIsImportOpen(true)}
          >
            <Upload size={14} />
            <span>Import Document</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="library-container">
        {/* Left Sidebar: Categories & Folders */}
        <aside className="library-sidebar neo-window">
          <div className="neo-window-header">
            <div className="neo-window-dots">
              <span className="dot-red" />
              <span className="dot-yellow" />
              <span className="dot-green" />
            </div>
            <span className="neo-window-title">folders.tree</span>
          </div>

          <div className="sidebar-content">
            <div className="sidebar-nav-group">
              <button
                type="button"
                className={`sidebar-folder-btn ${selectedFolderId === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedFolderId('all')}
              >
                <Layers size={15} className="mr-2 text-cyan-400" />
                <span className="flex-1 text-left font-bold">All Documents</span>
                <span className="folder-count-badge">{documents.length}</span>
              </button>

              <button
                type="button"
                className={`sidebar-folder-btn ${selectedFolderId === 'uncategorized' ? 'active' : ''}`}
                onClick={() => setSelectedFolderId('uncategorized')}
              >
                <FileText size={15} className="mr-2 opacity-60" />
                <span className="flex-1 text-left">Uncategorized</span>
              </button>
            </div>

            {/* Custom Folders Section */}
            <div className="sidebar-section-divider">
              <span className="text-[10px] font-mono tracking-wider font-bold opacity-60 uppercase">
                Categories ({folders.length})
              </span>
              <button
                type="button"
                className="neo-btn-icon-sm"
                onClick={() => setIsCreateFolderOpen(true)}
                title="Create New Category / Folder"
              >
                <Plus size={12} />
              </button>
            </div>

            <div className="custom-folders-list">
              {folders.map((f) => (
                <div
                  key={f.id}
                  className={`sidebar-folder-row ${selectedFolderId === f.id ? 'active' : ''}`}
                  onClick={() => setSelectedFolderId(f.id)}
                >
                  <span
                    className="folder-color-dot"
                    style={{ backgroundColor: f.color || '#39ff14' }}
                  />
                  <span className="folder-name flex-1 truncate font-medium">
                    {f.name}
                  </span>
                  <span className="folder-count-badge mr-1">{f.doc_count || 0}</span>
                  <button
                    type="button"
                    className="folder-del-btn"
                    onClick={(e) => handleDeleteFolder(e, f.id, f.name)}
                    title="Delete Category"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="add-folder-dashed-btn mt-2"
                onClick={() => setIsCreateFolderOpen(true)}
              >
                <FolderPlus size={14} className="mr-1.5" />
                <span>+ Add Category</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content: Search Bar & Documents Grid */}
        <main className="library-main">
          {/* Filter Bar */}
          <div className="library-filter-bar neo-window">
            <div className="search-box-wrapper flex-1 flex items-center gap-2">
              <Search size={16} className="opacity-60" />
              <input
                type="text"
                className="search-input"
                placeholder="Search documents by title, tags, or file name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="format-pills flex items-center gap-1.5">
              {['all', 'pdf', 'docx'].map((ft) => (
                <button
                  key={ft}
                  type="button"
                  className={`format-pill ${fileTypeFilter === ft ? 'active' : ''}`}
                  onClick={() => setFileTypeFilter(ft)}
                >
                  {ft.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Active Folder Header */}
          <div className="category-header-banner">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2 font-mono">
                {activeFolder ? (
                  <>
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ backgroundColor: activeFolder.color || '#39ff14' }}
                    />
                    <span>{activeFolder.name}</span>
                  </>
                ) : selectedFolderId === 'uncategorized' ? (
                  <span>Uncategorized Files</span>
                ) : (
                  <span>All Documents ({documents.length})</span>
                )}
              </h2>
              {activeFolder?.description && (
                <p className="text-xs opacity-75 font-mono mt-0.5">{activeFolder.description}</p>
              )}
            </div>

            <div className="text-xs font-mono opacity-60">
              Showing {documents.length} document{documents.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Document Cards Grid */}
          {isLoading ? (
            <div className="grid-loading-box neo-window">
              <div className="font-mono text-sm">Loading document library...</div>
            </div>
          ) : documents.length === 0 ? (
            <div className="empty-library-box neo-window">
              <div className="neo-window-header">
                <div className="neo-window-dots">
                  <span className="dot-red" />
                  <span className="dot-yellow" />
                  <span className="dot-green" />
                </div>
                <span className="neo-window-title">empty_state.sys</span>
              </div>
              <div className="p-8 text-center">
                <FileText size={48} className="mx-auto opacity-40 mb-3" />
                <h3 className="font-bold text-base mb-1">No documents in this view</h3>
                <p className="text-xs opacity-70 font-mono mb-4 max-w-md mx-auto">
                  Import a research paper, Word document (.docx), or report to start exploring with multimodal AI and interactive chat.
                </p>
                <button
                  type="button"
                  className="neo-btn-primary"
                  onClick={() => setIsImportOpen(true)}
                >
                  <Upload size={14} className="mr-1.5 inline" />
                  Import Document
                </button>
              </div>
            </div>
          ) : (
            <div className="documents-bento-grid">
              {documents.map((doc) => {
                const isDocx = doc.file_type === 'docx';
                const isPdf = doc.file_type === 'pdf';

                return (
                  <article
                    key={doc.document_id}
                    className="doc-card neo-window cursor-pointer"
                    onClick={() => onSelectDocument(doc)}
                  >
                    {/* Header */}
                    <div className="neo-window-header">
                      <div className="neo-window-dots">
                        <span className="dot-red" />
                        <span className="dot-yellow" />
                        <span className="dot-green" />
                      </div>
                      <span className="neo-window-title truncate">{doc.filename}</span>
                      <span className={`file-format-badge format-${doc.file_type}`}>
                        {doc.file_type.toUpperCase()}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="doc-card-body">
                      <h3 className="doc-card-title">{doc.title}</h3>

                      <div className="doc-meta-row">
                        <span className="doc-meta-pill">
                          <Layers size={11} className="mr-1 inline" />
                          {doc.page_count} {doc.page_count === 1 ? 'Page' : 'Pages'}
                        </span>
                        <span className="doc-meta-pill">
                          {(doc.file_size / 1024 / 1024).toFixed(1)} MB
                        </span>
                        {doc.folder_name && (
                          <span
                            className="doc-folder-pill"
                            style={{ borderColor: doc.folder_color || '#39ff14' }}
                          >
                            <span
                              className="folder-dot"
                              style={{ backgroundColor: doc.folder_color || '#39ff14' }}
                            />
                            {doc.folder_name}
                          </span>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="doc-card-footer" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="neo-btn-open-chat flex-1 flex items-center justify-center gap-1.5"
                          onClick={() => onSelectDocument(doc)}
                        >
                          <Sparkles size={13} className="text-cyan-400" />
                          <span>Open Workspace & Chat</span>
                          <ArrowRight size={13} />
                        </button>

                        {/* Move Folder Menu Toggle */}
                        <div className="relative">
                          <button
                            type="button"
                            className="neo-btn-icon-card"
                            onClick={() => setMovingDocId(movingDocId === doc.document_id ? null : doc.document_id)}
                            title="Move to Category"
                          >
                            <Move size={13} />
                          </button>

                          {movingDocId === doc.document_id && (
                            <div className="folder-move-dropdown neo-window">
                              <div className="dropdown-title">Move to Category</div>
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={(e) => handleMoveDoc(e, doc.document_id, null)}
                              >
                                📁 Uncategorized
                              </button>
                              {folders.map((f) => (
                                <button
                                  key={f.id}
                                  type="button"
                                  className={`dropdown-item ${doc.folder_id === f.id ? 'active' : ''}`}
                                  onClick={(e) => handleMoveDoc(e, doc.document_id, f.id)}
                                >
                                  <span
                                    className="folder-dot mr-1.5"
                                    style={{ backgroundColor: f.color }}
                                  />
                                  <span>{f.name}</span>
                                  {doc.folder_id === f.id && <Check size={12} className="ml-auto text-emerald-400" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Delete Button */}
                        <button
                          type="button"
                          className="neo-btn-icon-card text-red-400"
                          onClick={(e) => handleDeleteDoc(e, doc.document_id)}
                          title="Delete Document"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onCreated={() => loadData()}
      />
      <ImportDocumentModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        folders={folders}
        onUploaded={() => loadData()}
      />
    </div>
  );
}
