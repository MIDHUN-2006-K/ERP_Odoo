'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#FFFFFF',
        border: '0.5px solid #E8E3DD',
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: '0 4px 14px rgba(44,44,42,0.12)',
        fontSize: 13,
      }}>
        <div style={{ fontWeight: 700, color: '#2C2C2A', marginBottom: 2 }}>{label}</div>
        <div style={{ color: '#D85A30', fontWeight: 600 }}>₹{payload[0].value.toLocaleString()}</div>
      </div>
    );
  }
  return null;
};

export default function SalesTrendChart({ data }) {
  if (!data || data.length === 0) return (
    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888780', fontSize: 13 }}>
      No sales data available
    </div>
  );

  const lastVal  = data[data.length - 1]?.revenue || 0;
  const firstVal = data[0]?.revenue || 0;
  const trending = lastVal > firstVal;
  const maxVal   = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div>
      {trending !== null && (
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: trending ? '#1D9E75' : '#E24B4A' }}>
          {trending ? '↑ Trending up' : '↓ Trending down'} this week
        </div>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barCategoryGap="20%" margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#F2EDE6" strokeDasharray="0" />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#888780', fontWeight: 600 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: '#B4B2A9' }}
            tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(216,90,48,0.06)', radius: 4 }} />
          <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((entry, index) => {
              const intensity = entry.revenue / maxVal;
              // Gradient from lighter to deeper terracotta based on value
              const r = Math.round(216 + (240 - 216) * (1 - intensity));
              const g = Math.round(90 + (153 - 90) * (1 - intensity));
              const b = Math.round(48 + (123 - 48) * (1 - intensity));
              return <Cell key={`cell-${index}`} fill={`rgb(${r},${g},${b})`} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
