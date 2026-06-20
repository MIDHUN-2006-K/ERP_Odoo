'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const NAV_ITEMS = [
  { section: 'Overview', items: [
    { label: 'Dashboard',          href: '/',                     module: 'DASHBOARD' },
  ]},
  { section: 'Operations', items: [
    { label: 'Sales Orders',       href: '/sales-orders',         module: 'SALES_ORDERS' },
    { label: 'Purchase Orders',    href: '/purchase-orders',      module: 'PURCHASE_ORDERS' },
    { label: 'Manufacturing',      href: '/manufacturing-orders', module: 'MANUFACTURING_ORDERS' },
  ]},
  { section: 'Catalog', items: [
    { label: 'Products',           href: '/products',             module: 'PRODUCTS' },
    { label: 'Bills of Materials', href: '/boms',                 module: 'BOMS' },
  ]},
  { section: 'Partners', items: [
    { label: 'Customers',          href: '/customers',            module: 'CUSTOMERS' },
    { label: 'Vendors',            href: '/vendors',              module: 'VENDORS' },
  ]},
  { section: 'Warehouse', items: [
    { label: 'Inventory',          href: '/inventory',            module: 'INVENTORY' },
  ]},
  { section: 'System', items: [
    { label: 'Activity Feed',      href: '/audit-logs',           module: 'AUDIT_LOGS', adminOnly: true },
    { label: 'Users',              href: '/users',                module: 'USERS',      adminOnly: true },
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
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                  >
                    {item.label}
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
        Shiv Furniture Works · v1.0
      </div>
    </aside>
  );
}
