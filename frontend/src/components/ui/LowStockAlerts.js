'use client';

import Link from 'next/link';

export default function LowStockAlerts({ items = [], maxShow = 3 }) {
  if (!items || items.length === 0) {
    return (
      <div style={{
        padding: '1rem',
        background: '#E1F5EE',
        border: '0.5px solid #1D9E75',
        borderRadius: 8,
        borderLeft: '3px solid #1D9E75',
        color: '#085041',
        fontSize: 13,
        fontWeight: 500,
      }}>
        All products adequately stocked
      </div>
    );
  }

  const sorted  = [...items].sort((a, b) => {
    const aCrit = a.status === 'CRITICAL' ? 0 : 1;
    const bCrit = b.status === 'CRITICAL' ? 0 : 1;
    return aCrit - bCrit;
  });
  const visible = sorted.slice(0, maxShow);
  const hasMore = sorted.length > maxShow;

  return (
    <div className="low-stock-list">
      {visible.map((item, i) => {
        const isCritical = item.freeToUseQty <= 0 || item.status === 'CRITICAL';
        return (
          <div key={i} className={`low-stock-alert ${isCritical ? 'critical' : 'low'}`}>
            <div className="low-stock-alert-name">{item.name}</div>
            <div className="low-stock-alert-detail">
              {Number(item.onHandQty)} on hand
              {item.reservedQty > 0 ? ` · ${Number(item.reservedQty)} reserved` : ''}
              {' · '}
              <strong>{isCritical ? 'Critical' : 'Low'}</strong>
            </div>
          </div>
        );
      })}

      {hasMore && (
        <Link
          href="/inventory"
          style={{
            display: 'block',
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: '#D85A30',
            padding: '6px 0',
            textDecoration: 'none',
          }}
        >
          View all {sorted.length} alerts →
        </Link>
      )}
    </div>
  );
}
