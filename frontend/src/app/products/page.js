'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useRouter } from 'next/navigation';
import DataTable, { StatusBadge } from '@/components/ui/DataTable';
import Link from 'next/link';

export default function ProductsPage() {
  const { data: products, isLoading } = useSWR('/products', fetcher);
  const router = useRouter();

  if (isLoading) return <div className="loading-page"><div className="spinner" style={{width:32,height:32}}></div></div>;

  const columns = [
    { key: 'sku', label: 'SKU', render: (row) => <span style={{fontFamily:'var(--font-mono)',fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{row.sku}</span> },
    { key: 'name', label: 'Product Name', render: (row) => <span style={{color:'var(--text-primary)',fontWeight:500}}>{row.name}</span> },
    { key: 'category', label: 'Category' },
    { key: 'uom', label: 'UoM' },
    { key: 'salesPrice', label: 'Sales Price', render: (row) => `₹${Number(row.salesPrice).toLocaleString()}` },
    { key: 'costPrice', label: 'Cost Price', render: (row) => `₹${Number(row.costPrice).toLocaleString()}` },
    { key: 'onHandQty', label: 'On Hand', render: (row) => <span style={{fontWeight:600}}>{Number(row.onHandQty)}</span> },
    { key: 'freeToUseQty', label: 'Free to Use', render: (row) => {
      const free = Number(row.freeToUseQty);
      return <span style={{fontWeight:600, color: free <= 0 ? 'var(--error-text)' : free < 10 ? 'var(--warning-text)' : 'var(--success-text)'}}>{free}</span>;
    }},
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">{products?.length || 0} products in catalog</p>
        </div>
        <Link href="/products/new" className="btn btn-primary">+ New Product</Link>
      </div>
      <DataTable
        columns={columns}
        data={products || []}
        onRowClick={(row) => router.push(`/products/${row.id}`)}
        searchPlaceholder="Search by name or SKU..."
      />
    </>
  );
}
