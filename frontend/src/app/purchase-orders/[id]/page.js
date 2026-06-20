'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { StatusBadge } from '@/components/ui/DataTable';

export default function PurchaseOrderFormPage() {
  const router = useRouter(); const params = useParams(); const toast = useToast();
  const isNew = params.id === 'new';
  const { data: order, mutate } = useSWR(isNew ? null : `/purchase-orders/${params.id}`, fetcher);
  const { data: vendors } = useSWR('/vendors', fetcher);
  const { data: products } = useSWR('/products', fetcher);
  const [form, setForm] = useState({ vendorId: '', lines: [{ productId: '', quantity: 1, unitCost: 0 }] });
  const [saving, setSaving] = useState(false); const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    if (order) setForm({ vendorId: order.vendorId || '', lines: order.lines?.map(l => ({ id: l.id, productId: l.productId, quantity: Number(l.quantity), unitCost: Number(l.unitCost), receivedQty: Number(l.receivedQty) })) || [] });
  }, [order]);

  function addLine() { setForm(prev => ({ ...prev, lines: [...prev.lines, { productId: '', quantity: 1, unitCost: 0 }] })); }
  function removeLine(idx) { setForm(prev => ({ ...prev, lines: prev.lines.filter((_, i) => i !== idx) })); }
  function updateLine(idx, field, value) {
    setForm(prev => { const lines = [...prev.lines]; lines[idx] = { ...lines[idx], [field]: value };
      if (field === 'productId' && products) { const p = products.find(p => p.id === Number(value)); if (p) lines[idx].unitCost = Number(p.costPrice); }
      return { ...prev, lines }; });
  }
  const grandTotal = form.lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);

  async function handleSave(e) {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { vendorId: Number(form.vendorId), lines: form.lines.map(l => ({ productId: Number(l.productId), quantity: Number(l.quantity), unitCost: Number(l.unitCost) })) };
      if (isNew) { const created = await api.post('/purchase-orders', payload); toast.success('PO created'); router.push(`/purchase-orders/${created.id}`); }
      else { await api.patch(`/purchase-orders/${params.id}`, payload); toast.success('PO updated'); mutate(); }
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  async function handleAction(action) {
    setActionLoading(action);
    try {
      if (action === 'confirm') { await api.post(`/purchase-orders/${params.id}/confirm`); toast.success('PO confirmed!'); }
      else if (action === 'cancel') { await api.post(`/purchase-orders/${params.id}/cancel`); toast.success('PO cancelled'); }
      else if (action === 'receive') {
        const lines = form.lines.filter(l => Number(l.quantity) > Number(l.receivedQty || 0)).map(l => ({ purchaseOrderLineId: l.id, quantity: Number(l.quantity) - Number(l.receivedQty || 0) }));
        if (lines.length === 0) { toast.warning('Nothing to receive'); return; }
        await api.post(`/purchase-orders/${params.id}/receive`, { lines }); toast.success('Goods received!');
      }
      mutate();
    } catch (err) { toast.error(err.message); } finally { setActionLoading(''); }
  }

  if (!isNew && !order) return <div className="loading-page"><div className="spinner" style={{width:32,height:32}}></div></div>;
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isNew ? 'New Purchase Order' : order?.orderNo}</h1>
          {!isNew && <div style={{display:'flex',alignItems:'center',gap:'var(--space-3)',marginTop:'var(--space-2)'}}><StatusBadge status={order?.status} /><span style={{fontSize:'var(--text-sm)',color:'var(--text-muted)'}}>by {order?.createdByUser?.name}</span></div>}
        </div>
        <div style={{display:'flex',gap:'var(--space-2)'}}>
          <button className="btn btn-ghost" onClick={() => router.push('/purchase-orders')}>← Back</button>
          {(isNew || order?.status === 'DRAFT') && <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>}
          {order?.status === 'DRAFT' && <button className="btn btn-success" onClick={() => handleAction('confirm')} disabled={!!actionLoading}>Confirm</button>}
          {['CONFIRMED','PARTIALLY_RECEIVED'].includes(order?.status) && <button className="btn btn-primary" onClick={() => handleAction('receive')} disabled={!!actionLoading}>Receive All</button>}
          {order?.status && !['FULLY_RECEIVED','CANCELLED'].includes(order?.status) && <button className="btn btn-danger" onClick={() => handleAction('cancel')} disabled={!!actionLoading}>Cancel</button>}
        </div>
      </div>
      <div className="card" style={{marginBottom:'var(--space-6)'}}>
        <h3 className="card-title" style={{marginBottom:'var(--space-4)'}}>Order Details</h3>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Vendor *</label>
            <select className="form-select" value={form.vendorId} onChange={e => setForm(p => ({...p, vendorId: e.target.value}))} disabled={order?.status && order.status !== 'DRAFT'} required>
              <option value="">Select vendor</option>{(vendors||[]).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select></div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><h3 className="card-title">Order Lines</h3>{(isNew || order?.status === 'DRAFT') && <button className="btn btn-ghost btn-sm" onClick={addLine}>+ Add Line</button>}</div>
        <table><thead><tr><th>Product</th><th>Ordered Qty</th>{!isNew && <th>Received</th>}<th>Unit Cost (₹)</th><th>Total (₹)</th>{(isNew || order?.status === 'DRAFT') && <th></th>}</tr></thead>
          <tbody>{form.lines.map((line, idx) => (
            <tr key={idx}>
              <td><select className="form-select" value={line.productId} onChange={e => updateLine(idx, 'productId', e.target.value)} disabled={order?.status && order.status !== 'DRAFT'} style={{minWidth:200}}>
                <option value="">Select product</option>{(products||[]).map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}</select></td>
              <td><input className="form-input" type="number" style={{width:100}} value={line.quantity} onChange={e => updateLine(idx, 'quantity', Number(e.target.value))} disabled={order?.status && order.status !== 'DRAFT'} min={1} /></td>
              {!isNew && <td style={{color:'var(--text-muted)'}}>{line.receivedQty || 0}</td>}
              <td><input className="form-input" type="number" style={{width:120}} value={line.unitCost} onChange={e => updateLine(idx, 'unitCost', Number(e.target.value))} disabled={order?.status && order.status !== 'DRAFT'} /></td>
              <td style={{fontWeight:600}}>₹{(line.quantity * line.unitCost).toLocaleString()}</td>
              {(isNew || order?.status === 'DRAFT') && <td><button className="btn btn-ghost btn-sm" onClick={() => removeLine(idx)} style={{color:'var(--error-text)'}}>✕</button></td>}
            </tr>))}
          </tbody>
          <tfoot><tr><td colSpan={isNew ? 3 : 4} style={{textAlign:'right',fontWeight:600}}>Grand Total</td><td style={{fontWeight:700,fontSize:'var(--text-lg)'}}>₹{grandTotal.toLocaleString()}</td>{(isNew || order?.status === 'DRAFT') && <td></td>}</tr></tfoot>
        </table>
      </div>
    </>
  );
}
