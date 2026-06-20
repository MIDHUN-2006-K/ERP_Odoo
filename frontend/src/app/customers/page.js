'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import DataTable from '@/components/ui/DataTable';
import { useToast } from '@/lib/toast-context';

export default function CustomersPage() {
  const { data: customers, isLoading, mutate } = useSWR('/customers', fetcher);
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);

  function openNew() { setEditItem(null); setForm({ name: '', email: '', phone: '', address: '' }); setShowForm(true); }
  function openEdit(row) { setEditItem(row); setForm({ name: row.name, email: row.email || '', phone: row.phone || '', address: row.address || '' }); setShowForm(true); }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true);
    try {
      if (editItem) { await api.patch(`/customers/${editItem.id}`, form); toast.success('Customer updated'); }
      else { await api.post('/customers', form); toast.success('Customer created'); }
      setShowForm(false); mutate();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  async function handleDelete(row) {
    if (!confirm(`Delete "${row.name}"?`)) return;
    try { await api.delete(`/customers/${row.id}`); toast.success('Customer deleted'); mutate(); } catch (err) { toast.error(err.message); }
  }

  if (isLoading) return <div className="loading-page"><div className="spinner" style={{width:32,height:32}}></div></div>;

  const columns = [
    { key: 'name', label: 'Name', render: (row) => <span style={{fontWeight:500,color:'var(--text-primary)'}}>{row.name}</span> },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address', render: (row) => <span style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'inline-block'}}>{row.address || '—'}</span> },
    { key: 'actions', label: '', render: (row) => (
      <div style={{display:'flex',gap:'var(--space-2)'}}>
        <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>Edit</button>
        <button className="btn btn-ghost btn-sm" style={{color:'var(--error-text)'}} onClick={(e) => { e.stopPropagation(); handleDelete(row); }}>Delete</button>
      </div>
    )},
  ];

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Customers</h1><p className="page-subtitle">{customers?.length || 0} customers</p></div>
        <button className="btn btn-primary" onClick={openNew}>+ New Customer</button>
      </div>
      <DataTable columns={columns} data={customers || []} searchPlaceholder="Search by name or email..." />

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:480}}>
            <h3 className="modal-title">{editItem ? 'Edit Customer' : 'New Customer'}</h3>
            <form onSubmit={handleSave} style={{display:'flex',flexDirection:'column',gap:'var(--space-4)'}}>
              <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} required autoFocus /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Address</label><textarea className="form-textarea" value={form.address} onChange={e => setForm(p => ({...p, address: e.target.value}))} rows={2} /></div>
              <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
