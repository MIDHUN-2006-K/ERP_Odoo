'use client';

import useSWR from 'swr';
import { fetcher, api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/lib/toast-context';
import { useState } from 'react';

const STATUS_LABELS = {
  DRAFT:       'Draft',
  CONFIRMED:   'Confirmed',
  IN_PROGRESS: 'In Progress',
  DONE:        'Completed',
  CANCELLED:   'Cancelled',
};

const STATUS_COLORS = {
  DRAFT:       '#888780',
  CONFIRMED:   '#D85A30',
  IN_PROGRESS: '#BA7517',
  DONE:        '#1D9E75',
  CANCELLED:   '#E24B4A',
};

// Resolve work order step state
function stepState(wo, activeIndex, index) {
  if (wo.status === 'DONE') return 'done';
  if (index === activeIndex) return 'active';
  if (index < activeIndex) return 'done';
  return 'pending';
}

function WorkOrderTimeline({ workOrders }) {
  if (!workOrders || workOrders.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#B4B2A9', marginTop: 8, fontStyle: 'italic' }}>
        No work orders defined
      </div>
    );
  }

  // Find the first non-done step as active
  const activeIndex = workOrders.findIndex(w => w.status !== 'DONE');
  const effectiveActive = activeIndex === -1 ? workOrders.length : activeIndex;

  return (
    <div className="wo-timeline-new">
      {workOrders.map((wo, i) => {
        const state = wo.status === 'DONE' ? 'done'
                    : i === effectiveActive ? 'active'
                    : i < effectiveActive   ? 'done'
                    : 'pending';
        return (
          <div key={wo.id || i} className={`wo-step-new ${state}`}>
            <div className={`wo-dot ${state}`}>
              {state === 'done' ? '✓' : ''}
            </div>
            <div className="wo-step-label">{wo.operationName || wo.name || `Step ${i + 1}`}</div>
            {wo.duration && (
              <div className="wo-step-dur">{wo.duration} min</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MOCard({ mo, onAdvance }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const status      = mo.status;
  const statusLabel = STATUS_LABELS[status] || status;
  const statusColor = STATUS_COLORS[status] || '#888780';

  const workOrders  = mo.workOrders || [];
  const doneWOs     = workOrders.filter(w => w.status === 'DONE').length;
  const activeWO    = workOrders.find(w => w.status !== 'DONE');
  const currentStage= activeWO?.operationName || activeWO?.name || (status === 'DONE' ? 'Completed' : 'Not started');

  // Determine next allowed status
  const nextStatus = status === 'DRAFT'       ? 'CONFIRMED'
                   : status === 'CONFIRMED'   ? 'IN_PROGRESS'
                   : status === 'IN_PROGRESS' ? 'DONE'
                   : null;

  async function advance(e) {
    e.stopPropagation();
    if (!nextStatus || loading) return;
    setLoading(true);
    try {
      await onAdvance(mo.id, nextStatus);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mo-card">
      <div className="mo-card-header">
        <div style={{ flex: 1 }} onClick={() => router.push(`/manufacturing-orders/${mo.id}`)} style={{ cursor: 'pointer', flex: 1 }}>
          <div className="mo-card-id">{mo.orderNo}</div>
          <div className="mo-card-product">
            {Number(mo.quantity)} × {mo.product?.name || '—'}
          </div>
          <div className="mo-card-stage" style={{ color: statusColor }}>
            {statusLabel}{activeWO ? ` — ${currentStage}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px',
            borderRadius: 999, background: `${statusColor}18`, color: statusColor,
          }}>
            {statusLabel}
          </span>
          {nextStatus && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={advance}
              disabled={loading}
              style={{ fontSize: 11, padding: '2px 10px', whiteSpace: 'nowrap' }}
            >
              {loading ? '...' : `→ ${STATUS_LABELS[nextStatus]}`}
            </button>
          )}
        </div>
      </div>

      <WorkOrderTimeline workOrders={workOrders} />

      {workOrders.length > 0 && (
        <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 8 }}>
          {doneWOs}/{workOrders.length} operations complete
        </div>
      )}
    </div>
  );
}

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Done', value: 'DONE' },
];

export default function ManufacturingOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const url = statusFilter ? `/manufacturing-orders?status=${statusFilter}` : '/manufacturing-orders';
  const { data: orders, isLoading, mutate } = useSWR(url, fetcher);
  const toast = useToast();

  if (isLoading) return <div className="loading-page"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  const allOrders = (orders || []).filter(o => o.status !== 'CANCELLED');

  async function handleAdvance(moId, newStatus) {
    try {
      await api.patch(`/manufacturing-orders/${moId}/status`, { status: newStatus });
      await mutate();
      toast.success(`Order advanced to ${STATUS_LABELS[newStatus]}`);
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    }
  }

  // Summary counts
  const counts = {
    DRAFT:       allOrders.filter(o => o.status === 'DRAFT').length,
    CONFIRMED:   allOrders.filter(o => o.status === 'CONFIRMED').length,
    IN_PROGRESS: allOrders.filter(o => o.status === 'IN_PROGRESS').length,
    DONE:        allOrders.filter(o => o.status === 'DONE').length,
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Manufacturing Orders</h1>
          <p className="page-subtitle">
            {allOrders.length} orders ·
            <span style={{ color: '#BA7517' }}> {counts.IN_PROGRESS} in progress</span>
            {counts.DONE > 0 && <span style={{ color: '#1D9E75' }}> · {counts.DONE} completed</span>}
          </p>
        </div>
        <Link href="/manufacturing-orders/new" className="btn btn-primary">
          + New MO
        </Link>
      </div>

      {/* Status filter pills */}
      <div className="filter-pills" style={{ marginBottom: 'var(--space-5)' }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            className={`filter-pill ${statusFilter === f.value ? 'active' : ''}`}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
            {f.value && counts[f.value] !== undefined && (
              <span className="filter-pill-count">{counts[f.value]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Draft',       count: counts.DRAFT,       color: '#888780' },
          { label: 'Confirmed',   count: counts.CONFIRMED,   color: '#D85A30' },
          { label: 'In Progress', count: counts.IN_PROGRESS, color: '#BA7517' },
          { label: 'Completed',   count: counts.DONE,        color: '#1D9E75' },
        ].map(s => (
          <div key={s.label} className="metric-card" style={{ borderLeft: `4px solid ${s.color}` }}>
            <div className="metric-card-label">{s.label}</div>
            <div className="metric-card-value" style={{ color: s.color }}>{s.count}</div>
          </div>
        ))}
      </div>

      {/* MO Cards with timelines */}
      {allOrders.length === 0 ? (
        <div className="table-empty">No manufacturing orders found</div>
      ) : (
        allOrders.map(mo => (
          <MOCard key={mo.id} mo={mo} onAdvance={handleAdvance} />
        ))
      )}
    </>
  );
}
