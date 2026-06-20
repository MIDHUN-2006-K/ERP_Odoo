'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useRouter } from 'next/navigation';
import DataTable, { StatusBadge } from '@/components/ui/DataTable';
import Link from 'next/link';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Partially Delivered', value: 'PARTIALLY_DELIVERED' },
  { label: 'Delivered', value: 'FULLY_DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export default function SalesOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const url = statusFilter ? `/sales-orders?status=${statusFilter}` : '/sales-orders';
  const { data: orders, isLoading } = useSWR(url, fetcher);
  const router = useRouter();

  if (isLoading) return <div className="loading-page"><div className="spinner" style={{width:32,height:32}}></div></div>;

  const columns = [
    { key: 'orderNo', label: 'Reference', render: (row) => <span style={{fontWeight:600,color:'var(--accent-text)'}}>{row.orderNo}</span> },
    { key: 'createdAt', label: 'Date', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    { key: 'customer', label: 'Customer', render: (row) => row.customer?.name || '—' },
    { key: 'createdBy', label: 'Salesperson', render: (row) => row.createdByUser?.name || '—' },
    { key: 'total', label: 'Total', render: (row) => {
      const total = (row.lines || []).reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitPrice), 0);
      return `₹${total.toLocaleString()}`;
    }},
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Orders</h1>
          <p className="page-subtitle">{orders?.length || 0} orders</p>
        </div>
        <Link href="/sales-orders/new" className="btn btn-primary">+ New Sales Order</Link>
      </div>

      <div className="filter-pills" style={{ marginBottom: 'var(--space-4)' }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            className={`filter-pill ${statusFilter === f.value ? 'active' : ''}`}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={orders || []}
        onRowClick={(row) => router.push(`/sales-orders/${row.id}`)}
        searchPlaceholder="Search by reference or customer..."
      />
    </>
  );
}
