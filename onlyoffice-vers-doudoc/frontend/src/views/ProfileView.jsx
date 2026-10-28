import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Key,
  Folder,
  FileText,
  Clock,
  LogOut,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw,
  FolderPlus,
  ShieldAlert,
  HardDrive
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDocuments, getFolders } from '../api/libraryApi';
import ThemeToggle from '../components/ThemeToggle';

export default function ProfileView({ onNavigate, onSelectDocument }) {
  const { user, switchRole, logout } = useAuth();
  const [stats, setStats] = useState({
    docCount: 0,
    folderCount: 0,
    pageCount: 0,
    recentDocs: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [roleSwitching, setRoleSwitching] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const [docsRes, foldersRes] = await Promise.all([
        getDocuments(),
        getFolders()
      ]);
      const docs = docsRes.documents || [];
      const folders = foldersRes.folders || [];
      const pages = docs.reduce((acc, d) => acc + (d.page_count || 1), 0);

      setStats({
        docCount: docs.length,
        folderCount: folders.length,
        pageCount: pages,
        recentDocs: docs.slice(0, 4)
      });
    } catch (err) {
      console.warn('Failed to load profile stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [user]);

  const handleRoleToggle = async (newRole) => {
    if (user?.role === newRole) return;
    setRoleSwitching(true);
    setStatusMessage(null);
    try {
      await switchRole(newRole);
      setStatusMessage(`Active operational role switched to ${newRole.toUpperCase()}.`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      setStatusMessage(`Role switch error: ${err.message}`);
    } finally {
      setRoleSwitching(false);
    }
  };

  const handleLogout = () => {
    logout();
    onNavigate('login');
  };

  const currentRole = user?.role || 'user';

  return (
    <div className="profile-page-root portfolio-root">
      <div className="profile-container">
        {/* Top Control Bar */}
        <div className="profile-top-bar">
          <button
            type="button"
            className="neo-btn-back font-mono"
            onClick={() => onNavigate('library')}
          >
            &larr; Return to Library
          </button>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              className="neo-btn-danger font-mono text-xs"
              onClick={handleLogout}
              title="End session"
            >
              <LogOut size={13} className="inline mr-1" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Profile Main Window */}
        <div className="neo-window profile-window">
          {/* Window Header */}
          <div className="neo-window-header">
            <div className="neo-window-dots">
              <span className="dot-red" />
              <span className="dot-yellow" />
              <span className="dot-green" />
            </div>
            <span className="neo-window-title font-mono">
              user_profile.cfg // {user?.username || 'user'} [{currentRole.toUpperCase()}]
            </span>
            <span className="font-mono text-[10px] opacity-60">DOCUMIND v3.5</span>
          </div>

          <div className="neo-window-body profile-body">
            {/* User Identity Banner */}
            <div className="profile-identity-card neo-card">
              <div className="profile-avatar-wrap">
                <div className="profile-avatar">
                  <User size={36} />
                </div>
                <div className={`profile-status-indicator status-${currentRole}`} />
              </div>

              <div className="profile-info-block">
                <div className="profile-names-row">
                  <h1 className="profile-fullname">{user?.name || user?.username || 'Authenticated User'}</h1>
                  <span className={`role-pill role-${currentRole} uppercase`}>
                    {currentRole}
                  </span>
                </div>

                <div className="profile-meta-tags font-mono">
                  <span className="profile-meta-item">@{user?.username || 'guest'}</span>
                  <span className="profile-meta-divider">&bull;</span>
                  <span className="profile-meta-item">{user?.email || 'user@documind.local'}</span>
                  <span className="profile-meta-divider">&bull;</span>
                  <span className="profile-meta-item">
                    Member since {user?.created_at ? new Date(user.created_at * 1000).toLocaleDateString() : 'Active Session'}
                  </span>
                </div>
              </div>

              <div className="profile-actions-aside">
                <button
                  type="button"
                  className="neo-btn-primary"
                  onClick={() => onNavigate('library')}
                >
                  <Folder size={14} />
                  <span>Library</span>
                </button>
              </div>
            </div>

            {statusMessage && (
              <div className="neo-alert-box font-mono text-xs">
                <span>⚡ {statusMessage}</span>
              </div>
            )}

            {/* Operational Role Switcher (User vs Admin) */}
            <div className="profile-section-block">
              <div className="section-header-compact">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-accent" />
                  <h3 className="section-compact-title font-mono">OPERATIONAL ROLE &amp; PERMISSIONS</h3>
                </div>
                <span className="font-mono text-[11px] opacity-70">
                  Select active role (2 Roles System)
                </span>
              </div>

              <div className="role-switch-grid-2col">
                {/* Standard User Role */}
                <div
                  className={`neo-role-choice-card ${currentRole === 'user' ? 'role-selected' : ''}`}
                  onClick={() => handleRoleToggle('user')}
                >
                  <div className="role-choice-header">
                    <div className="flex items-center gap-2">
                      <span className="role-pill role-user">USER</span>
                      <span className="font-bold text-sm">Standard User / Scholar</span>
                    </div>
                    {currentRole === 'user' && (
                      <span className="active-badge-tag">ACTIVE ROLE</span>
                    )}
                  </div>
                  <p className="role-choice-desc">
                    Personal document library, custom folder management, multi-page deep QA, bounding box grounded region reasoning, and visual chat.
                  </p>
                  <div className="role-permissions-list font-mono text-[11px]">
                    <div>✓ Upload &amp; Manage Personal Documents</div>
                    <div>✓ Create &amp; Organize Custom Folders</div>
                    <div>✓ Interactive Visual BBox Grounding</div>
                    <div>✓ Full Multi-Page Document QA</div>
                  </div>
                </div>

                {/* Admin Role */}
                <div
                  className={`neo-role-choice-card ${currentRole === 'admin' ? 'role-selected' : ''}`}
                  onClick={() => handleRoleToggle('admin')}
                >
                  <div className="role-choice-header">
                    <div className="flex items-center gap-2">
                      <span className="role-pill role-admin">ADMIN</span>
                      <span className="font-bold text-sm">System Administrator</span>
                    </div>
                    {currentRole === 'admin' && (
                      <span className="active-badge-tag">ACTIVE ROLE</span>
                    )}
                  </div>
                  <p className="role-choice-desc">
                    Unrestricted library administration, cross-folder management, hardware acceleration telemetry, reasoning engine hot-swapping, and system checkpoints.
                  </p>
                  <div className="role-permissions-list font-mono text-[11px]">
                    <div>✓ RTX 4050 Hardware &amp; VRAM Telemetry</div>
                    <div>✓ Engine Switching (Qwopus 3.5 9B / VLM)</div>
                    <div>✓ Global MongoDB Index Management</div>
                    <div>✓ Cross-Tenant Permission Auditing</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistics Grid */}
            <div className="profile-section-block">
              <div className="section-header-compact">
                <div className="flex items-center gap-2">
                  <HardDrive size={16} className="text-accent" />
                  <h3 className="section-compact-title font-mono">WORKSPACE &amp; REPOSITORY METRICS</h3>
                </div>
                <button
                  type="button"
                  className="neo-btn-icon-text font-mono text-xs"
                  onClick={loadStats}
                  disabled={isLoading}
                  title="Refresh statistics"
                >
                  <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="profile-stats-grid">
                <div className="neo-stat-card">
                  <div className="stat-card-label font-mono">TOTAL DOCUMENTS</div>
                  <div className="stat-card-value font-mono">{stats.docCount}</div>
                  <div className="stat-card-sub text-xs opacity-70">Indexed in MongoDB</div>
                </div>

                <div className="neo-stat-card">
                  <div className="stat-card-label font-mono">CUSTOM FOLDERS</div>
                  <div className="stat-card-value font-mono">{stats.folderCount}</div>
                  <div className="stat-card-sub text-xs opacity-70">User-managed categories</div>
                </div>

                <div className="neo-stat-card">
                  <div className="stat-card-label font-mono">PAGES INDEXED</div>
                  <div className="stat-card-value font-mono">{stats.pageCount}</div>
                  <div className="stat-card-sub text-xs opacity-70">Text &amp; Visual OCR layers</div>
                </div>

                <div className="neo-stat-card">
                  <div className="stat-card-label font-mono">DEFAULT ENGINE</div>
                  <div className="stat-card-value font-mono text-base mt-1">Qwopus 3.5 9B</div>
                  <div className="stat-card-sub text-xs opacity-70">Local Llama-server</div>
                </div>
              </div>
            </div>

            {/* Recent Documents Quick-Access */}
            {stats.recentDocs.length > 0 && (
              <div className="profile-section-block">
                <div className="section-header-compact">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-accent" />
                    <h3 className="section-compact-title font-mono">RECENT DOCUMENTS</h3>
                  </div>
                  <button
                    type="button"
                    className="font-mono text-xs text-accent hover:underline cursor-pointer"
                    onClick={() => onNavigate('library')}
                  >
                    View All in Library &rarr;
                  </button>
                </div>

                <div className="recent-docs-grid">
                  {stats.recentDocs.map((doc) => (
                    <div
                      key={doc.document_id}
                      className="recent-doc-item neo-card cursor-pointer"
                      onClick={() => {
                        onSelectDocument?.(doc);
                        onNavigate('understanding');
                      }}
                      title={`Open ${doc.filename} in QA Workspace`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-accent flex-shrink-0" />
                          <div>
                            <div className="font-bold text-xs truncate max-w-[200px]">
                              {doc.title || doc.filename}
                            </div>
                            <div className="font-mono text-[10px] opacity-65">
                              {doc.page_count || 1} {doc.page_count === 1 ? 'page' : 'pages'} &bull; {doc.file_type?.toUpperCase()}
                            </div>
                          </div>
                        </div>
                        <ArrowRight size={14} className="opacity-60 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
