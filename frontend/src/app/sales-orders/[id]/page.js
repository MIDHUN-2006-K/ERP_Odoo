'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { StatusBadge } from '@/components/ui/DataTable';

export default function SalesOrderFormPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const isNew = params.id === 'new';

  const { data: order, mutate } = useSWR(isNew ? null : `/sales-orders/${params.id}`, fetcher);
  const { data: customers } = useSWR('/customers', fetcher);
  const { data: products } = useSWR('/products', fetcher);

  const [form, setForm] = useState({ customerId: '', expectedDeliveryDate: '', lines: [{ productId: '', quantity: 1, unitPrice: 0 }] });
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    if (order) {
      setForm({
        customerId: order.customerId || '',
        expectedDeliveryDate: order.expectedDeliveryDate ? order.expectedDeliveryDate.split('T')[0] : '',
        lines: order.lines?.map(l => ({ id: l.id, productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), deliveredQty: Number(l.deliveredQty) })) || [],
      });
    }
  }, [order]);

  function addLine() { setForm(prev => ({ ...prev, lines: [...prev.lines, { productId: '', quantity: 1, unitPrice: 0 }] })); }
  function removeLine(idx) { setForm(prev => ({ ...prev, lines: prev.lines.filter((_, i) => i !== idx) })); }
  function updateLine(idx, field, value) {
    setForm(prev => {
      const lines = [...prev.lines];
      lines[idx] = { ...lines[idx], [field]: value };
      if (field === 'productId' && products) {
        const p = products.find(p => p.id === Number(value));
        if (p) lines[idx].unitPrice = Number(p.salesPrice);
      }
      return { ...prev, lines };
    });
  }

  const grandTotal = form.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { customerId: Number(form.customerId), expectedDeliveryDate: form.expectedDeliveryDate || null, lines: form.lines.map(l => ({ productId: Number(l.productId), quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })) };
      if (isNew) { const created = await api.post('/sales-orders', payload); toast.success('Sales Order created'); router.push(`/sales-orders/${created.id}`); }
      else { await api.patch(`/sales-orders/${params.id}`, payload); toast.success('Sales Order updated'); mutate(); }
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  async function handleAction(action) {
    setActionLoading(action);
    try {
      if (action === 'confirm') { await api.post(`/sales-orders/${params.id}/confirm`); toast.success('Order confirmed!'); }
      else if (action === 'cancel') { await api.post(`/sales-orders/${params.id}/cancel`); toast.success('Order cancelled'); }
      else if (action === 'deliver') {
        const lines = form.lines.filter(l => Number(l.quantity) > Number(l.deliveredQty || 0)).map(l => ({
          salesOrderLineId: l.id, quantity: Number(l.quantity) - Number(l.deliveredQty || 0),
        }));
        if (lines.length === 0) { toast.warning('Nothing to deliver'); return; }
        await api.post(`/sales-orders/${params.id}/deliver`, { lines });
        toast.success('Delivery created!');
      }
      mutate();
    } catch (err) { toast.error(err.message); } finally { setActionLoading(''); }
  }

  if (!isNew && !order) return <div className="loading-page"><div className="spinner" style={{width:32,height:32}}></div></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isNew ? 'New Sales Order' : `${order?.orderNo}`}</h1>
          {!isNew && <div style={{display:'flex',alignItems:'center',gap:'var(--space-3)',marginTop:'var(--space-2)'}}>
            <StatusBadge status={order?.status} />
            <span style={{fontSize:'var(--text-sm)',color:'var(--text-muted)'}}>Created by {order?.createdByUser?.name}</span>
          </div>}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-ghost" onClick={() => router.push('/sales-orders')}>← Back</button>
          {(isNew || order?.status === 'DRAFT') && <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>}
          {order?.status === 'DRAFT' && <button className="btn btn-success" onClick={() => handleAction('confirm')} disabled={!!actionLoading}>{actionLoading === 'confirm' ? 'Confirming...' : 'Confirm'}</button>}
          {['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(order?.status) && <button className="btn btn-primary" onClick={() => handleAction('deliver')} disabled={!!actionLoading}>{actionLoading === 'deliver' ? 'Delivering...' : 'Deliver All'}</button>}
          {order?.status && !['FULLY_DELIVERED', 'CANCELLED'].includes(order?.status) && <button className="btn btn-danger" onClick={() => handleAction('cancel')} disabled={!!actionLoading}>Cancel</button>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Order Details</h3>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Customer *</label>
            <select className="form-select" value={form.customerId} onChange={e => setForm(prev => ({ ...prev, customerId: e.target.value }))} disabled={order?.status && order.status !== 'DRAFT'} required>
              <option value="">Select customer</option>
              {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Expected Delivery Date</label>
            <input className="form-input" type="date" value={form.expectedDeliveryDate} onChange={e => setForm(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))} disabled={order?.status && order.status !== 'DRAFT'} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Order Lines</h3>
          {(isNew || order?.status === 'DRAFT') && <button className="btn btn-ghost btn-sm" onClick={addLine}>+ Add Line</button>}
        </div>
        <table>
          <thead><tr><th>Product</th><th>Ordered Qty</th>{!isNew && <th>Delivered</th>}<th>Unit Price (₹)</th><th>Total (₹)</th>{(isNew || order?.status === 'DRAFT') && <th></th>}</tr></thead>
          <tbody>
            {form.lines.map((line, idx) => (
              <tr key={idx}>
                <td>
                  <select className="form-select" value={line.productId} onChange={e => updateLine(idx, 'productId', e.target.value)} disabled={order?.status && order.status !== 'DRAFT'} style={{minWidth:200}}>
                    <option value="">Select product</option>
                    {(products || []).map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </td>
                <td><input className="form-input" type="number" style={{width:100}} value={line.quantity} onChange={e => updateLine(idx, 'quantity', Number(e.target.value))} disabled={order?.status && order.status !== 'DRAFT'} min={1} /></td>
                {!isNew && <td style={{color:'var(--text-muted)'}}>{line.deliveredQty || 0}</td>}
                <td><input className="form-input" type="number" style={{width:120}} value={line.unitPrice} onChange={e => updateLine(idx, 'unitPrice', Number(e.target.value))} disabled={order?.status && order.status !== 'DRAFT'} /></td>
                <td style={{fontWeight:600}}>₹{(line.quantity * line.unitPrice).toLocaleString()}</td>
                {(isNew || order?.status === 'DRAFT') && <td><button className="btn btn-ghost btn-sm" onClick={() => removeLine(idx)} style={{color:'var(--error-text)'}}>✕</button></td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={isNew ? 3 : 4} style={{textAlign:'right',fontWeight:600}}>Grand Total</td><td style={{fontWeight:700,fontSize:'var(--text-lg)'}}>₹{grandTotal.toLocaleString()}</td>{(isNew || order?.status === 'DRAFT') && <td></td>}</tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
