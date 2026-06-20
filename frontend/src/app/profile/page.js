'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { api } from '@/lib/api';

const ROLE_LABELS = {
  ADMIN: 'Administrator',
  SALES_USER: 'Sales',
  PURCHASE_USER: 'Purchase',
  MFG_USER: 'Manufacturing',
  INVENTORY_MANAGER: 'Inventory Manager',
  BUSINESS_OWNER: 'Business Owner',
};

const ROLE_PERMISSIONS = {
  ADMIN: ['Full system access', 'User management', 'Audit logs', 'All modules'],
  SALES_USER: ['Sales Orders', 'Customers', 'Products (read)', 'Dashboard'],
  PURCHASE_USER: ['Purchase Orders', 'Vendors', 'Products (read)', 'Dashboard'],
  MFG_USER: ['Manufacturing Orders', 'Bills of Materials', 'Products (read)', 'Dashboard'],
  INVENTORY_MANAGER: ['Inventory & Stock', 'Stock Adjustments', 'All orders (read)', 'Dashboard'],
  BUSINESS_OWNER: ['Products', 'All modules (read)', 'Dashboard', 'Reports'],
};

export default function ProfilePage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwErrors, setPwErrors] = useState({});

  if (!user) return null;

  const initials = user.name
    ?.split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const roleLabel = ROLE_LABELS[user.role] || user.role;
  const permissions = ROLE_PERMISSIONS[user.role] || [];

  const validatePw = () => {
    const errs = {};
    if (!pwForm.currentPassword) errs.currentPassword = 'Current password is required';
    if (!pwForm.newPassword) errs.newPassword = 'New password is required';
    else if (pwForm.newPassword.length < 6) errs.newPassword = 'Must be at least 6 characters';
    if (pwForm.newPassword !== pwForm.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    return errs;
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const errs = validatePw();
    if (Object.keys(errs).length > 0) { setPwErrors(errs); return; }
    setPwErrors({});
    setPwLoading(true);
    try {
      await api.patch('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      addToast('Password changed successfully', 'success');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      addToast(err.message || 'Failed to change password', 'error');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Your account details and preferences</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>

        {/* Left: Identity card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Avatar + name card */}
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <div style={{
              width: 80, height: 80,
              borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', fontWeight: 800, color: 'white',
              margin: '0 auto var(--space-4)',
              boxShadow: '0 4px 20px rgba(216,90,48,0.35)',
            }}>
              {initials}
            </div>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>{user.name}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>{user.email}</p>

            <span className="badge badge-role" style={{
              background: 'var(--accent-subtle)',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              padding: '4px 14px',
              borderRadius: 'var(--radius-full)',
            }}>
              {roleLabel}
            </span>

            {user.phone && (
              <div style={{ marginTop: 'var(--space-4)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                📞 {user.phone}
              </div>
            )}
            {user.address && (
              <div style={{ marginTop: 'var(--space-2)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                📍 {user.address}
              </div>
            )}
          </div>

          {/* Account info card */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Account Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[
                { label: 'Full Name', value: user.name },
                { label: 'Email Address', value: user.email },
                { label: 'Role', value: roleLabel },
                { label: 'Status', value: user.status || 'ACTIVE' },
                { label: 'User ID', value: `#${user.id}` },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', padding: 'var(--space-2) 0',
                  borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{label}</span>
                  <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Permissions card */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Your Access</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-4)' }}>
              What you can access with the <strong style={{ color: 'var(--accent)' }}>{roleLabel}</strong> role
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {permissions.map((perm) => (
                <div key={perm} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                  fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
                }}>
                  <span style={{
                    width: 18, height: 18,
                    background: 'var(--success-bg)',
                    color: 'var(--success)',
                    borderRadius: 'var(--radius-full)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, flexShrink: 0,
                  }}>✓</span>
                  {perm}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Change password */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 'var(--space-2)' }}>Change Password</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
            Use a strong password with a mix of letters, numbers and symbols.
          </p>

          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter current password"
                value={pwForm.currentPassword}
                onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))}
              />
              {pwErrors.currentPassword && <span className="form-error">{pwErrors.currentPassword}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter new password"
                value={pwForm.newPassword}
                onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))}
              />
              {pwErrors.newPassword && <span className="form-error">{pwErrors.newPassword}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Re-enter new password"
                value={pwForm.confirmPassword}
                onChange={e => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))}
              />
              {pwErrors.confirmPassword && <span className="form-error">{pwErrors.confirmPassword}</span>}
            </div>

            <div style={{
              background: 'var(--warning-bg)',
              border: '1px solid var(--warning)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-4)',
              fontSize: 'var(--text-xs)',
              color: 'var(--warning-text)',
              marginTop: 'var(--space-2)',
            }}>
              ⚠️ Changing your password will sign you out of all other active sessions.
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={pwLoading}
              style={{ marginTop: 'var(--space-2)' }}
            >
              {pwLoading ? (
                <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Updating...</>
              ) : '🔑 Update Password'}
            </button>
          </form>
        </div>

      </div>
    </>
  );
}
