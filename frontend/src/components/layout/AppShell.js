'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/products': 'Products',
  '/sales-orders': 'Sales Orders',
  '/purchase-orders': 'Purchase Orders',
  '/manufacturing-orders': 'Manufacturing Orders',
  '/boms': 'Bills of Materials',
  '/customers': 'Customers',
  '/vendors': 'Vendors',
  '/inventory': 'Inventory',
  '/audit-logs': 'Audit Logs',
  '/users': 'User Management',
  '/profile': 'My Profile',
};


const PUBLIC_ROUTES = ['/login', '/signup'];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const router = useRouter();

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (!loading && !user && !isPublicRoute) {
      router.push('/login');
    }
  }, [user, loading, isPublicRoute, router]);

  // Loading state
  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }}></div>
        <span>Loading...</span>
      </div>
    );
  }

  // Public routes — no sidebar/topbar
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Not logged in — redirect handled by useEffect
  if (!user) {
    return (
      <div className="loading-page">
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }}></div>
        <span>Redirecting to login...</span>
      </div>
    );
  }

  // Get page title from path
  const baseRoute = '/' + (pathname.split('/')[1] || '');
  const title = PAGE_TITLES[baseRoute] || 'Shiv ERP';

  return (
    <div className="app-layout">
      <Sidebar />
      <TopBar title={title} />
      <main className="main-content">
        <div className="page-container">
          {children}
        </div>
      </main>
    </div>
  );
}
