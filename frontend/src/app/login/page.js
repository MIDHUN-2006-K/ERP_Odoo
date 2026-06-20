'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(loginId, password);
      toast.success('Welcome back!');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">S</div>
          <div className="login-logo-text">Shiv Furniture</div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <h2 style={{ textAlign: 'center', fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            Sign In
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
            Enter your credentials to access the ERP system
          </p>

          {error && (
            <div style={{
              background: 'var(--error-subtle)',
              color: 'var(--error-text)',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
            }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="loginId">Email Address</label>
            <input
              id="loginId"
              type="text"
              className="form-input"
              placeholder="you@shivfurniture.com"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={loading}
          >
            {loading ? (
              <><div className="spinner" style={{ width: 16, height: 16 }}></div> Signing In...</>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="login-footer">
          Don&apos;t have an account?{' '}
          <Link href="/signup">Sign Up</Link>
        </div>
      </div>
    </div>
  );
}
