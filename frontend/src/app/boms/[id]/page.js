'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { StatusBadge } from '@/components/ui/DataTable';

export default function BomFormPage() {
  const router = useRouter(); const params = useParams(); const toast = useToast();
  const isNew = params.id === 'new';
  const { data: bom, mutate } = useSWR(isNew ? null : `/boms/${params.id}`, fetcher);
  const { data: products } = useSWR('/products', fetcher);
  const { data: workCentersRaw } = useSWR('/products', fetcher); // We'll need a work center endpoint

  const [form, setForm] = useState({ productId: '', components: [{ componentProductId: '', quantityPerUnit: 1 }], operations: [{ sequence: 1, operationName: '', workCenterId: '', durationMinutes: 30 }] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bom) setForm({
      productId: bom.productId || '',
      components: (bom.components || []).map(c => ({ componentProductId: c.componentProduct?.id || c.componentProductId, quantityPerUnit: Number(c.quantityPerUnit) })),
      operations: (bom.operations || []).map(op => ({ sequence: op.sequence, operationName: op.operationName, workCenterId: op.workCenter?.id || op.workCenterId, durationMinutes: op.durationMinutes })),
    });
  }, [bom]);

  const componentProducts = (products || []).filter(p => p.category === 'Component' || p.category === 'Raw Material');
  const finishedProducts = (products || []).filter(p => p.category === 'Finished Good');

  function addComponent() { setForm(p => ({...p, components: [...p.components, { componentProductId: '', quantityPerUnit: 1 }]})); }
  function removeComponent(idx) { setForm(p => ({...p, components: p.components.filter((_, i) => i !== idx)})); }
  function updateComponent(idx, field, value) { setForm(p => { const c = [...p.components]; c[idx] = {...c[idx], [field]: value}; return {...p, components: c}; }); }

  function addOperation() { setForm(p => ({...p, operations: [...p.operations, { sequence: p.operations.length + 1, operationName: '', workCenterId: '', durationMinutes: 30 }]})); }
  function removeOperation(idx) { setForm(p => ({...p, operations: p.operations.filter((_, i) => i !== idx).map((op, i) => ({...op, sequence: i+1}))})); }
  function updateOperation(idx, field, value) { setForm(p => { const ops = [...p.operations]; ops[idx] = {...ops[idx], [field]: value}; return {...p, operations: ops}; }); }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true);
    try {
      const payload = {
        productId: Number(form.productId),
        components: form.components.map(c => ({ componentProductId: Number(c.componentProductId), quantityPerUnit: Number(c.quantityPerUnit) })),
        operations: form.operations.map(op => ({ sequence: op.sequence, operationName: op.operationName, workCenterId: op.workCenterId ? Number(op.workCenterId) : null, durationMinutes: Number(op.durationMinutes) })),
      };
      const created = await api.post('/boms', payload);
      toast.success('BoM created');
      router.push(`/boms/${created.id}`);
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  async function handleActivate() {
    try { await api.post(`/boms/${params.id}/activate`); toast.success('BoM activated!'); mutate(); } catch (err) { toast.error(err.message); }
  }

  async function handleArchive() {
    try { await api.post(`/boms/${params.id}/archive`); toast.success('BoM archived'); mutate(); } catch (err) { toast.error(err.message); }
  }

  if (!isNew && !bom) return <div className="loading-page"><div className="spinner" style={{width:32,height:32}}></div></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isNew ? 'New Bill of Materials' : `BoM v${bom?.version} — ${bom?.product?.name}`}</h1>
          {!isNew && <div style={{display:'flex',alignItems:'center',gap:'var(--space-3)',marginTop:'var(--space-2)'}}><StatusBadge status={bom?.status} /></div>}
        </div>
        <div style={{display:'flex',gap:'var(--space-2)'}}>
          <button className="btn btn-ghost" onClick={() => router.push('/boms')}>← Back</button>
          {isNew && <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Create BoM'}</button>}
          {bom?.status === 'DRAFT' && <button className="btn btn-success" onClick={handleActivate}>Activate</button>}
          {bom?.status === 'ACTIVE' && <button className="btn btn-warning" onClick={handleArchive}>Archive</button>}
        </div>
      </div>

      {isNew && (
        <div className="card" style={{marginBottom:'var(--space-6)'}}>
          <h3 className="card-title" style={{marginBottom:'var(--space-4)'}}>Product</h3>
          <div className="form-group">
            <label className="form-label">Finished Good Product *</label>
            <select className="form-select" value={form.productId} onChange={e => setForm(p => ({...p, productId: e.target.value}))} required>
              <option value="">Select product</option>{finishedProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="card" style={{marginBottom:'var(--space-6)'}}>
        <div className="card-header"><h3 className="card-title">Components</h3>
          {isNew && <button className="btn btn-ghost btn-sm" onClick={addComponent}>+ Add Component</button>}
        </div>
        <table><thead><tr><th>Component</th><th>Qty per Unit</th>{!isNew && <th>UoM</th>}{isNew && <th></th>}</tr></thead>
          <tbody>{(isNew ? form.components : bom?.components || []).map((c, idx) => (
            <tr key={idx}>
              <td>{isNew ? (
                <select className="form-select" value={c.componentProductId} onChange={e => updateComponent(idx, 'componentProductId', e.target.value)} style={{minWidth:200}}>
                  <option value="">Select component</option>{componentProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              ) : <span style={{fontWeight:500,color:'var(--text-primary)'}}>{c.componentProduct?.name}</span>}</td>
              <td>{isNew ? <input className="form-input" type="number" step="0.01" value={c.quantityPerUnit} onChange={e => updateComponent(idx, 'quantityPerUnit', Number(e.target.value))} style={{width:100}} min={0.01} /> : Number(c.quantityPerUnit)}</td>
              {!isNew && <td style={{color:'var(--text-muted)'}}>{c.componentProduct?.uom}</td>}
              {isNew && <td><button className="btn btn-ghost btn-sm" onClick={() => removeComponent(idx)} style={{color:'var(--error-text)'}}>✕</button></td>}
            </tr>))}
          </tbody></table>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title">Operations</h3>
          {isNew && <button className="btn btn-ghost btn-sm" onClick={addOperation}>+ Add Operation</button>}
        </div>
        <table><thead><tr><th>#</th><th>Operation Name</th><th>Work Center</th><th>Duration (min)</th>{isNew && <th></th>}</tr></thead>
          <tbody>{(isNew ? form.operations : bom?.operations || []).map((op, idx) => (
            <tr key={idx}>
              <td>{op.sequence}</td>
              <td>{isNew ? <input className="form-input" value={op.operationName} onChange={e => updateOperation(idx, 'operationName', e.target.value)} placeholder="e.g. Assembly" style={{minWidth:180}} /> : <span style={{fontWeight:500,color:'var(--text-primary)'}}>{op.operationName}</span>}</td>
              <td>{isNew ? <input className="form-input" value={op.workCenterId} onChange={e => updateOperation(idx, 'workCenterId', e.target.value)} placeholder="Work Center ID" style={{width:140}} /> : op.workCenter?.name || '—'}</td>
              <td>{isNew ? <input className="form-input" type="number" value={op.durationMinutes} onChange={e => updateOperation(idx, 'durationMinutes', Number(e.target.value))} style={{width:100}} /> : `${op.durationMinutes} min`}</td>
              {isNew && <td><button className="btn btn-ghost btn-sm" onClick={() => removeOperation(idx)} style={{color:'var(--error-text)'}}>✕</button></td>}
            </tr>))}
          </tbody></table>
      </div>
    </>
  );
}
