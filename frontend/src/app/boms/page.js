'use client';
import useSWR from 'swr';
import { fetcher, api } from '@/lib/api';
import Link from 'next/link';
import { useToast } from '@/lib/toast-context';

const STATUS_COLORS = { DRAFT: '#888780', ACTIVE: '#1D9E75', ARCHIVED: '#BA7517' };

const CATEGORY_LABELS = {
  RAW_MATERIAL: 'Raw Material', COMPONENT: 'Component',
  CONSUMABLE: 'Consumable', FINISHED_GOOD: 'Finished Good',
};

function BomCard({ bom, onActivate, onArchive }) {
  const statusColor = STATUS_COLORS[bom.status] || '#888780';
  const compCount   = bom.components?.length || 0;
  const opCount     = bom.operations?.length || 0;

  return (
    <div className="stock-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
            {bom.product?.name}
          </div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 2 }}>
            {bom.product?.sku} · v{bom.version}
          </div>
          {bom.product?.category && (
            <div style={{ fontSize: 11, marginTop: 4, color: '#888780' }}>
              {CATEGORY_LABELS[bom.product.category] || bom.product.category}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
            background: `${statusColor}18`, color: statusColor,
          }}>{bom.status}</span>
        </div>
      </div>

      {/* Components preview */}
      <div style={{ marginBottom: 10 }}>
        {(bom.components || []).slice(0, 3).map((c, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 13, padding: '3px 0', borderBottom: '1px solid var(--border-subtle)',
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>{c.componentProduct?.name}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>× {Number(c.quantityPerUnit)}</span>
          </div>
        ))}
        {compCount > 3 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            +{compCount - 3} more components
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        {compCount} component{compCount !== 1 ? 's' : ''} · {opCount} operation{opCount !== 1 ? 's' : ''}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Link href={`/boms/${bom.id}`} className="btn btn-ghost btn-sm">View / Edit</Link>
        {bom.status === 'DRAFT' && (
          <button className="btn btn-primary btn-sm" onClick={() => onActivate(bom)}>Activate</button>
        )}
        {bom.status === 'ACTIVE' && (
          <button className="btn btn-ghost btn-sm" onClick={() => onArchive(bom)}>Archive</button>
        )}
      </div>
    </div>
  );
}

export default function BomsPage() {
  const { data: boms, isLoading, mutate } = useSWR('/boms', fetcher);
  const toast = useToast();

  async function handleActivate(bom) {
    try {
      await api.post(`/boms/${bom.id}/activate`);
      toast.success(`BoM for "${bom.product?.name}" activated`);
      mutate();
    } catch (err) { toast.error(err.message); }
  }

  async function handleArchive(bom) {
    if (!confirm(`Archive BoM for "${bom.product?.name}"?`)) return;
    try {
      await api.post(`/boms/${bom.id}/archive`);
      toast.success('BoM archived');
      mutate();
    } catch (err) { toast.error(err.message); }
  }

  if (isLoading) return <div className="loading-page"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  const allBoms   = boms || [];
  const active    = allBoms.filter(b => b.status === 'ACTIVE').length;
  const draft     = allBoms.filter(b => b.status === 'DRAFT').length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bills of Materials</h1>
          <p className="page-subtitle">
            {allBoms.length} BoMs
            {active > 0 && <span style={{ color: '#1D9E75' }}> · {active} active</span>}
            {draft  > 0 && <span style={{ color: '#888780' }}> · {draft} draft</span>}
          </p>
        </div>
        <Link href="/boms/new" className="btn btn-primary">+ New BoM</Link>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Active', count: active, color: '#1D9E75' },
          { label: 'Draft',  count: draft,  color: '#888780' },
          { label: 'Archived', count: allBoms.filter(b => b.status === 'ARCHIVED').length, color: '#BA7517' },
        ].map(s => (
          <div key={s.label} className="metric-card" style={{ borderLeft: `4px solid ${s.color}` }}>
            <div className="metric-card-label">{s.label}</div>
            <div className="metric-card-value" style={{ color: s.color }}>{s.count}</div>
          </div>
        ))}
      </div>

      {allBoms.length === 0 ? (
        <div className="table-empty" style={{ marginTop: 40 }}>
          No Bills of Materials yet.{' '}
          <Link href="/boms/new" style={{ color: '#D85A30', fontWeight: 600 }}>Create one →</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 14 }}>
          {allBoms.map(bom => (
            <BomCard key={bom.id} bom={bom} onActivate={handleActivate} onArchive={handleArchive} />
          ))}
        </div>
      )}
    </>
  );
}
