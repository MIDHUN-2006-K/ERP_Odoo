'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import DataTable from '@/components/ui/DataTable';
import { useToast } from '@/lib/toast-context';

export default function InventoryPage() {
  const [tab, setTab] = useState('stock');
  const { data: stock, isLoading: stockLoading } = useSWR('/inventory/current-stock', fetcher);
  const { data: ledger, isLoading: ledgerLoading } = useSWR('/inventory/stock-ledger', fetcher);
  const toast = useToast();
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjForm, setAdjForm] = useState({ productId: '', quantity: 0, reason: '' });
  const [saving, setSaving] = useState(false);

  async function handleAdjust(e) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/inventory/adjust', { productId: Number(adjForm.productId), quantity: Number(adjForm.quantity), reason: adjForm.reason });
      toast.success('Stock adjusted');
      setShowAdjust(false);
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  const stockColumns = [
    { key: 'sku', label: 'SKU', render: (row) => <span style={{fontFamily:'var(--font-mono)',fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{row.sku}</span> },
    { key: 'name', label: 'Product', render: (row) => <span style={{fontWeight:500,color:'var(--text-primary)'}}>{row.name}</span> },
    { key: 'category', label: 'Category' },
    { key: 'uom', label: 'UoM' },
    { key: 'onHandQty', label: 'On Hand', render: (row) => <span style={{fontWeight:600}}>{Number(row.onHandQty)}</span> },
    { key: 'reservedQty', label: 'Reserved', render: (row) => Number(row.reservedQty) },
    { key: 'freeToUseQty', label: 'Free to Use', render: (row) => {
      const free = Number(row.freeToUseQty);
      return <span style={{fontWeight:600,color: free <= 0 ? 'var(--error-text)' : free < 10 ? 'var(--warning-text)' : 'var(--success-text)'}}>{free}</span>;
    }},
  ];

  const ledgerColumns = [
    { key: 'createdAt', label: 'Date/Time', render: (row) => new Date(row.createdAt).toLocaleString() },
    { key: 'product', label: 'Product', render: (row) => <span style={{fontWeight:500,color:'var(--text-primary)'}}>{row.product?.name}</span> },
    { key: 'movementType', label: 'Type', render: (row) => <span className="badge badge-info">{row.movementType?.replace(/_/g, ' ')}</span> },
    { key: 'quantity', label: 'Qty', render: (row) => {
      const qty = Number(row.quantity);
      return <span style={{fontWeight:600,color: qty > 0 ? 'var(--success-text)' : 'var(--error-text)'}}>{qty > 0 ? '+' : ''}{qty}</span>;
    }},
    { key: 'balanceAfter', label: 'Balance After', render: (row) => <span style={{fontWeight:600}}>{Number(row.balanceAfter)}</span> },
    { key: 'referenceType', label: 'Reference', render: (row) => <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{row.referenceType} #{row.referenceId}</span> },
    { key: 'user', label: 'By', render: (row) => row.createdByUser?.name || '—' },
  ];

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Inventory</h1><p className="page-subtitle">Stock levels & movement ledger</p></div>
        <button className="btn btn-primary" onClick={() => setShowAdjust(true)}>⚖️ Stock Adjustment</button>
      </div>

      <div className="filter-pills" style={{ marginBottom: 'var(--space-4)' }}>
        <button className={`filter-pill ${tab === 'stock' ? 'active' : ''}`} onClick={() => setTab('stock')}>Current Stock</button>
        <button className={`filter-pill ${tab === 'ledger' ? 'active' : ''}`} onClick={() => setTab('ledger')}>Stock Ledger</button>
      </div>

      {tab === 'stock' ? (
        stockLoading ? <div className="loading-page"><div className="spinner" style={{width:32,height:32}}></div></div> :
        <DataTable columns={stockColumns} data={stock || []} searchPlaceholder="Search products..." />
      ) : (
        ledgerLoading ? <div className="loading-page"><div className="spinner" style={{width:32,height:32}}></div></div> :
        <DataTable columns={ledgerColumns} data={ledger || []} searchPlaceholder="Search movements..." emptyMessage="No stock movements recorded" />
      )}

      {showAdjust && (
        <div className="modal-overlay" onClick={() => setShowAdjust(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Stock Adjustment</h3>
            <form onSubmit={handleAdjust} style={{display:'flex',flexDirection:'column',gap:'var(--space-4)'}}>
              <div className="form-group"><label className="form-label">Product *</label>
                <select className="form-select" value={adjForm.productId} onChange={e => setAdjForm(p => ({...p, productId: e.target.value}))} required>
                  <option value="">Select product</option>{(stock || []).map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku}) — On Hand: {Number(p.onHandQty)}</option>)}
                </select></div>
              <div className="form-group"><label className="form-label">Quantity (positive to add, negative to subtract) *</label>
                <input className="form-input" type="number" value={adjForm.quantity} onChange={e => setAdjForm(p => ({...p, quantity: e.target.value}))} required /></div>
              <div className="form-group"><label className="form-label">Reason *</label>
                <textarea className="form-textarea" value={adjForm.reason} onChange={e => setAdjForm(p => ({...p, reason: e.target.value}))} required rows={2} placeholder="e.g. Physical count adjustment, damaged goods" /></div>
              <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={() => setShowAdjust(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adjusting...' : 'Submit Adjustment'}</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
