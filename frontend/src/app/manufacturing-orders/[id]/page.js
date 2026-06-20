'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { StatusBadge } from '@/components/ui/DataTable';

export default function ManufacturingOrderFormPage() {
  const router = useRouter(); const params = useParams(); const toast = useToast();
  const isNew = params.id === 'new';
  const { data: order, mutate } = useSWR(isNew ? null : `/manufacturing-orders/${params.id}`, fetcher);
  const { data: products } = useSWR('/products', fetcher);
  const { data: boms } = useSWR('/boms', fetcher);
  const [form, setForm] = useState({ productId: '', bomId: '', quantity: 1, scheduledDate: '' });
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    if (order) setForm({ productId: order.productId || '', bomId: order.bomId || '', quantity: Number(order.quantity) || 1, scheduledDate: order.scheduledDate ? order.scheduledDate.split('T')[0] : '' });
  }, [order]);

  // Filter BoMs by selected product
  const filteredBoms = (boms || []).filter(b => !form.productId || b.productId === Number(form.productId));

  async function handleSave(e) {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { productId: Number(form.productId), bomId: Number(form.bomId), quantity: Number(form.quantity), scheduledDate: form.scheduledDate || null };
      const created = await api.post('/manufacturing-orders', payload);
      toast.success('Manufacturing Order created');
      router.push(`/manufacturing-orders/${created.id}`);
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  async function handleAction(action, woId) {
    setActionLoading(action + (woId || ''));
    try {
      if (action === 'confirm') { await api.post(`/manufacturing-orders/${params.id}/confirm`); toast.success('MO confirmed!'); }
      else if (action === 'cancel') { await api.post(`/manufacturing-orders/${params.id}/cancel`); toast.success('MO cancelled'); }
      else if (action === 'startWO') { await api.post(`/manufacturing-orders/${params.id}/work-orders/${woId}/start`); toast.success('Work order started!'); }
      else if (action === 'completeWO') { await api.post(`/manufacturing-orders/${params.id}/work-orders/${woId}/complete`); toast.success('Work order completed!'); }
      mutate();
    } catch (err) { toast.error(err.message); } finally { setActionLoading(''); }
  }

  if (!isNew && !order) return <div className="loading-page"><div className="spinner" style={{width:32,height:32}}></div></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isNew ? 'New Manufacturing Order' : order?.orderNo}</h1>
          {!isNew && <div style={{display:'flex',alignItems:'center',gap:'var(--space-3)',marginTop:'var(--space-2)'}}>
            <StatusBadge status={order?.status} />
            <span style={{fontSize:'var(--text-sm)',color:'var(--text-muted)'}}>Product: {order?.product?.name}</span>
          </div>}
        </div>
        <div style={{display:'flex',gap:'var(--space-2)'}}>
          <button className="btn btn-ghost" onClick={() => router.push('/manufacturing-orders')}>← Back</button>
          {isNew && <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Create MO'}</button>}
          {order?.status === 'DRAFT' && <button className="btn btn-success" onClick={() => handleAction('confirm')} disabled={!!actionLoading}>Confirm</button>}
          {order?.status && !['DONE','CANCELLED'].includes(order?.status) && <button className="btn btn-danger" onClick={() => handleAction('cancel')} disabled={!!actionLoading}>Cancel</button>}
        </div>
      </div>

      {isNew ? (
        <div className="card">
          <h3 className="card-title" style={{marginBottom:'var(--space-4)'}}>Manufacturing Details</h3>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Product *</label>
              <select className="form-select" value={form.productId} onChange={e => setForm(p => ({...p, productId: e.target.value, bomId: ''}))} required>
                <option value="">Select product</option>{(products||[]).filter(p => p.category === 'Finished Good').map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">Bill of Materials *</label>
              <select className="form-select" value={form.bomId} onChange={e => setForm(p => ({...p, bomId: e.target.value}))} required>
                <option value="">Select BoM</option>{filteredBoms.map(b => <option key={b.id} value={b.id}>v{b.version} ({b.status})</option>)}
              </select></div>
          </div>
          <div className="form-row" style={{marginTop:'var(--space-4)'}}>
            <div className="form-group"><label className="form-label">Quantity *</label>
              <input className="form-input" type="number" value={form.quantity} onChange={e => setForm(p => ({...p, quantity: Number(e.target.value)}))} min={1} required /></div>
            <div className="form-group"><label className="form-label">Scheduled Date</label>
              <input className="form-input" type="date" value={form.scheduledDate} onChange={e => setForm(p => ({...p, scheduledDate: e.target.value}))} /></div>
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{marginBottom:'var(--space-6)'}}>
            <h3 className="card-title" style={{marginBottom:'var(--space-4)'}}>Components Required</h3>
            <table><thead><tr><th>Component</th><th>SKU</th><th>Required Qty</th><th>Consumed Qty</th><th>On Hand</th><th>Free</th></tr></thead>
              <tbody>{(order?.components || []).map(c => (
                <tr key={c.id}>
                  <td style={{fontWeight:500,color:'var(--text-primary)'}}>{c.product?.name}</td>
                  <td style={{fontFamily:'var(--font-mono)',fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{c.product?.sku}</td>
                  <td style={{fontWeight:600}}>{Number(c.requiredQty)}</td>
                  <td>{Number(c.consumedQty)}</td>
                  <td>{Number(c.product?.onHandQty)}</td>
                  <td style={{color: (Number(c.product?.onHandQty) - Number(c.product?.reservedQty)) < Number(c.requiredQty) ? 'var(--error-text)' : 'var(--success-text)', fontWeight:600}}>
                    {Number(c.product?.onHandQty) - Number(c.product?.reservedQty)}
                  </td>
                </tr>))}
              </tbody></table>
          </div>

          <div className="card">
            <h3 className="card-title" style={{marginBottom:'var(--space-4)'}}>Work Orders</h3>
            <table><thead><tr><th>#</th><th>Operation</th><th>Work Center</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{(order?.workOrders || []).map(wo => (
                <tr key={wo.id}>
                  <td>{wo.sequence}</td>
                  <td style={{fontWeight:500,color:'var(--text-primary)'}}>{wo.operationName}</td>
                  <td>{wo.workCenter?.name || '—'}</td>
                  <td>{wo.durationMinutes} min</td>
                  <td><StatusBadge status={wo.status === 'PENDING' ? 'DRAFT' : wo.status} /></td>
                  <td>
                    {wo.status === 'PENDING' && ['CONFIRMED','IN_PROGRESS'].includes(order?.status) &&
                      <button className="btn btn-primary btn-sm" onClick={() => handleAction('startWO', wo.id)} disabled={!!actionLoading}>▶ Start</button>}
                    {wo.status === 'IN_PROGRESS' &&
                      <button className="btn btn-success btn-sm" onClick={() => handleAction('completeWO', wo.id)} disabled={!!actionLoading}>✓ Complete</button>}
                    {wo.status === 'DONE' && <span style={{color:'var(--success-text)',fontSize:'var(--text-sm)'}}>✓ Done</span>}
                  </td>
                </tr>))}
              </tbody></table>
          </div>
        </>
      )}
    </>
  );
}
