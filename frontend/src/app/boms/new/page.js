'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useToast } from '@/lib/toast-context';
import Link from 'next/link';

const EMPTY_COMPONENT = { componentProductId: '', quantityPerUnit: 1 };
const EMPTY_OPERATION = { sequence: 1, operationName: '', workCenterId: '', durationMinutes: 30 };

const CATEGORY_LABELS = {
  RAW_MATERIAL: 'Raw Material', COMPONENT: 'Component',
  CONSUMABLE: 'Consumable', FINISHED_GOOD: 'Finished Good',
};

function BomTree({ components, products }) {
  if (!components || components.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>No components added yet</div>;
  }
  return (
    <div className="bom-tree">
      {components.map((comp, i) => {
        const product = products?.find(p => String(p.id) === String(comp.componentProductId));
        return (
          <div key={i} className="bom-tree-row">
            <span className="bom-tree-icon">├─</span>
            <span className="bom-tree-name">{product?.name || '—'}</span>
            <span className="bom-tree-qty">× {comp.quantityPerUnit}</span>
            {product?.uom && <span className="bom-tree-uom">{product.uom}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function NewBomPage() {
  const router = useRouter();
  const toast  = useToast();
  const { data: products } = useSWR('/products', fetcher);
  const { data: workCenters } = useSWR('/work-centers', fetcher);

  const [productId, setProductId] = useState('');
  const [components, setComponents] = useState([{ ...EMPTY_COMPONENT }]);
  const [operations, setOperations] = useState([]);
  const [saving, setSaving] = useState(false);

  function addComponent() { setComponents(c => [...c, { ...EMPTY_COMPONENT }]); }
  function removeComponent(i) { setComponents(c => c.filter((_, idx) => idx !== i)); }
  function updateComponent(i, field, value) {
    setComponents(c => c.map((comp, idx) => idx === i ? { ...comp, [field]: value } : comp));
  }

  function addOperation() {
    setOperations(o => [...o, { ...EMPTY_OPERATION, sequence: o.length + 1 }]);
  }
  function removeOperation(i) { setOperations(o => o.filter((_, idx) => idx !== i)); }
  function updateOperation(i, field, value) {
    setOperations(o => o.map((op, idx) => idx === i ? { ...op, [field]: value } : op));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!productId) { toast.error('Select a product'); return; }
    if (components.length === 0 || !components[0].componentProductId) {
      toast.error('Add at least one component'); return;
    }

    setSaving(true);
    try {
      const validComponents = components.filter(c => c.componentProductId);
      const validOperations = operations.filter(op => op.operationName && op.workCenterId);

      const bom = await api.post('/boms', {
        productId: Number(productId),
        components: validComponents.map(c => ({
          componentProductId: Number(c.componentProductId),
          quantityPerUnit:    Number(c.quantityPerUnit),
        })),
        operations: validOperations.map(op => ({
          sequence:       Number(op.sequence),
          operationName:  op.operationName,
          workCenterId:   Number(op.workCenterId),
          durationMinutes:Number(op.durationMinutes),
        })),
      });
      toast.success('BoM created successfully');
      router.push(`/boms/${bom.id}`);
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  const productList  = Array.isArray(products) ? products : [];
  const wcList       = Array.isArray(workCenters) ? workCenters : [];
  const selectedProd = productList.find(p => String(p.id) === String(productId));

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">New Bill of Materials</h1>
          <p className="page-subtitle">Define components and operations for a manufactured product</p>
        </div>
        <Link href="/boms" className="btn btn-ghost">← Back to BoMs</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* Left: Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Product selection */}
          <div className="chart-panel">
            <div className="chart-panel-title" style={{ marginBottom: 12 }}>Finished Product</div>
            <div className="form-group">
              <label className="form-label">Product *</label>
              <select className="form-select" value={productId} onChange={e => setProductId(e.target.value)} required>
                <option value="">Select product...</option>
                {productList.filter(p => p.procurementType === 'MANUFACTURING' || !p.procurementType).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
              {selectedProd && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  Procurement: <strong>{selectedProd.procurementType || 'Not set'}</strong>
                  {selectedProd.category && <> · Category: <strong>{CATEGORY_LABELS[selectedProd.category] || selectedProd.category}</strong></>}
                </div>
              )}
            </div>
          </div>

          {/* Components */}
          <div className="chart-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div className="chart-panel-title">Components</div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addComponent}>+ Add Component</button>
            </div>

            {components.map((comp, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 36px', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  {i === 0 && <label className="form-label">Component Product</label>}
                  <select
                    className="form-select"
                    value={comp.componentProductId}
                    onChange={e => updateComponent(i, 'componentProductId', e.target.value)}
                  >
                    <option value="">Select component...</option>
                    {productList.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  {i === 0 && <label className="form-label">Qty per Unit</label>}
                  <input
                    className="form-input"
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={comp.quantityPerUnit}
                    onChange={e => updateComponent(i, 'quantityPerUnit', e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeComponent(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E24B4A', fontSize: 18, paddingBottom: 4 }}
                  title="Remove"
                >×</button>
              </div>
            ))}
          </div>

          {/* Operations */}
          <div className="chart-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div className="chart-panel-title">Operations</div>
                <div className="chart-panel-subtitle">Optional — define manufacturing work orders</div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addOperation}>+ Add Operation</button>
            </div>

            {operations.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No operations defined (optional)
              </div>
            )}

            {operations.map((op, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 36px', gap: 8, marginBottom: 10, alignItems: 'end' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  {i === 0 && <label className="form-label">Operation Name</label>}
                  <input className="form-input" placeholder="e.g. Assembly" value={op.operationName} onChange={e => updateOperation(i, 'operationName', e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  {i === 0 && <label className="form-label">Work Center</label>}
                  <select className="form-select" value={op.workCenterId} onChange={e => updateOperation(i, 'workCenterId', e.target.value)}>
                    <option value="">Select...</option>
                    {wcList.map(wc => <option key={wc.id} value={wc.id}>{wc.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  {i === 0 && <label className="form-label">Duration (min)</label>}
                  <input className="form-input" type="number" min="1" value={op.durationMinutes} onChange={e => updateOperation(i, 'durationMinutes', e.target.value)} />
                </div>
                <button type="button" onClick={() => removeOperation(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E24B4A', fontSize: 18, paddingBottom: 4 }}>×</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Link href="/boms" className="btn btn-ghost">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create BoM'}
            </button>
          </div>
        </form>

        {/* Right: Live tree preview */}
        <div className="chart-panel" style={{ position: 'sticky', top: 80 }}>
          <div className="chart-panel-title">Preview</div>
          <div className="chart-panel-subtitle" style={{ marginBottom: 12 }}>
            {selectedProd ? selectedProd.name : 'Select a product'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            {selectedProd && `┌─ ${selectedProd.name}`}
          </div>
          <BomTree components={components} products={productList} />
          {operations.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Operations</div>
              {operations.map((op, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '2px 0' }}>
                  {i + 1}. {op.operationName || '—'} {op.durationMinutes ? `(${op.durationMinutes} min)` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
