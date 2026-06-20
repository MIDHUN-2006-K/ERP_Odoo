'use client';

const BARS = [
  { key: 'completed', label: 'Completed', color: '#1D9E75' },
  { key: 'inProgress', label: 'In Progress', color: '#BA7517' },
  { key: 'delayed',   label: 'Delayed',     color: '#E24B4A' },
];

export default function MfgStatusBars({ completed = 0, inProgress = 0, delayed = 0 }) {
  const total = completed + inProgress + delayed;

  const rows = [
    { label: 'Completed',   count: completed,  color: '#1D9E75', pct: total > 0 ? (completed  / total) * 100 : 0 },
    { label: 'In Progress', count: inProgress, color: '#BA7517', pct: total > 0 ? (inProgress / total) * 100 : 0 },
    { label: 'Delayed',     count: delayed,    color: '#E24B4A', pct: total > 0 ? (delayed    / total) * 100 : 0 },
  ];

  if (total === 0) {
    return <div style={{ color: '#888780', fontSize: 13, padding: '1rem 0' }}>No manufacturing orders</div>;
  }

  return (
    <div style={{ paddingTop: 4 }}>
      {rows.map(row => (
        <div key={row.label} className="mfg-bar-row" style={{ position: 'relative' }}>
          <div className="mfg-bar-label">{row.label}</div>
          <div className="mfg-bar-track" style={{ position: 'relative' }}>
            <div
              className="mfg-bar-fill"
              style={{
                width: `${row.pct}%`,
                background: row.color,
              }}
            />
          </div>
          <div className="mfg-bar-count">
            {row.count} orders
          </div>
        </div>
      ))}
      <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 4, textAlign: 'right' }}>
        Total: {total} orders
      </div>
    </div>
  );
}
