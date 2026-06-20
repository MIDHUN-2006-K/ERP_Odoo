'use client';

// Pure SVG circular progress gauge — no chart library needed
export default function FulfillmentGauge({ delivered = 0, inProgress = 0, pending = 0 }) {
  const total = delivered + inProgress + pending;
  const pct   = total > 0 ? Math.round((delivered / total) * 100) : 0;

  // SVG donut ring parameters
  const size   = 110;
  const cx     = size / 2;
  const cy     = size / 2;
  const r      = 44;
  const stroke = 9;
  const circ   = 2 * Math.PI * r;

  const deliveredDash  = (delivered  / Math.max(total, 1)) * circ;
  const inProgressDash = (inProgress / Math.max(total, 1)) * circ;
  // pending fills rest of ring naturally

  const deliveredOffset  = 0;
  const inProgressOffset = -deliveredDash;

  return (
    <div className="gauge-wrap">
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={size} height={size}>
          {/* Background ring */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="#E8E3DD"
            strokeWidth={stroke}
          />
          {/* Pending ring (amber, behind) */}
          {pending > 0 && (
            <circle
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke="#BA7517"
              strokeWidth={stroke}
              strokeDasharray={`${(pending / Math.max(total, 1)) * circ} ${circ}`}
              strokeDashoffset={-(deliveredDash + inProgressDash)}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="round"
            />
          )}
          {/* In-progress ring (terracotta-light) */}
          {inProgress > 0 && (
            <circle
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke="#F0997B"
              strokeWidth={stroke}
              strokeDasharray={`${inProgressDash} ${circ}`}
              strokeDashoffset={inProgressOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="round"
            />
          )}
          {/* Delivered ring (terracotta) */}
          {delivered > 0 && (
            <circle
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke="#D85A30"
              strokeWidth={stroke}
              strokeDasharray={`${deliveredDash} ${circ}`}
              strokeDashoffset={deliveredOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="round"
            />
          )}
        </svg>
        {/* Center text */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#2C2C2A', lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: '0.5rem', fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Delivered</div>
        </div>
      </div>

      <div className="gauge-legend">
        {delivered > 0 && (
          <div className="gauge-legend-item">
            <span className="gauge-legend-label">Delivered</span>
            <span className="gauge-legend-pct" style={{ color: '#D85A30' }}>{Math.round((delivered / Math.max(total, 1)) * 100)}%</span>
          </div>
        )}
        {inProgress > 0 && (
          <div className="gauge-legend-item">
            <span className="gauge-legend-label">In Progress</span>
            <span className="gauge-legend-pct" style={{ color: '#F0997B' }}>{Math.round((inProgress / Math.max(total, 1)) * 100)}%</span>
          </div>
        )}
        {pending > 0 && (
          <div className="gauge-legend-item">
            <span className="gauge-legend-label">Pending</span>
            <span className="gauge-legend-pct" style={{ color: '#BA7517' }}>{Math.round((pending / Math.max(total, 1)) * 100)}%</span>
          </div>
        )}
        {total === 0 && (
          <div style={{ color: '#888780', fontSize: 13 }}>No orders this month</div>
        )}
      </div>
    </div>
  );
}
