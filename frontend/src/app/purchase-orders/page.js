'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import KanbanBoard from '@/components/ui/KanbanBoard';
import { useToast } from '@/lib/toast-context';

const VendorPerfChart = dynamic(() => import('@/components/ui/VendorPerfChart'), { ssr: false });

const STATUS_TO_COL = {
  DRAFT:             'draft',
  CONFIRMED:         'confirmed',
  PARTIALLY_RECEIVED:'partial',
  FULLY_RECEIVED:    'received',
};

const COL_TO_STATUS = {
  draft:    'DRAFT',
  confirmed:'CONFIRMED',
  partial:  'PARTIALLY_RECEIVED',
  received: 'FULLY_RECEIVED',
};

const COLUMNS = [
  { id: 'draft',     label: 'Draft' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'partial',   label: 'Partially Received' },
  { id: 'received',  label: 'Fully Received' },
];

function isOverdue(order) {
  if (!order.expectedDelivery || order.status === 'FULLY_RECEIVED') return false;
  return new Date(order.expectedDelivery) < new Date();
}

function daysDiff(dateStr) {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function PurchaseCard({ card }) {
  const router   = useRouter();
  const total    = (card.lines || []).reduce((s, l) => s + Number(l.quantity) * Number(l.unitCost || 0), 0);
  const overdue  = isOverdue(card);
  const delayDays = overdue ? daysDiff(card.expectedDelivery) : 0;

  return (
    <div onClick={() => router.push(`/purchase-orders/${card.id}`)} style={{ cursor: 'pointer' }}>
      <div className="kanban-card-title">{card.vendor?.name || '—'}</div>
      <div className="kanban-card-sub">{card.orderNo} · ₹{total.toLocaleString()}</div>
      {(card.lines || []).slice(0, 2).map((l, i) => (
        <div key={i} className="kanban-card-meta">
          {l.product?.name} × {Number(l.quantity)}
        </div>
      ))}
      {card.expectedDelivery && (
        <div className="kanban-card-meta" style={{ marginTop: 4 }}>
          Expected: {new Date(card.expectedDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </div>
      )}
      {overdue && (
        <div className="kanban-inline-badge delayed" style={{ marginTop: 6 }}>
          Delayed by {delayDays} day{delayDays !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

export default function PurchaseOrdersPage() {
  const { data: orders, isLoading, mutate } = useSWR('/purchase-orders', fetcher);
  const toast = useToast();

  if (isLoading) return <div className="loading-page"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  const allOrders = (orders || []).filter(o => o.status !== 'CANCELLED');

  const columns = COLUMNS.map(col => ({
    ...col,
    cards: allOrders.filter(o => STATUS_TO_COL[o.status] === col.id),
  }));

  // Vendor performance data
  const vendorMap = {};
  (orders || []).forEach(o => {
    if (!o.vendor?.name) return;
    const name = o.vendor.name;
    if (!vendorMap[name]) vendorMap[name] = { name, onTime: 0, late: 0 };
    if (o.status === 'FULLY_RECEIVED') {
      if (isOverdue(o)) vendorMap[name].late++;
      else vendorMap[name].onTime++;
    }
  });
  const vendorPerf = Object.values(vendorMap)
    .sort((a, b) => (b.onTime + b.late) - (a.onTime + a.late))
    .slice(0, 5);

  async function handleDrop(cardId, fromColId, toColId) {
    const newStatus = COL_TO_STATUS[toColId];
    try {
      await api.patch(`/purchase-orders/${cardId}/status`, { status: newStatus });
      await mutate();
      toast.success(`Order moved to ${COLUMNS.find(c => c.id === toColId)?.label}`);
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Orders</h1>
          <p className="page-subtitle">{allOrders.length} active orders · drag cards to advance status</p>
        </div>
        <Link href="/purchase-orders/new" className="btn btn-primary">
          + New Purchase Order
        </Link>
      </div>

      <KanbanBoard
        columns={columns}
        renderCard={(card) => <PurchaseCard card={card} />}
        onDrop={handleDrop}
      />

      {/* Vendor performance chart */}
      {vendorPerf.length > 0 && (
        <div className="chart-panel" style={{ marginTop: 0 }}>
          <div className="chart-panel-title">Vendor performance</div>
          <div className="chart-panel-subtitle">On-time vs delayed deliveries (top 5 vendors)</div>
          <div className="perf-legend">
            <div className="perf-legend-item">
              <div className="perf-legend-dot" style={{ background: '#1D9E75' }} />
              On-time
            </div>
            <div className="perf-legend-item">
              <div className="perf-legend-dot" style={{ background: '#E24B4A' }} />
              Delayed
            </div>
          </div>
          <VendorPerfChart data={vendorPerf} />
        </div>
      )}
    </>
  );
}
