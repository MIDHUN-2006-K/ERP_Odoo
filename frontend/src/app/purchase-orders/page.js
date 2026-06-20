'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useRouter } from 'next/navigation';
import DataTable, { StatusBadge } from '@/components/ui/DataTable';
import Link from 'next/link';

const STATUS_FILTERS = [
  { label: 'All', value: '' }, { label: 'Draft', value: 'DRAFT' }, { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Partially Received', value: 'PARTIALLY_RECEIVED' }, { label: 'Received', value: 'FULLY_RECEIVED' }, { label: 'Cancelled', value: 'CANCELLED' },
];

export default function PurchaseOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data: orders, isLoading } = useSWR(statusFilter ? `/purchase-orders?status=${statusFilter}` : '/purchase-orders', fetcher);
  const router = useRouter();
  if (isLoading) return <div className="loading-page"><div className="spinner" style={{width:32,height:32}}></div></div>;
  const columns = [
    { key: 'orderNo', label: 'Reference', render: (row) => <span style={{fontWeight:600,color:'var(--accent-text)'}}>{row.orderNo}</span> },
    { key: 'createdAt', label: 'Date', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    { key: 'vendor', label: 'Vendor', render: (row) => row.vendor?.name || '—' },
    { key: 'createdBy', label: 'Responsible', render: (row) => row.createdByUser?.name || '—' },
    { key: 'total', label: 'Total', render: (row) => `₹${(row.lines || []).reduce((s, l) => s + Number(l.quantity) * Number(l.unitCost), 0).toLocaleString()}` },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];
  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Purchase Orders</h1><p className="page-subtitle">{orders?.length || 0} orders</p></div>
        <Link href="/purchase-orders/new" className="btn btn-primary">+ New Purchase Order</Link>
      </div>
      <div className="filter-pills" style={{ marginBottom: 'var(--space-4)' }}>
        {STATUS_FILTERS.map(f => <button key={f.value} className={`filter-pill ${statusFilter === f.value ? 'active' : ''}`} onClick={() => setStatusFilter(f.value)}>{f.label}</button>)}
      </div>
      <DataTable columns={columns} data={orders || []} onRowClick={(row) => router.push(`/purchase-orders/${row.id}`)} searchPlaceholder="Search by reference or vendor..." />
    </>
  );
}
