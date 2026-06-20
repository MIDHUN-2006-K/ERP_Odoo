'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import DataTable, { StatusBadge } from '@/components/ui/DataTable';
import { useToast } from '@/lib/toast-context';

const ROLES = ['ADMIN', 'SALES_USER', 'PURCHASE_USER', 'MFG_USER', 'INVENTORY_MANAGER', 'BUSINESS_OWNER'];

export default function UsersPage() {
  const { data: users, isLoading, mutate } = useSWR('/users', fetcher);
  const toast = useToast();
  const [editUser, setEditUser] = useState(null);
  const [roleVal, setRoleVal] = useState('');
  const [statusVal, setStatusVal] = useState('');

  async function handleUpdate() {
    try {
      const payload = {};
      if (roleVal) payload.role = roleVal;
      if (statusVal) payload.status = statusVal;
      await api.patch(`/users/${editUser.id}`, payload);
      toast.success('User updated');
      setEditUser(null); mutate();
    } catch (err) { toast.error(err.message); }
  }

  if (isLoading) return <div className="loading-page"><div className="spinner" style={{width:32,height:32}}></div></div>;

  const columns = [
    { key: 'name', label: 'Name', render: (row) => <span style={{fontWeight:500,color:'var(--text-primary)'}}>{row.name}</span> },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (row) => <span className="badge badge-info">{row.role?.replace(/_/g, ' ')}</span> },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'lastLoginAt', label: 'Last Login', render: (row) => row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString() : 'Never' },
    { key: 'actions', label: '', render: (row) => <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setEditUser(row); setRoleVal(row.role); setStatusVal(row.status); }}>Edit Role</button> },
  ];

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">User Management</h1><p className="page-subtitle">{users?.length || 0} users</p></div>
      </div>
      <DataTable columns={columns} data={users || []} searchPlaceholder="Search users..." />

      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Edit User: {editUser.name}</h3>
            <div style={{display:'flex',flexDirection:'column',gap:'var(--space-4)'}}>
              <div className="form-group"><label className="form-label">Role</label>
                <select className="form-select" value={roleVal} onChange={e => setRoleVal(e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select></div>
              <div className="form-group"><label className="form-label">Status</label>
                <select className="form-select" value={statusVal} onChange={e => setStatusVal(e.target.value)}>
                  <option value="ACTIVE">Active</option><option value="DISABLED">Disabled</option>
                </select></div>
              <div className="form-actions"><button className="btn btn-ghost" onClick={() => setEditUser(null)}>Cancel</button><button className="btn btn-primary" onClick={handleUpdate}>Update</button></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
