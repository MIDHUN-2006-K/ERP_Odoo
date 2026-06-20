'use client';

import { useAuth } from '@/lib/auth-context';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import FulfillmentGauge from '@/components/ui/FulfillmentGauge';
import MfgStatusBars from '@/components/ui/MfgStatusBars';
import LowStockAlerts from '@/components/ui/LowStockAlerts';

// Lazy-load the chart (client-only, needs window)
const SalesTrendChart = dynamic(() => import('@/components/ui/SalesTrendChart'), { ssr: false });

/* ─────────────────────────────────────────────
   Helper: format Indian currency shorthand
───────────────────────────────────────────── */
function formatINR(amount) {
  if (!amount || amount === 0) return '₹0';
  if (amount >= 10_00_000) return `₹${(amount / 10_00_000).toFixed(1)}Cr`;
  if (amount >= 1_00_000)  return `₹${(amount / 1_00_000).toFixed(1)}L`;
  if (amount >= 1_000)     return `₹${(amount / 1_000).toFixed(0)}K`;
  return `₹${amount.toLocaleString()}`;
}

/* ─────────────────────────────────────────────
   KPI Metric Card
───────────────────────────────────────────── */
function MetricCard({ label, value, trend, trendDir, context, accentColor }) {
  return (
    <div className="metric-card" style={{ borderLeft: `4px solid ${accentColor || '#E8E3DD'}` }}>
      <div className="metric-card-label">{label}</div>
      <div className="metric-card-value">{value}</div>
      {trend && (
        <div className={`metric-card-trend trend-${trendDir || 'neutral'}`}>
          {trendDir === 'up' ? '↑' : trendDir === 'down' ? '↓' : '→'} {trend}
        </div>
      )}
      {context && <div className="metric-card-context">{context}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Generate 7-day sales trend from orders
───────────────────────────────────────────── */
function buildSalesTrend(orders = []) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const now = new Date();

  // Build last 7 days from today backwards
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dayName = days[d.getDay() === 0 ? 6 : d.getDay() - 1];
    const dateStr = d.toLocaleDateString('en-IN');

    const dayRevenue = orders
      .filter(o => {
        const oDate = new Date(o.createdAt);
        return oDate.toLocaleDateString('en-IN') === dateStr &&
               o.status !== 'CANCELLED';
      })
      .reduce((sum, o) => {
        return sum + (o.lines || []).reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice || 0), 0);
      }, 0);

    result.push({ day: dayName, revenue: dayRevenue });
  }
  return result;
}

/* ─────────────────────────────────────────────
   Dashboard Page
───────────────────────────────────────────── */
export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useSWR('/dashboard', fetcher);
  const { data: salesOrders } = useSWR('/sales-orders', fetcher);
  const { data: stock }       = useSWR('/inventory/current-stock', fetcher);

  if (isLoading) {
    return (
      <div className="loading-page">
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        <span>Loading dashboard...</span>
      </div>
    );
  }

  const d = data || {
    salesOrders: { draft: 0, confirmed: 0, partiallyDelivered: 0, delivered: 0, late: 0 },
    purchaseOrders: { draft: 0, confirmed: 0, partiallyReceived: 0, received: 0, late: 0 },
    manufacturingOrders: { draft: 0, confirmed: 0, inProgress: 0, done: 0, late: 0 },
    products: { total: 0, lowStock: 0 },
    boms: { active: 0 },
  };

  const isAdmin    = user?.role === 'ADMIN';
  const isSales    = isAdmin || user?.role === 'SALES_USER' || user?.role === 'BUSINESS_OWNER';
  const isPurchase = isAdmin || user?.role === 'PURCHASE_USER' || user?.role === 'BUSINESS_OWNER';
  const isMfg      = isAdmin || user?.role === 'MFG_USER' || user?.role === 'BUSINESS_OWNER';

  // ── Computed KPI values ──────────────────────
  const allOrders   = Array.isArray(salesOrders) ? salesOrders : [];
  const totalRevenue = allOrders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + (o.lines || []).reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice || 0), 0), 0);

  const deliveredCount     = d.salesOrders?.delivered || 0;
  const totalSalesOrders   = (d.salesOrders?.draft || 0) + (d.salesOrders?.confirmed || 0) + (d.salesOrders?.partiallyDelivered || 0) + deliveredCount;
  const fulfillmentRate    = totalSalesOrders > 0 ? Math.round((deliveredCount / totalSalesOrders) * 100) : 0;

  const moDone    = d.manufacturingOrders?.done || 0;
  const moTotal   = (d.manufacturingOrders?.draft || 0) + (d.manufacturingOrders?.confirmed || 0) + (d.manufacturingOrders?.inProgress || 0) + moDone;
  const mfgEfficiency = moTotal > 0 ? Math.round((moDone / moTotal) * 100) : 0;

  const stockItems   = Array.isArray(stock) ? stock : [];
  const lowStock     = stockItems.filter(p => Number(p.freeToUseQty) < 10 && Number(p.freeToUseQty) >= 0);
  const criticalStock= stockItems.filter(p => Number(p.freeToUseQty) <= 0);
  const adequateStock= stockItems.filter(p => Number(p.freeToUseQty) >= 10).length;
  const stockHealth  = stockItems.length > 0 ? Math.round((adequateStock / stockItems.length) * 100) : 100;

  // 7-day sales trend
  const salesTrend = buildSalesTrend(allOrders);

  // Low-stock items for alerts (merge critical + low, sort by severity)
  const alertItems = [...criticalStock.map(p => ({ ...p, status: 'CRITICAL' })), ...lowStock]
    .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i); // dedupe

  // Gauge data
  const gaugeDelivered   = d.salesOrders?.delivered || 0;
  const gaugeInProgress  = (d.salesOrders?.confirmed || 0) + (d.salesOrders?.partiallyDelivered || 0);
  const gaugePending     = d.salesOrders?.draft || 0;

  // Mfg bars
  const mfgCompleted  = d.manufacturingOrders?.done || 0;
  const mfgInProgress = d.manufacturingOrders?.inProgress || 0;
  const mfgDelayed    = d.manufacturingOrders?.late || 0;

  return (
    <>
      {/* ── Page header ─────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Business Overview</h1>
          <p className="page-subtitle">
            Welcome back, {user?.name?.split(' ')[0]} — here&apos;s your snapshot for today
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isSales && (
            <Link href="/sales-orders/new" className="btn btn-primary btn-sm">
              + New Sales Order
            </Link>
          )}
          {isPurchase && !isSales && (
            <Link href="/purchase-orders/new" className="btn btn-primary btn-sm">
              + New Purchase Order
            </Link>
          )}
        </div>
      </div>

      {/* ── 4 KPI Metric Cards ────────────── */}
      <div className="metric-grid">
        <MetricCard
          label="Total Revenue"
          value={formatINR(totalRevenue)}
          trend={`${fulfillmentRate}% fulfillment`}
          trendDir={fulfillmentRate >= 70 ? 'up' : 'down'}
          context="All confirmed orders"
          accentColor="#D85A30"
        />
        <MetricCard
          label="Orders Shipped"
          value={deliveredCount}
          trend={`${fulfillmentRate}% of total`}
          trendDir={fulfillmentRate >= 70 ? 'up' : 'down'}
          context={`${totalSalesOrders} total orders`}
          accentColor="#1D9E75"
        />
        <MetricCard
          label="Mfg Efficiency"
          value={`${mfgEfficiency}%`}
          trend={`${mfgDelayed} delayed`}
          trendDir={mfgEfficiency >= 80 ? 'up' : mfgDelayed > 0 ? 'down' : 'neutral'}
          context={`${moDone} of ${moTotal} orders on time`}
          accentColor={mfgEfficiency >= 80 ? '#1D9E75' : '#BA7517'}
        />
        <MetricCard
          label="Stock Health"
          value={`${stockHealth}%`}
          trend={criticalStock.length > 0 ? `${criticalStock.length} critical` : lowStock.length > 0 ? `${lowStock.length} low` : 'All good'}
          trendDir={criticalStock.length > 0 ? 'down' : stockHealth >= 80 ? 'up' : 'neutral'}
          context={criticalStock.length > 0 ? 'Immediate reorder needed' : `${stockItems.length} products tracked`}
          accentColor={criticalStock.length > 0 ? '#E24B4A' : '#1D9E75'}
        />
      </div>

      {/* ── Row 2: Sales Trend + Fulfillment Gauge ── */}
      <div className="dashboard-grid-2">
        {/* Sales Trend Bar Chart */}
        <div className="chart-panel">
          <div className="chart-panel-title">Sales trend — Last 7 days</div>
          <div className="chart-panel-subtitle">Daily revenue from confirmed orders</div>
          <SalesTrendChart data={salesTrend} />
        </div>

        {/* Order Fulfillment Gauge */}
        <div className="chart-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="chart-panel-title">Order fulfillment — This month</div>
          <div className="chart-panel-subtitle">Breakdown by delivery status</div>
          <div style={{ padding: '1rem 0' }}>
            <FulfillmentGauge
              delivered={gaugeDelivered}
              inProgress={gaugeInProgress}
              pending={gaugePending}
            />
          </div>
        </div>
      </div>

      {/* ── Row 3: Mfg Status Bars + Low Stock Alerts ── */}
      {(isMfg || isAdmin) && (
        <div className="dashboard-grid-2">
          {/* Manufacturing Status Bars */}
          <div className="chart-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div>
                <div className="chart-panel-title">Manufacturing by status</div>
                <div className="chart-panel-subtitle">Current month production orders</div>
              </div>
              <Link href="/manufacturing-orders" style={{ fontSize: 12, fontWeight: 600, color: '#D85A30', textDecoration: 'none' }}>
                View all →
              </Link>
            </div>
            <MfgStatusBars
              completed={mfgCompleted}
              inProgress={mfgInProgress}
              delayed={mfgDelayed}
            />
          </div>

          {/* Low Stock Alerts */}
          <div className="chart-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div className="chart-panel-title">Low stock alerts</div>
                <div className="chart-panel-subtitle">Products needing replenishment</div>
              </div>
              <Link href="/inventory" style={{ fontSize: 12, fontWeight: 600, color: '#D85A30', textDecoration: 'none' }}>
                View all →
              </Link>
            </div>
            <LowStockAlerts items={alertItems} maxShow={4} />
          </div>
        </div>
      )}

      {/* ── Row 4: Module quick stats ──────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {isSales && (
          <div className="chart-panel">
            <div className="chart-panel-title" style={{ marginBottom: 12 }}>Sales orders</div>
            {[
              { label: 'Draft',               val: d.salesOrders?.draft || 0,              color: '#888780' },
              { label: 'Confirmed',           val: d.salesOrders?.confirmed || 0,          color: '#D85A30' },
              { label: 'Partially Delivered', val: d.salesOrders?.partiallyDelivered || 0, color: '#BA7517' },
              { label: 'Delivered',           val: d.salesOrders?.delivered || 0,          color: '#1D9E75' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #F2EDE6' }}>
                <span style={{ fontSize: 13, color: '#888780' }}>{row.label}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: row.color }}>{row.val}</span>
              </div>
            ))}
            <Link href="/sales-orders" style={{ display: 'block', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#D85A30', textDecoration: 'none', marginTop: 10 }}>
              Open Sales Orders →
            </Link>
          </div>
        )}

        {isPurchase && (
          <div className="chart-panel">
            <div className="chart-panel-title" style={{ marginBottom: 12 }}>Purchase orders</div>
            {[
              { label: 'Draft',               val: d.purchaseOrders?.draft || 0,            color: '#888780' },
              { label: 'Confirmed',           val: d.purchaseOrders?.confirmed || 0,        color: '#D85A30' },
              { label: 'Partially Received',  val: d.purchaseOrders?.partiallyReceived || 0,color: '#BA7517' },
              { label: 'Received',            val: d.purchaseOrders?.received || 0,         color: '#1D9E75' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #F2EDE6' }}>
                <span style={{ fontSize: 13, color: '#888780' }}>{row.label}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: row.color }}>{row.val}</span>
              </div>
            ))}
            <Link href="/purchase-orders" style={{ display: 'block', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#D85A30', textDecoration: 'none', marginTop: 10 }}>
              Open Purchase Orders →
            </Link>
          </div>
        )}

        <div className="chart-panel">
          <div className="chart-panel-title" style={{ marginBottom: 12 }}>Products & BoMs</div>
          {[
            { label: 'Total Products', val: d.products?.total || 0,  color: '#2C2C2A' },
            { label: 'Low Stock',      val: d.products?.lowStock || 0, color: (d.products?.lowStock || 0) > 0 ? '#E24B4A' : '#1D9E75' },
            { label: 'Active BoMs',    val: d.boms?.active || 0,      color: '#1D9E75' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #F2EDE6' }}>
              <span style={{ fontSize: 13, color: '#888780' }}>{row.label}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: row.color }}>{row.val}</span>
            </div>
          ))}
          <Link href="/products" style={{ display: 'block', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#D85A30', textDecoration: 'none', marginTop: 10 }}>
            Manage Products →
          </Link>
        </div>
      </div>
    </>
  );
}
