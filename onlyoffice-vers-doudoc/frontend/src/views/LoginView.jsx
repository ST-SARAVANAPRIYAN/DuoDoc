import React, { useState } from 'react';
import { User, Key, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function LoginView({ onNavigate }) {
  const { login, switchRole } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await login(username.trim(), password);
      onNavigate('library');
    } catch (err) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async (roleName) => {
    setError(null);
    setIsLoading(true);
    try {
      await switchRole(roleName);
      onNavigate('library');
    } catch (err) {
      setError(err.message || 'Failed to switch demo role.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page-root portfolio-root">
      <div className="auth-card-container">
        {/* Top Control Bar with Back Link & Theme Toggle */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            className="auth-back-btn neo-btn-back"
            onClick={() => onNavigate('home')}
          >
            <ArrowLeft size={14} />
            <span>&larr; Return to Homepage</span>
          </button>

          <ThemeToggle />
        </div>

        {/* Login Card */}
        <div className="auth-window neo-window">
          {/* Header */}
          <div className="neo-window-header">
            <div className="neo-window-dots">
              <span className="dot-red" />
              <span className="dot-yellow" />
              <span className="dot-green" />
            </div>
            <span className="neo-window-title font-mono">auth.login // credentials</span>
            <span className="font-mono text-[10px] opacity-60">v3.5</span>
          </div>

          <div className="auth-window-body">
            <div className="auth-header-block">
              <h1 className="auth-title">Welcome to DocuMind</h1>
              <p className="auth-subtitle">
                Sign in to manage custom document folders, run grounded dual-representation VLM queries, and review research papers.
              </p>
            </div>

            {error && (
              <div className="auth-error-banner">
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick One-Click Demo Role Logins */}
            <div className="demo-accounts-box">
              <div className="demo-box-header font-mono">
                <span>// QUICK ONE-CLICK DEMO LOGIN (TWO ROLES: USER / ADMIN)</span>
              </div>
              <div className="demo-roles-grid demo-roles-grid-2col">
                <button
                  type="button"
                  className="demo-role-btn demo-user"
                  onClick={() => handleQuickDemo('user')}
                  disabled={isLoading}
                >
                  <span className="demo-role-badge">USER</span>
                  <span className="demo-role-user">saravana</span>
                </button>

                <button
                  type="button"
                  className="demo-role-btn demo-admin"
                  onClick={() => handleQuickDemo('admin')}
                  disabled={isLoading}
                >
                  <span className="demo-role-badge">ADMIN</span>
                  <span className="demo-role-user">admin</span>
                </button>
              </div>
            </div>

            <div className="auth-divider">
              <span>OR ENTER CREDENTIALS</span>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label font-mono">USERNAME OR EMAIL</label>
                <div className="input-with-icon">
                  <User size={15} className="input-icon" />
                  <input
                    type="text"
                    className="neo-input"
                    placeholder="e.g. saravana or saravana@mkce.ac.in"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label font-mono">PASSWORD</label>
                <div className="input-with-icon">
                  <Lock size={15} className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="neo-input"
                    placeholder="Enter your account password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="neo-btn-primary auth-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In to Workspace</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            <div className="auth-footer-links">
              <span>New to DocuMind?</span>
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => onNavigate('register')}
              >
                Create Account &rarr;
              </button>
            </div>
          </div>
        </div>

        {/* Local Security Guarantee */}
        <div className="auth-security-notice font-mono">
          <ShieldCheck size={14} className="text-lime-400 inline mr-1.5" />
          <span>MongoDB local storage • Zero cloud upload • Offline capable</span>
        </div>
      </div>
    </div>
  );
}
