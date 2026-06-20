'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useToast } from '@/lib/toast-context';

const ROLES = ['ADMIN', 'SALES_USER', 'PURCHASE_USER', 'MFG_USER', 'INVENTORY_MANAGER', 'BUSINESS_OWNER'];
const ROLE_LABELS = {
  ADMIN: 'Admin', SALES_USER: 'Sales User', PURCHASE_USER: 'Purchase User',
  MFG_USER: 'Mfg User', INVENTORY_MANAGER: 'Inventory Manager', BUSINESS_OWNER: 'Business Owner',
};
const ROLE_COLORS = {
  ADMIN: '#D85A30', SALES_USER: '#1D9E75', PURCHASE_USER: '#BA7517',
  MFG_USER: '#6366f1', INVENTORY_MANAGER: '#0ea5e9', BUSINESS_OWNER: '#ec4899',
};

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 30) return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  return 'Just now';
}

function UserCard({ user, onEdit }) {
  const color = ROLE_COLORS[user.role] || '#888780';
  return (
    <div className="stock-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
        background: `${color}20`, border: `2px solid ${color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 800, color,
      }}>
        {user.name?.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.name}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{user.email}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          Last login: {timeAgo(user.lastLoginAt)}
        </div>
      </div>

      {/* Role + Status */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
          background: `${color}18`, color,
        }}>{ROLE_LABELS[user.role] || user.role}</span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
          background: user.status === 'ACTIVE' ? '#E1F5EE' : '#F7E8E8',
          color: user.status === 'ACTIVE' ? '#085041' : '#791F1F',
        }}>{user.status}</span>
      </div>

      {/* Edit button */}
      <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => onEdit(user)}>
        Edit
      </button>
    </div>
  );
}

const EMPTY_CREATE = { name: '', email: '', password: '', role: 'SALES_USER', phone: '' };

export default function UsersPage() {
  const { data: users, isLoading, mutate } = useSWR('/users', fetcher);
  const toast = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [saving, setSaving] = useState(false);

  const [editUser, setEditUser]   = useState(null);
  const [roleVal, setRoleVal]     = useState('');
  const [statusVal, setStatusVal] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [search, setSearch] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/users', createForm);
      toast.success(`User ${createForm.name} created`);
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE);
      mutate();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleUpdate() {
    setSaving(true);
    try {
      const payload = {};
      if (roleVal)    payload.role     = roleVal;
      if (statusVal)  payload.status   = statusVal;
      if (newPassword.trim()) payload.password = newPassword;
      await api.patch(`/users/${editUser.id}`, payload);
      toast.success('User updated');
      setEditUser(null); setNewPassword(''); mutate();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleDeactivate(user) {
    if (!confirm(`Deactivate ${user.name}?`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      toast.success(`${user.name} deactivated`);
      mutate();
    } catch (err) { toast.error(err.message); }
  }

  if (isLoading) return <div className="loading-page"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  const filtered = (users || []).filter(u =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const byRole = ROLES.map(r => ({ role: r, count: (users || []).filter(u => u.role === r).length })).filter(r => r.count > 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">{(users || []).length} users across {byRole.length} roles</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Create User
        </button>
      </div>

      {/* Role summary chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {byRole.map(r => (
          <div key={r.role} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
            background: `${ROLE_COLORS[r.role]}18`, color: ROLE_COLORS[r.role],
            border: `1px solid ${ROLE_COLORS[r.role]}30`,
          }}>
            {ROLE_LABELS[r.role]}
            <span style={{
              background: ROLE_COLORS[r.role], color: '#fff',
              borderRadius: 999, padding: '0 6px', fontSize: 10, fontWeight: 800,
            }}>{r.count}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          className="table-search"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 300 }}
        />
      </div>

      {/* User cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 12 }}>
        {filtered.map(u => (
          <UserCard key={u.id} user={u} onEdit={(user) => { setEditUser(user); setRoleVal(user.role); setStatusVal(user.status); setNewPassword(''); }} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="table-empty">No users found</div>
      )}

      {/* ── Create User Modal ── */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Create New User</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" required value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Raj Kumar" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={createForm.phone} onChange={e => setCreateForm(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input className="form-input" type="email" required value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} placeholder="raj@example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Temporary Password *</label>
                <input className="form-input" type="password" required minLength={6} value={createForm.password} onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-select" value={createForm.role} onChange={e => setCreateForm(p => ({ ...p, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Edit User: {editUser.name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={roleVal} onChange={e => setRoleVal(e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={statusVal} onChange={e => setStatusVal(e.target.value)}>
                  <option value="ACTIVE">Active</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Reset Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(leave blank to keep current)</span></label>
                <input className="form-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 6 chars)" />
              </div>
              <div className="form-actions">
                <button className="btn btn-ghost" style={{ color: '#E24B4A' }} onClick={() => handleDeactivate(editUser)}>Deactivate</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" onClick={() => setEditUser(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleUpdate} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
