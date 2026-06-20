'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useToast } from '@/lib/toast-context';

export default function ProductFormPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const isNew = params.id === 'new';
  const { data: product, isLoading } = useSWR(isNew ? null : `/products/${params.id}`, fetcher);
  const { data: vendors } = useSWR('/vendors', fetcher);

  const [form, setForm] = useState({
    sku: '', name: '', category: '', uom: 'UNIT',
    salesPrice: 0, costPrice: 0,
    procurementStrategy: 'MTS', procureOnDemand: false,
    procurementType: '', defaultVendorId: '', reorderPoint: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        sku: product.sku || '',
        name: product.name || '',
        category: product.category || '',
        uom: product.uom || 'UNIT',
        salesPrice: Number(product.salesPrice) || 0,
        costPrice: Number(product.costPrice) || 0,
        procurementStrategy: product.procurementStrategy || 'MTS',
        procureOnDemand: product.procureOnDemand || false,
        procurementType: product.procurementType || '',
        defaultVendorId: product.defaultVendorId || '',
        reorderPoint: Number(product.reorderPoint) || 0,
      });
    }
  }, [product]);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        salesPrice: Number(form.salesPrice),
        costPrice: Number(form.costPrice),
        reorderPoint: Number(form.reorderPoint),
        defaultVendorId: form.defaultVendorId ? Number(form.defaultVendorId) : null,
        procurementType: form.procurementType || null,
      };

      if (isNew) {
        await api.post('/products', payload);
        toast.success('Product created');
      } else {
        await api.patch(`/products/${params.id}`, payload);
        toast.success('Product updated');
      }
      router.push('/products');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && isLoading) return <div className="loading-page"><div className="spinner" style={{width:32,height:32}}></div></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isNew ? 'New Product' : `Edit: ${product?.name}`}</h1>
          <p className="page-subtitle">{isNew ? 'Add a new product to the catalog' : `SKU: ${product?.sku}`}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="btn btn-ghost" onClick={() => router.push('/products')}>← Back</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Basic Information</h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">SKU *</label>
              <input className="form-input" value={form.sku} onChange={e => handleChange('sku', e.target.value)} required disabled={!isNew} />
            </div>
            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input className="form-input" value={form.name} onChange={e => handleChange('name', e.target.value)} required />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={e => handleChange('category', e.target.value)}>
                <option value="">Select category</option>
                <option value="Finished Good">Finished Good</option>
                <option value="Component">Component</option>
                <option value="Raw Material">Raw Material</option>
                <option value="Consumable">Consumable</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Unit of Measure</label>
              <select className="form-select" value={form.uom} onChange={e => handleChange('uom', e.target.value)}>
                <option value="UNIT">Unit</option>
                <option value="PCS">Pieces</option>
                <option value="KG">Kilogram</option>
                <option value="LITRE">Litre</option>
                <option value="PACK">Pack</option>
                <option value="METRE">Metre</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Pricing</h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Sales Price (₹)</label>
              <input className="form-input" type="number" step="0.01" value={form.salesPrice} onChange={e => handleChange('salesPrice', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Cost Price (₹)</label>
              <input className="form-input" type="number" step="0.01" value={form.costPrice} onChange={e => handleChange('costPrice', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Procurement</h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Strategy</label>
              <select className="form-select" value={form.procurementStrategy} onChange={e => handleChange('procurementStrategy', e.target.value)}>
                <option value="MTS">Make to Stock (MTS)</option>
                <option value="MTO">Make to Order (MTO)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Procure on Demand</label>
              <select className="form-select" value={form.procureOnDemand ? 'true' : 'false'} onChange={e => handleChange('procureOnDemand', e.target.value === 'true')}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
          </div>
          <div className="form-row" style={{ marginTop: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Procurement Type</label>
              <select className="form-select" value={form.procurementType} onChange={e => handleChange('procurementType', e.target.value)}>
                <option value="">Not applicable</option>
                <option value="PURCHASE">Purchase</option>
                <option value="MANUFACTURING">Manufacturing</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Default Vendor</label>
              <select className="form-select" value={form.defaultVendorId} onChange={e => handleChange('defaultVendorId', e.target.value)}>
                <option value="">No default vendor</option>
                {(vendors || []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row" style={{ marginTop: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Reorder Point</label>
              <input className="form-input" type="number" value={form.reorderPoint} onChange={e => handleChange('reorderPoint', e.target.value)} />
            </div>
          </div>
        </div>

        {!isNew && product && (
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Stock Information</h3>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="stat-card info">
                <div className="stat-value">{Number(product.onHandQty)}</div>
                <div className="stat-label">On Hand Qty</div>
              </div>
              <div className="stat-card warning">
                <div className="stat-value">{Number(product.reservedQty)}</div>
                <div className="stat-label">Reserved Qty</div>
              </div>
              <div className="stat-card success">
                <div className="stat-value">{product.freeToUseQty}</div>
                <div className="stat-label">Free to Use Qty</div>
              </div>
            </div>
          </div>
        )}
      </form>
    </>
  );
}
