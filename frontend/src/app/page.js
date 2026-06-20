'use client';

import { useAuth } from '@/lib/auth-context';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import Link from 'next/link';

// Stat card renders a number + label with a semantic left-bar color
function StatCard({ value, label, colorClass, href, icon, subtitle }) {
  const content = (
    <div className={`stat-card ${colorClass || ''}`} style={{ position: 'relative' }}>
      {icon && (
        <div style={{
          fontSize: 22,
          marginBottom: 'var(--space-3)',
          opacity: 0.7,
        }}>{icon}</div>
      )}
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
      {subtitle && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4, paddingLeft: 4 }}>
          {subtitle}
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{content}</Link>;
  }
  return content;
}

function ModuleSection({ title, icon, stats, basePath }) {
  return (
    <div style={{ marginBottom: 'var(--space-8)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-4)',
      }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <h3 style={{
          fontSize: 'var(--text-md)',
          fontWeight: 700,
          color: 'var(--text-primary)',
        }}>{title}</h3>
      </div>
      <div className="stats-grid">
        {stats.map((s, i) => (
          <StatCard
            key={i}
            value={s.value}
            label={s.label}
            colorClass={s.color}
            href={s.href || (basePath && s.status ? `${basePath}?status=${s.status}` : s.href)}
            icon={s.icon}
            subtitle={s.subtitle}
          />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useSWR('/dashboard', fetcher);

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

  const isAdmin = user?.role === 'ADMIN';
  const isSales = isAdmin || user?.role === 'SALES_USER' || user?.role === 'BUSINESS_OWNER';
  const isPurchase = isAdmin || user?.role === 'PURCHASE_USER' || user?.role === 'BUSINESS_OWNER';
  const isMfg = isAdmin || user?.role === 'MFG_USER' || user?.role === 'BUSINESS_OWNER';

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">Here&apos;s your business snapshot for today</p>
        </div>

        {/* Quick action */}
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
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

      {isSales && (
        <ModuleSection
          title="Sales Orders"
          icon="🛒"
          basePath="/sales-orders"
          stats={[
            { value: d.salesOrders?.draft, label: 'Draft', color: '', status: 'DRAFT', icon: '📝' },
            { value: d.salesOrders?.confirmed, label: 'Confirmed', color: 'accent', status: 'CONFIRMED', icon: '✅' },
            { value: d.salesOrders?.partiallyDelivered, label: 'Part. Delivered', color: 'warning', status: 'PARTIALLY_DELIVERED', icon: '📦' },
            { value: d.salesOrders?.delivered, label: 'Delivered', color: 'success', status: 'FULLY_DELIVERED', icon: '🚚' },
            { value: d.salesOrders?.late, label: 'Late / Overdue', color: 'error', status: 'LATE', icon: '⚠️' },
          ]}
        />
      )}

      {isPurchase && (
        <ModuleSection
          title="Purchase Orders"
          icon="📦"
          basePath="/purchase-orders"
          stats={[
            { value: d.purchaseOrders?.draft, label: 'Draft', color: '', status: 'DRAFT', icon: '📝' },
            { value: d.purchaseOrders?.confirmed, label: 'Confirmed', color: 'accent', status: 'CONFIRMED', icon: '✅' },
            { value: d.purchaseOrders?.partiallyReceived, label: 'Part. Received', color: 'warning', status: 'PARTIALLY_RECEIVED', icon: '📥' },
            { value: d.purchaseOrders?.received, label: 'Received', color: 'success', status: 'FULLY_RECEIVED', icon: '✔️' },
            { value: d.purchaseOrders?.late, label: 'Late', color: 'error', status: 'LATE', icon: '⚠️' },
          ]}
        />
      )}

      {isMfg && (
        <ModuleSection
          title="Manufacturing Orders"
          icon="🏭"
          basePath="/manufacturing-orders"
          stats={[
            { value: d.manufacturingOrders?.draft, label: 'Draft', color: '', status: 'DRAFT', icon: '📝' },
            { value: d.manufacturingOrders?.confirmed, label: 'Confirmed', color: 'accent', status: 'CONFIRMED', icon: '✅' },
            { value: d.manufacturingOrders?.inProgress, label: 'In Progress', color: 'warning', status: 'IN_PROGRESS', icon: '⚙️' },
            { value: d.manufacturingOrders?.done, label: 'Completed', color: 'success', status: 'DONE', icon: '🏆' },
            { value: d.manufacturingOrders?.late, label: 'Late', color: 'error', status: 'LATE', icon: '⚠️' },
          ]}
        />
      )}

      {/* Products + BoMs summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
        <ModuleSection
          title="Products & Stock"
          icon="📋"
          stats={[
            { value: d.products?.total, label: 'Total Products', color: 'info', href: '/products', icon: '🗄️' },
            { value: d.products?.lowStock, label: 'Low Stock', color: 'error', href: '/inventory', icon: '⚡', subtitle: d.products?.lowStock > 0 ? 'Needs replenishment' : 'All stocked' },
          ]}
        />
        <ModuleSection
          title="Bills of Materials"
          icon="📐"
          stats={[
            { value: d.boms?.active, label: 'Active BoMs', color: 'success', href: '/boms', icon: '📋' },
          ]}
        />
      </div>
    </>
  );
}
