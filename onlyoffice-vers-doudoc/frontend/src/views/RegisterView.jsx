import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, Shield, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function RegisterView({ onNavigate }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password || !email.trim()) {
      setError('Please fill in username, email, and password.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        name: name.trim() || username.trim(),
        role
      });
      onNavigate('library');
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your credentials.');
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

        {/* Register Window Card */}
        <div className="auth-window neo-window">
          {/* Header */}
          <div className="neo-window-header">
            <div className="neo-window-dots">
              <span className="dot-red" />
              <span className="dot-yellow" />
              <span className="dot-green" />
            </div>
            <span className="neo-window-title font-mono">auth.register // new_profile</span>
            <span className="font-mono text-[10px] opacity-60">v3.5</span>
          </div>

          <div className="auth-window-body">
            <div className="auth-header-block">
              <h1 className="auth-title">Create DocuMind Account</h1>
              <p className="auth-subtitle">
                Join the local document intelligence workspace. Create custom categories, organize PDFs/DOCX, and query with grounded VLM models.
              </p>
            </div>

            {error && (
              <div className="auth-error-banner">
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label font-mono">FULL NAME</label>
                <div className="input-with-icon">
                  <User size={15} className="input-icon" />
                  <input
                    type="text"
                    className="neo-input"
                    placeholder="e.g. Saravana Priyan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label className="form-label font-mono">USERNAME</label>
                  <input
                    type="text"
                    className="neo-input"
                    placeholder="e.g. saravana"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label font-mono">EMAIL ADDRESS</label>
                  <input
                    type="email"
                    className="neo-input"
                    placeholder="name@college.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
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
                    placeholder="Choose a secure password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
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

              {/* Role Selection (2 Roles: User vs Admin) */}
              <div className="form-group">
                <label className="form-label font-mono">PRIMARY ROLE</label>
                <div className="role-selector-pills role-selector-2col">
                  <button
                    type="button"
                    className={`role-select-pill ${role === 'user' ? 'active-user' : ''}`}
                    onClick={() => setRole('user')}
                  >
                    <span className="font-bold">USER</span>
                    <span className="text-[10px] block opacity-70">Personal Library &amp; Grounded QA</span>
                  </button>

                  <button
                    type="button"
                    className={`role-select-pill ${role === 'admin' ? 'active-admin' : ''}`}
                    onClick={() => setRole('admin')}
                  >
                    <span className="font-bold">ADMIN</span>
                    <span className="text-[10px] block opacity-70">System Audit &amp; Hardware Management</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="neo-btn-primary auth-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span>Registering Account...</span>
                ) : (
                  <>
                    <span>Create My Account</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            <div className="auth-footer-links">
              <span>Already registered?</span>
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => onNavigate('login')}
              >
                Sign In to Account &rarr;
              </button>
            </div>
          </div>
        </div>

        {/* Local Security Guarantee */}
        <div className="auth-security-notice font-mono">
          <ShieldCheck size={14} className="text-lime-400 inline mr-1.5" />
          <span>Local MongoDB storage • No third-party analytics • Fully verifiable</span>
        </div>
      </div>
    </div>
  );
}
