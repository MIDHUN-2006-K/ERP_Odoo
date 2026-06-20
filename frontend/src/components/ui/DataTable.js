'use client';

import { useState } from 'react';

export default function DataTable({ columns, data, onRowClick, searchPlaceholder, actions, emptyMessage }) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? data.filter(row =>
        columns.some(col => {
          const val = col.accessor ? col.accessor(row) : row[col.key];
          return String(val || '').toLowerCase().includes(search.toLowerCase());
        })
      )
    : data;

  return (
    <div className="table-container">
      <div className="table-toolbar">
        <input
          type="text"
          className="table-search"
          placeholder={searchPlaceholder || 'Search...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {actions}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={col.style}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="table-empty">
                {emptyMessage || 'No records found'}
              </td>
            </tr>
          ) : (
            filtered.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={() => onRowClick?.(row)}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {columns.map(col => (
                  <td key={col.key}>
                    {col.render ? col.render(row) : (col.accessor ? col.accessor(row) : row[col.key])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    DRAFT: 'badge-draft',
    CONFIRMED: 'badge-confirmed',
    PARTIALLY_DELIVERED: 'badge-partial',
    PARTIALLY_RECEIVED: 'badge-partial',
    FULLY_DELIVERED: 'badge-done',
    FULLY_RECEIVED: 'badge-done',
    IN_PROGRESS: 'badge-partial',
    DONE: 'badge-done',
    CANCELLED: 'badge-cancelled',
    ACTIVE: 'badge-active',
    ARCHIVED: 'badge-draft',
    DISABLED: 'badge-cancelled',
  };

  const label = status?.replace(/_/g, ' ') || 'UNKNOWN';
  return <span className={`badge ${map[status] || 'badge-draft'}`}>{label}</span>;
}
