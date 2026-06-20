'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { fetcher, api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import KanbanBoard from '@/components/ui/KanbanBoard';
import { useToast } from '@/lib/toast-context';

const SalesTrendChart = dynamic(() => import('@/components/ui/SalesTrendChart'), { ssr: false });

// Map backend status → column id
const STATUS_TO_COL = {
  DRAFT:                'draft',
  CONFIRMED:            'confirmed',
  PARTIALLY_DELIVERED:  'partial',
  FULLY_DELIVERED:      'delivered',
};

// Map column id → backend status (for PATCH)
const COL_TO_STATUS = {
  draft:     'DRAFT',
  confirmed: 'CONFIRMED',
  partial:   'PARTIALLY_DELIVERED',
  delivered: 'FULLY_DELIVERED',
};

const COLUMNS = [
  { id: 'draft',     label: 'Draft',               statusValue: 'DRAFT' },
  { id: 'confirmed', label: 'Confirmed',            statusValue: 'CONFIRMED' },
  { id: 'partial',   label: 'Partially Delivered',  statusValue: 'PARTIALLY_DELIVERED' },
  { id: 'delivered', label: 'Fully Delivered',      statusValue: 'FULLY_DELIVERED' },
];

function buildSalesTrend(orders = []) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const now  = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    const dayName = days[d.getDay() === 0 ? 6 : d.getDay() - 1];
    const dateStr = d.toLocaleDateString('en-IN');
    const revenue = orders
      .filter(o => new Date(o.createdAt).toLocaleDateString('en-IN') === dateStr && o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + (o.lines || []).reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice || 0), 0), 0);
    return { day: dayName, revenue };
  });
}

function SalesCard({ card }) {
  const router = useRouter();
  const total  = (card.lines || []).reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice || 0), 0);
  const hasShortage = (card.lines || []).some(l => l.shortage > 0);

  return (
    <div onClick={() => router.push(`/sales-orders/${card.id}`)} style={{ cursor: 'pointer' }}>
      <div className="kanban-card-title">{card.customer?.name || '—'}</div>
      <div className="kanban-card-sub">{card.orderNo} · ₹{total.toLocaleString()}</div>
      {(card.lines || []).slice(0, 2).map((l, i) => (
        <div key={i} className="kanban-card-meta">
          {l.product?.name} × {Number(l.quantity)}
        </div>
      ))}
      {(card.lines || []).length > 2 && (
        <div className="kanban-card-meta">+{(card.lines || []).length - 2} more items</div>
      )}
      {hasShortage && (
        <div className="kanban-inline-badge" style={{ marginTop: 6 }}>
          Shortage detected
        </div>
      )}
      <div className="kanban-card-meta" style={{ marginTop: 4 }}>
        {new Date(card.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
      </div>
    </div>
  );
}

export default function SalesOrdersPage() {
  const { data: orders, isLoading, mutate } = useSWR('/sales-orders', fetcher);
  const toast = useToast();

  if (isLoading) return <div className="loading-page"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  const allOrders = (orders || []).filter(o => o.status !== 'CANCELLED');

  // Distribute into columns
  const columns = COLUMNS.map(col => ({
    ...col,
    cards: allOrders.filter(o => STATUS_TO_COL[o.status] === col.id),
  }));

  async function handleDrop(cardId, fromColId, toColId) {
    const newStatus = COL_TO_STATUS[toColId];
    try {
      await api.patch(`/sales-orders/${cardId}/status`, { status: newStatus });
      await mutate();
      toast.success(`Order moved to ${COLUMNS.find(c => c.id === toColId)?.label}`);
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    }
  }

  const trendData = buildSalesTrend(orders || []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Orders</h1>
          <p className="page-subtitle">{allOrders.length} active orders · drag cards to advance status</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/sales-orders/new" className="btn btn-primary">
            + New Sales Order
          </Link>
        </div>
      </div>

      {/* Kanban board */}
      <KanbanBoard
        columns={columns}
        renderCard={(card) => <SalesCard card={card} />}
        onDrop={handleDrop}
      />

      {/* Weekly order volume chart */}
      <div className="chart-panel" style={{ marginTop: 0 }}>
        <div className="chart-panel-title">Weekly order volume</div>
        <div className="chart-panel-subtitle">Incoming revenue trend over the last 7 days</div>
        <SalesTrendChart data={trendData} />
      </div>
    </>
  );
}
