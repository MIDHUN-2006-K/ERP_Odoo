'use client';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useRouter } from 'next/navigation';
import DataTable, { StatusBadge } from '@/components/ui/DataTable';
import Link from 'next/link';

export default function BomsPage() {
  const { data: boms, isLoading } = useSWR('/boms', fetcher);
  const router = useRouter();
  if (isLoading) return <div className="loading-page"><div className="spinner" style={{width:32,height:32}}></div></div>;
  const columns = [
    { key: 'product', label: 'Product', render: (row) => <span style={{fontWeight:500,color:'var(--text-primary)'}}>{row.product?.name}</span> },
    { key: 'sku', label: 'SKU', render: (row) => <span style={{fontFamily:'var(--font-mono)',fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{row.product?.sku}</span> },
    { key: 'version', label: 'Version', render: (row) => `v${row.version}` },
    { key: 'components', label: 'Components', render: (row) => `${(row.components || []).length} items` },
    { key: 'operations', label: 'Operations', render: (row) => `${(row.operations || []).length} steps` },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];
  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Bills of Materials</h1><p className="page-subtitle">{boms?.length || 0} BoMs</p></div>
        <Link href="/boms/new" className="btn btn-primary">+ New BoM</Link>
      </div>
      <DataTable columns={columns} data={boms || []} onRowClick={(row) => router.push(`/boms/${row.id}`)} searchPlaceholder="Search by product name..." />
    </>
  );
}
