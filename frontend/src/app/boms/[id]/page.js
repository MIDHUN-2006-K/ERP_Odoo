'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher, api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import Link from 'next/link';

const STATUS_COLORS = { DRAFT: '#888780', ACTIVE: '#1D9E75', ARCHIVED: '#BA7517' };
const CATEGORY_LABELS = {
  RAW_MATERIAL: 'Raw Material', COMPONENT: 'Component',
  CONSUMABLE: 'Consumable', FINISHED_GOOD: 'Finished Good',
};

function TreeRow({ label, qty, uom, procType, isLast, children }) {
  const prefix    = isLast ? '└─' : '├─';
  const procColor = procType === 'MANUFACTURING' ? '#6366f1' : procType === 'PURCHASE' ? '#D85A30' : '#888780';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', minWidth: 20 }}>{prefix}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
        {procType && (
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: `${procColor}15`, color: procColor, fontWeight: 700 }}>
            {procType === 'MANUFACTURING' ? 'MFG' : 'BUY'}
          </span>
        )}
        <span style={{ fontSize: 13, fontWeight: 700, color: '#D85A30', minWidth: 50, textAlign: 'right' }}>× {Number(qty)}</span>
        {uom && <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 30 }}>{uom}</span>}
      </div>
      {children}
    </div>
  );
}

function ExplosionTree({ nodes, depth = 0 }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
      {nodes.map((node, i) => (
        <TreeRow
          key={i}
          label={node.productName}
          qty={node.quantityRequired}
          uom={node.uom}
          procType={node.procurementType}
          isLast={i === nodes.length - 1}
        >
          {node.children?.length > 0 && <ExplosionTree nodes={node.children} depth={depth + 1} />}
        </TreeRow>
      ))}
    </div>
  );
}

export default function BomDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const toast  = useToast();

  const { data: bom, isLoading, mutate } = useSWR(`/boms/${id}`, fetcher);
  const { data: products }    = useSWR('/products', fetcher);
  const { data: workCenters } = useSWR('/work-centers', fetcher);
  const { data: explosion }   = useSWR(bom ? `/boms/${id}/explosion?qty=1` : null, fetcher);

  const [editing, setEditing]       = useState(false);
  const [components, setComponents] = useState([]);
  const [operations, setOperations] = useState([]);
  const [saving, setSaving]         = useState(false);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (bom) {
      setComponents(bom.components.map(c => ({
        componentProductId: String(c.componentProductId),
        quantityPerUnit:    Number(c.quantityPerUnit),
      })));
      setOperations(bom.operations.map(op => ({
        sequence:        op.sequence,
        operationName:   op.operationName,
        workCenterId:    String(op.workCenterId),
        durationMinutes: op.durationMinutes,
      })));
    }
  }, [bom]);

  function addComponent()    { setComponents(c => [...c, { componentProductId: '', quantityPerUnit: 1 }]); }
  function removeComponent(i){ setComponents(c => c.filter((_, idx) => idx !== i)); }
  function updateComponent(i, field, value) {
    setComponents(c => c.map((comp, idx) => idx === i ? { ...comp, [field]: value } : comp));
  }

  function addOperation()    { setOperations(o => [...o, { sequence: o.length + 1, operationName: '', workCenterId: '', durationMinutes: 30 }]); }
  function removeOperation(i){ setOperations(o => o.filter((_, idx) => idx !== i)); }
  function updateOperation(i, field, value) {
    setOperations(o => o.map((op, idx) => idx === i ? { ...op, [field]: value } : op));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/boms/${id}`, {
        components: components.filter(c => c.componentProductId).map(c => ({
          componentProductId: Number(c.componentProductId),
          quantityPerUnit:    Number(c.quantityPerUnit),
        })),
        operations: operations.filter(op => op.operationName && op.workCenterId).map(op => ({
          sequence:        Number(op.sequence),
          operationName:   op.operationName,
          workCenterId:    Number(op.workCenterId),
          durationMinutes: Number(op.durationMinutes),
        })),
      });
      toast.success('BoM updated');
      setEditing(false);
      mutate();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleActivate() {
    setActivating(true);
    try {
      await api.post(`/boms/${id}/activate`);
      toast.success('BoM activated');
      mutate();
    } catch (err) { toast.error(err.message); }
    finally { setActivating(false); }
  }

  async function handleArchive() {
    if (!confirm('Archive this BoM?')) return;
    try { await api.post(`/boms/${id}/archive`); toast.success('BoM archived'); mutate(); }
    catch (err) { toast.error(err.message); }
  }

  async function handleDelete() {
    if (!confirm('Delete this BoM?')) return;
    try { await api.delete(`/boms/${id}`); toast.success('BoM deleted'); router.push('/boms'); }
    catch (err) { toast.error(err.message); }
  }

  if (isLoading) return <div className="loading-page"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;
  if (!bom) return <div className="table-empty">BoM not found</div>;

  const productList = Array.isArray(products) ? products : [];
  const wcList      = Array.isArray(workCenters) ? workCenters : [];
  const statusColor = STATUS_COLORS[bom.status] || '#888780';
  const explosionList = Array.isArray(explosion) ? explosion : [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{bom.product?.name}</h1>
          <p className="page-subtitle">
            BoM v{bom.version} · {bom.product?.sku}
            {bom.product?.category && ` · ${CATEGORY_LABELS[bom.product.category] || bom.product.category}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 999, background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}30` }}>
            {bom.status}
          </span>
          {bom.status === 'DRAFT' && !editing && (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
          )}
          {editing && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); mutate(); }}>Discard</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </>
          )}
          {bom.status === 'DRAFT' && !editing && (
            <button className="btn btn-primary btn-sm" onClick={handleActivate} disabled={activating}>
              {activating ? '...' : 'Activate'}
            </button>
          )}
          {bom.status === 'ACTIVE' && <button className="btn btn-ghost btn-sm" onClick={handleArchive}>Archive</button>}
          <Link href="/boms" className="btn btn-ghost btn-sm">← Back</Link>
        </div>
      </div>

      {bom.status === 'ACTIVE' && (
        <div style={{ background: '#E1F5EE', border: '0.5px solid #1D9E75', borderLeft: '3px solid #1D9E75', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#085041' }}>
          This is the <strong>active default BoM</strong> for {bom.product?.name}. Archive it first to make edits.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Components */}
          <div className="chart-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="chart-panel-title">Components</div>
              {editing && <button type="button" className="btn btn-ghost btn-sm" onClick={addComponent}>+ Add</button>}
            </div>

            {!editing ? (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  ┌─ {bom.product?.name}
                </div>
                {bom.components.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>No components</div>}
                {bom.components.map((c, i) => (
                  <TreeRow
                    key={c.id}
                    label={c.componentProduct?.name}
                    qty={c.quantityPerUnit}
                    uom={c.componentProduct?.uom}
                    procType={c.componentProduct?.procurementType}
                    isLast={i === bom.components.length - 1}
                  />
                ))}
              </div>
            ) : (
              components.map((comp, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 36px', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    {i === 0 && <label className="form-label">Product</label>}
                    <select className="form-select" value={comp.componentProductId} onChange={e => updateComponent(i, 'componentProductId', e.target.value)}>
                      <option value="">Select...</option>
                      {productList.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    {i === 0 && <label className="form-label">Qty/Unit</label>}
                    <input className="form-input" type="number" min="0.001" step="0.001" value={comp.quantityPerUnit} onChange={e => updateComponent(i, 'quantityPerUnit', e.target.value)} />
                  </div>
                  <button type="button" onClick={() => removeComponent(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E24B4A', fontSize: 18, paddingBottom: 4 }}>×</button>
                </div>
              ))
            )}
          </div>

          {/* Operations */}
          <div className="chart-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div className="chart-panel-title">Operations</div>
                <div className="chart-panel-subtitle">Sequential work orders for production</div>
              </div>
              {editing && <button type="button" className="btn btn-ghost btn-sm" onClick={addOperation}>+ Add</button>}
            </div>

            {!editing ? (
              bom.operations.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>No operations defined</div>
              ) : (
                bom.operations.map((op, i) => (
                  <div key={op.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{op.sequence}. {op.operationName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{op.workCenter?.name}</div>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{op.durationMinutes} min</div>
                  </div>
                ))
              )
            ) : (
              operations.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>No operations (click + Add)</div>
              ) : (
                operations.map((op, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 36px', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      {i === 0 && <label className="form-label">Operation</label>}
                      <input className="form-input" value={op.operationName} placeholder="Assembly" onChange={e => updateOperation(i, 'operationName', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      {i === 0 && <label className="form-label">Work Center</label>}
                      <select className="form-select" value={op.workCenterId} onChange={e => updateOperation(i, 'workCenterId', e.target.value)}>
                        <option value="">Select...</option>
                        {wcList.map(wc => <option key={wc.id} value={wc.id}>{wc.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      {i === 0 && <label className="form-label">Min</label>}
                      <input className="form-input" type="number" min="1" value={op.durationMinutes} onChange={e => updateOperation(i, 'durationMinutes', e.target.value)} />
                    </div>
                    <button type="button" onClick={() => removeOperation(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E24B4A', fontSize: 18, paddingBottom: 4 }}>×</button>
                  </div>
                ))
              )
            )}
          </div>

          {/* Meta */}
          <div className="chart-panel" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            <div>Created by: <strong style={{ color: 'var(--text-primary)' }}>{bom.creator?.name}</strong></div>
            <div style={{ marginTop: 4 }}>Version: <strong>v{bom.version}</strong></div>
            {bom.status === 'DRAFT' && !editing && (
              <button className="btn btn-ghost btn-sm" style={{ color: '#E24B4A', marginTop: 12, padding: 0 }} onClick={handleDelete}>
                Delete this BoM
              </button>
            )}
          </div>
        </div>

        {/* Right: BoM Explosion */}
        <div className="chart-panel" style={{ position: 'sticky', top: 80 }}>
          <div className="chart-panel-title" style={{ marginBottom: 4 }}>BoM Explosion (1 unit)</div>
          <div className="chart-panel-subtitle" style={{ marginBottom: 10 }}>Component requirements for 1 unit of {bom.product?.name}</div>

          {explosionList.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>No components to show</div>
          ) : (
            <>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                ┌─ {bom.product?.name} × 1
              </div>
              <ExplosionTree nodes={explosionList} />
            </>
          )}

          <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <span style={{ padding: '1px 6px', borderRadius: 999, background: '#6366f115', color: '#6366f1', fontWeight: 700, fontSize: 10 }}>MFG</span>
              Manufacture
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <span style={{ padding: '1px 6px', borderRadius: 999, background: '#D85A3015', color: '#D85A30', fontWeight: 700, fontSize: 10 }}>BUY</span>
              Purchase
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
