import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, User, Key, Shield, Check, LogOut, ChevronRight } from 'lucide-react';

export default function AuthModal({ isOpen, onClose }) {
  const { user, login, register, logout, switchRole } = useAuth();
  const [tab, setTab] = useState('demo'); // 'demo' | 'login' | 'register'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      onClose();
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({ username, email, password, role });
      onClose();
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (targetRole) => {
    setError(null);
    setLoading(true);
    try {
      await switchRole(targetRole);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="neo-modal-backdrop" onClick={onClose}>
      <div className="neo-modal-window neo-window auth-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="neo-window-header">
          <div className="neo-window-dots">
            <span className="dot-red" onClick={onClose} style={{ cursor: 'pointer' }} />
            <span className="dot-yellow" />
            <span className="dot-green" />
          </div>
          <span className="neo-window-title font-mono">access_control.sys // 2-roles</span>
          <button className="neo-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={15} />
          </button>
        </div>

        <div className="neo-window-body auth-modal-body">
          {/* User Info Bar if logged in */}
          {user && (
            <div className="modal-user-banner">
              <div className="modal-user-left">
                <div className="neo-avatar">
                  <User size={16} />
                </div>
                <div>
                  <div className="font-bold text-sm leading-tight">{user.name || user.username}</div>
                  <div className="text-xs opacity-70 font-mono">{user.email}</div>
                </div>
              </div>
              <div className="modal-user-right">
                <span className={`role-pill role-${user.role || 'user'}`}>
                  {(user.role || 'user').toUpperCase()}
                </span>
                <button
                  type="button"
                  className="neo-btn-icon-danger"
                  onClick={logout}
                  title="Sign Out"
                >
                  <LogOut size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="modal-tabs-nav">
            <button
              type="button"
              className={`modal-tab-btn ${tab === 'demo' ? 'active' : ''}`}
              onClick={() => { setTab('demo'); setError(null); }}
            >
              <Shield size={13} className="inline mr-1" />
              Role Switcher
            </button>
            <button
              type="button"
              className={`modal-tab-btn ${tab === 'login' ? 'active' : ''}`}
              onClick={() => { setTab('login'); setError(null); }}
            >
              <Key size={13} className="inline mr-1" />
              Sign In
            </button>
            <button
              type="button"
              className={`modal-tab-btn ${tab === 'register' ? 'active' : ''}`}
              onClick={() => { setTab('register'); setError(null); }}
            >
              <User size={13} className="inline mr-1" />
              Register
            </button>
          </div>

          {error && (
            <div className="neo-alert-box font-mono text-xs mb-3">
              <span>⚠️ {error}</span>
            </div>
          )}

          {/* Quick Demo Switcher (2 Roles: user vs admin) */}
          {tab === 'demo' && (
            <div className="modal-role-container">
              <p className="font-mono text-xs opacity-75 mb-2.5">
                Select an operational role to switch permissions across Document Library and QA workspace:
              </p>

              <div
                className={`modal-role-card ${user?.role === 'user' ? 'active-role' : ''}`}
                onClick={() => handleQuickDemo('user')}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="role-pill role-user">USER</span>
                      <span className="font-bold text-sm">Standard User &amp; Scholar</span>
                    </div>
                    <div className="text-xs opacity-75">Personal library, document QA, grounded region reasoning</div>
                  </div>
                  {user?.role === 'user' ? (
                    <Check size={18} className="text-accent flex-shrink-0" />
                  ) : (
                    <ChevronRight size={16} className="opacity-50 flex-shrink-0" />
                  )}
                </div>
              </div>

              <div
                className={`modal-role-card ${user?.role === 'admin' ? 'active-role' : ''}`}
                onClick={() => handleQuickDemo('admin')}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="role-pill role-admin">ADMIN</span>
                      <span className="font-bold text-sm">System Administrator</span>
                    </div>
                    <div className="text-xs opacity-75">Full tenant access, cross-folder management, audit verification</div>
                  </div>
                  {user?.role === 'admin' ? (
                    <Check size={18} className="text-accent flex-shrink-0" />
                  ) : (
                    <ChevronRight size={16} className="opacity-50 flex-shrink-0" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Login Form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="modal-auth-form">
              <div className="form-group mb-3">
                <label className="neo-label font-mono text-xs">USERNAME OR EMAIL</label>
                <input
                  type="text"
                  className="neo-input"
                  placeholder="e.g. saravana"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-group mb-4">
                <label className="neo-label font-mono text-xs">PASSWORD</label>
                <input
                  type="password"
                  className="neo-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="neo-btn-primary w-full"
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Register Form */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="modal-auth-form">
              <div className="form-group mb-2.5">
                <label className="neo-label font-mono text-xs">USERNAME</label>
                <input
                  type="text"
                  className="neo-input"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-group mb-2.5">
                <label className="neo-label font-mono text-xs">EMAIL ADDRESS</label>
                <input
                  type="email"
                  className="neo-input"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group mb-2.5">
                <label className="neo-label font-mono text-xs">PASSWORD</label>
                <input
                  type="password"
                  className="neo-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group mb-4">
                <label className="neo-label font-mono text-xs">ROLE</label>
                <select
                  className="neo-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="user">User (Standard Document QA &amp; Library)</option>
                  <option value="admin">Admin (System Hardware &amp; Audit)</option>
                </select>
              </div>

              <button
                type="submit"
                className="neo-btn-primary w-full"
                disabled={loading}
              >
                {loading ? 'Creating Profile...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
