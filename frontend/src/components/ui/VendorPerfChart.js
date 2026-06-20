'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#FFFFFF', border: '0.5px solid #E8E3DD',
        borderRadius: 8, padding: '8px 12px',
        boxShadow: '0 4px 14px rgba(44,44,42,0.12)', fontSize: 12,
      }}>
        <div style={{ fontWeight: 700, color: '#2C2C2A', marginBottom: 4 }}>{label}</div>
        {payload.map(p => (
          <div key={p.dataKey} style={{ color: p.fill, fontWeight: 600 }}>
            {p.name}: {p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function VendorPerfChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888780', fontSize: 13 }}>
        No vendor delivery data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barCategoryGap="30%" margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#F2EDE6" strokeDasharray="0" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888780' }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#B4B2A9' }} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(216,90,48,0.05)' }} />
        <Bar dataKey="onTime" name="On-time" fill="#1D9E75" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="late"   name="Delayed" fill="#E24B4A" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
