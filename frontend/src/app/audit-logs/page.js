'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';

const PAGE_SIZE = 20;

const MODULE_FILTERS = [
  { label: 'All Modules', value: '' },
  { label: 'Sales',        value: 'SALES_ORDER' },
  { label: 'Purchase',     value: 'PURCHASE_ORDER' },
  { label: 'Manufacturing',value: 'MANUFACTURING_ORDER' },
  { label: 'Inventory',    value: 'INVENTORY' },
  { label: 'Products',     value: 'PRODUCT' },
];

const ACTION_FILTERS = [
  { label: 'All Actions', value: '' },
  { label: 'Created',     value: 'CREATE' },
  { label: 'Updated',     value: 'UPDATE' },
  { label: 'Confirmed',   value: 'CONFIRM' },
  { label: 'Delivered',   value: 'DELIVER' },
  { label: 'Cancelled',   value: 'CANCEL' },
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0)  return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return 'Just now';
}

function formatFull(dateStr) {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function severityForAction(action) {
  const a = (action || '').toUpperCase();
  if (a.includes('CANCEL') || a.includes('DELETE') || a.includes('SHORT')) return 'critical';
  if (a.includes('DELAY') || a.includes('WARN') || a.includes('LATE'))     return 'warning';
  return 'normal';
}

function buildSentence(log) {
  const actor    = log.user?.name || 'System';
  const action   = (log.action || '').toLowerCase().replace(/_/g, ' ');
  const entity   = (log.entityType || '').replace(/_/g, ' ').toLowerCase();
  const entityId = log.entityId ? `#${log.entityId}` : '';

  // Try to pull useful "after" context
  let context = '';
  if (log.after) {
    try {
      const val = typeof log.after === 'string' ? JSON.parse(log.after) : log.after;
      if (val?.status)   context = `New status: ${val.status}`;
      if (val?.quantity) context = `Qty: ${val.quantity}`;
      if (val?.reason)   context = val.reason;
    } catch {}
  }

  return { actor, action, entity, entityId, context };
}

export default function AuditLogsPage() {
  const { data, isLoading } = useSWR('/audit-logs', fetcher);
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage]                 = useState(1);

  const logs = data?.logs || [];

  const filtered = useMemo(() => {
    return logs.filter(log => {
      const matchModule = !moduleFilter || (log.entityType || '').toUpperCase().includes(moduleFilter);
      const matchAction = !actionFilter || (log.action || '').toUpperCase().includes(actionFilter);
      return matchModule && matchAction;
    });
  }, [logs, moduleFilter, actionFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleFilterChange(setter) {
    return (val) => { setter(val); setPage(1); };
  }

  if (isLoading) return (
    <div className="loading-page">
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      <span>Loading activity...</span>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Activity Feed</h1>
          <p className="page-subtitle">{filtered.length} entries · newest first</p>
        </div>
      </div>

      {/* Filters */}
      <div className="activity-filters" style={{ marginBottom: 20 }}>
        <span className="activity-filter-label">Module:</span>
        <div className="filter-pills" style={{ margin: 0 }}>
          {MODULE_FILTERS.map(f => (
            <button
              key={f.value}
              className={`filter-pill ${moduleFilter === f.value ? 'active' : ''}`}
              onClick={() => handleFilterChange(setModuleFilter)(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span className="activity-filter-label" style={{ marginLeft: 8 }}>Action:</span>
        <div className="filter-pills" style={{ margin: 0 }}>
          {ACTION_FILTERS.map(f => (
            <button
              key={f.value}
              className={`filter-pill ${actionFilter === f.value ? 'active' : ''}`}
              onClick={() => handleFilterChange(setActionFilter)(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity feed */}
      {paginated.length === 0 ? (
        <div className="table-empty" style={{ marginTop: 40 }}>No activity found</div>
      ) : (
        <div className="activity-feed">
          {paginated.map((log, i) => {
            const severity = severityForAction(log.action);
            const { actor, action, entity, entityId, context } = buildSentence(log);

            return (
              <div key={log.id || i} className={`activity-card severity-${severity}`}>
                <div className="activity-time" title={formatFull(log.createdAt)}>
                  {timeAgo(log.createdAt)} · {formatFull(log.createdAt)}
                </div>
                <div className="activity-action">
                  <strong>{actor}</strong> {action} {entity} {entityId && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12,
                      color: '#D85A30', fontWeight: 600,
                    }}>{entityId}</span>
                  )}
                </div>
                {context && (
                  <div className="activity-context">{context}</div>
                )}
                {log.entityType && (
                  <div style={{
                    display: 'inline-block', marginTop: 4,
                    fontSize: 10, fontWeight: 700, padding: '1px 7px',
                    borderRadius: 999, background: '#F2EDE6', color: '#888780',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {log.entityType.replace(/_/g, ' ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="activity-pagination">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Previous
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const pg = i + 1;
            return (
              <button
                key={pg}
                className={`btn btn-sm ${page === pg ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setPage(pg)}
              >
                {pg}
              </button>
            );
          })}
          {totalPages > 7 && <span style={{ color: '#888780', fontSize: 13 }}>…</span>}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </>
  );
}
