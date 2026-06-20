import './globals.css';

import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/lib/toast-context';
import AppShell from '@/components/layout/AppShell';

export const metadata = {
  title: 'Shiv Furniture Works — Mini ERP',
  description: 'From Demand to Delivery — Sales, Purchase, Manufacturing & Inventory Management',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
