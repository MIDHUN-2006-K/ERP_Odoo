'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const NAV_ITEMS = [
  { section: 'Overview', items: [
    { label: 'Dashboard', href: '/', icon: '📊', module: 'DASHBOARD' },
  ]},
  { section: 'Operations', items: [
    { label: 'Sales Orders', href: '/sales-orders', icon: '🛒', module: 'SALES_ORDERS' },
    { label: 'Purchase Orders', href: '/purchase-orders', icon: '📦', module: 'PURCHASE_ORDERS' },
    { label: 'Manufacturing', href: '/manufacturing-orders', icon: '🏭', module: 'MANUFACTURING_ORDERS' },
  ]},
  { section: 'Catalog', items: [
    { label: 'Products', href: '/products', icon: '📋', module: 'PRODUCTS' },
    { label: 'Bills of Materials', href: '/boms', icon: '📐', module: 'BOMS' },
  ]},
  { section: 'Partners', items: [
    { label: 'Customers', href: '/customers', icon: '👥', module: 'CUSTOMERS' },
    { label: 'Vendors', href: '/vendors', icon: '🏪', module: 'VENDORS' },
  ]},
  { section: 'Warehouse', items: [
    { label: 'Inventory', href: '/inventory', icon: '📦', module: 'INVENTORY' },
  ]},
  { section: 'System', items: [
    { label: 'Audit Logs', href: '/audit-logs', icon: '📜', module: 'AUDIT_LOGS', adminOnly: true },
    { label: 'Users', href: '/users', icon: '⚙️', module: 'USERS', adminOnly: true },
  ]},
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, hasAccess } = useAuth();

  if (!user) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">S</div>
        <div className="sidebar-title">Shiv Furniture</div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((section) => {
          const visibleItems = section.items.filter((item) => {
            if (item.adminOnly && user.role !== 'ADMIN') return false;
            return hasAccess(item.module, 'READ');
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.section}>
              <div className="nav-section-label">{section.section}</div>
              {visibleItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                  >
                    <span className="nav-item-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div style={{
        padding: 'var(--space-4)',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)',
        textAlign: 'center',
      }}>
        Shiv Furniture Works ERP · v1.0
      </div>
    </aside>
  );
}
