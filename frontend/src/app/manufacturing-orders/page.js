'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useRouter } from 'next/navigation';
import DataTable, { StatusBadge } from '@/components/ui/DataTable';
import Link from 'next/link';

const STATUS_FILTERS = [
  { label: 'All', value: '' }, { label: 'Draft', value: 'DRAFT' }, { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'In Progress', value: 'IN_PROGRESS' }, { label: 'Done', value: 'DONE' }, { label: 'Cancelled', value: 'CANCELLED' },
];

export default function ManufacturingOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data: orders, isLoading } = useSWR(statusFilter ? `/manufacturing-orders?status=${statusFilter}` : '/manufacturing-orders', fetcher);
  const router = useRouter();
  if (isLoading) return <div className="loading-page"><div className="spinner" style={{width:32,height:32}}></div></div>;
  const columns = [
    { key: 'orderNo', label: 'Reference', render: (row) => <span style={{fontWeight:600,color:'var(--accent-text)'}}>{row.orderNo}</span> },
    { key: 'createdAt', label: 'Date', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    { key: 'product', label: 'Product', render: (row) => row.product?.name || '—' },
    { key: 'quantity', label: 'Qty', render: (row) => Number(row.quantity) },
    { key: 'workOrders', label: 'Progress', render: (row) => {
      const done = (row.workOrders || []).filter(w => w.status === 'DONE').length;
      const total = (row.workOrders || []).length;
      return total > 0 ? `${done}/${total} ops` : '—';
    }},
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];
  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Manufacturing Orders</h1><p className="page-subtitle">{orders?.length || 0} orders</p></div>
        <Link href="/manufacturing-orders/new" className="btn btn-primary">+ New MO</Link>
      </div>
      <div className="filter-pills" style={{ marginBottom: 'var(--space-4)' }}>
        {STATUS_FILTERS.map(f => <button key={f.value} className={`filter-pill ${statusFilter === f.value ? 'active' : ''}`} onClick={() => setStatusFilter(f.value)}>{f.label}</button>)}
      </div>
      <DataTable columns={columns} data={orders || []} onRowClick={(row) => router.push(`/manufacturing-orders/${row.id}`)} searchPlaceholder="Search by reference or product..." />
    </>
  );
}
