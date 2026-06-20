'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');
    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        api.clearTokens();
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (loginId, password) => {
    const data = await api.post('/auth/login', { loginId, password });
    api.setTokens(data.accessToken, data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    router.push('/');
    return data;
  }, [router]);

  const signup = useCallback(async (name, email, password) => {
    const data = await api.post('/auth/signup', { name, email, password });
    api.setTokens(data.accessToken, data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    router.push('/');
    return data;
  }, [router]);

  const logout = useCallback(() => {
    api.clearTokens();
    setUser(null);
    router.push('/login');
  }, [router]);

  const hasAccess = useCallback((module, action = 'READ') => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;

    const matrix = {
      SALES_USER: {
        PRODUCTS: ['READ'], CUSTOMERS: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
        SALES_ORDERS: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'CONFIRM', 'CANCEL'],
        DASHBOARD: ['READ'],
      },
      PURCHASE_USER: {
        PRODUCTS: ['READ'], VENDORS: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
        PURCHASE_ORDERS: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'CONFIRM', 'CANCEL'],
        DASHBOARD: ['READ'],
      },
      MFG_USER: {
        PRODUCTS: ['READ'],
        BOMS: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
        MANUFACTURING_ORDERS: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'CONFIRM', 'CANCEL'],
        DASHBOARD: ['READ'],
      },
      INVENTORY_MANAGER: {
        PRODUCTS: ['READ'],
        SALES_ORDERS: ['READ'], PURCHASE_ORDERS: ['READ'], MANUFACTURING_ORDERS: ['READ'],
        INVENTORY: ['READ', 'CREATE', 'UPDATE', 'ADJUST'],
        DASHBOARD: ['READ'],
      },
      BUSINESS_OWNER: {
        PRODUCTS: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
        CUSTOMERS: ['READ'], VENDORS: ['READ'],
        SALES_ORDERS: ['READ'], PURCHASE_ORDERS: ['READ'], MANUFACTURING_ORDERS: ['READ'],
        BOMS: ['READ'], INVENTORY: ['READ'],
        DASHBOARD: ['READ'],
      },
    };

    const rolePerms = matrix[user.role];
    if (!rolePerms) return false;
    const modulePerms = rolePerms[module];
    if (!modulePerms) return false;
    return modulePerms.includes(action);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, hasAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
