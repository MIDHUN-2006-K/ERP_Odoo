'use client';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import DataTable from '@/components/ui/DataTable';

export default function AuditLogsPage() {
  const { data, isLoading } = useSWR('/audit-logs', fetcher);
  if (isLoading) return <div className="loading-page"><div className="spinner" style={{width:32,height:32}}></div></div>;

  const logs = data?.logs || [];
  const columns = [
    { key: 'createdAt', label: 'Timestamp', render: (row) => <span style={{fontSize:'var(--text-xs)',fontFamily:'var(--font-mono)'}}>{new Date(row.createdAt).toLocaleString()}</span> },
    { key: 'user', label: 'User', render: (row) => row.user?.name || '—' },
    { key: 'entityType', label: 'Entity', render: (row) => <span className="badge badge-info">{row.entityType?.replace(/_/g, ' ')}</span> },
    { key: 'entityId', label: 'ID', render: (row) => `#${row.entityId}` },
    { key: 'action', label: 'Action', render: (row) => <span style={{fontWeight:600,color:'var(--text-primary)'}}>{row.action}</span> },
    { key: 'after', label: 'Details', render: (row) => {
      const val = row.after;
      if (!val) return '—';
      try { return <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)',maxWidth:250,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'inline-block'}}>{typeof val === 'string' ? val : JSON.stringify(val)}</span>; }
      catch { return '—'; }
    }},
  ];

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Audit Logs</h1><p className="page-subtitle">{data?.total || 0} entries</p></div>
      </div>
      <DataTable columns={columns} data={logs} searchPlaceholder="Search logs..." emptyMessage="No audit logs found" />
    </>
  );
}
