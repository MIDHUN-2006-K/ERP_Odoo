'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

export default function TopBar({ title }) {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!user) return null;

  const initials = user.name
    ?.split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const roleBadge = {
    ADMIN: 'Administrator',
    SALES_USER: 'Sales',
    PURCHASE_USER: 'Purchase',
    MFG_USER: 'Manufacturing',
    INVENTORY_MANAGER: 'Inventory',
    BUSINESS_OWNER: 'Owner',
  }[user.role] || user.role;

  return (
    <header className="topbar">
      <div className="topbar-title">{title || 'Dashboard'}</div>

      <div className="topbar-actions">
        <span style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--accent)',
          background: 'var(--accent-subtle)',
          padding: '2px 10px',
          borderRadius: 'var(--radius-full)',
          fontWeight: 600,
          border: '1px solid rgba(216,90,48,0.25)',
        }}>
          {roleBadge}
        </span>

        <div className="user-menu" ref={dropdownRef}>
          <div
            className="user-avatar"
            onClick={() => setShowDropdown(!showDropdown)}
            title={user.name}
          >
            {initials}
          </div>

          {showDropdown && (
            <div className="user-dropdown">
              <div style={{
                padding: 'var(--space-3)',
                borderBottom: '1px solid var(--border-subtle)',
                marginBottom: 'var(--space-1)',
              }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{user.name}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{user.email}</div>
              </div>

              <Link href="/profile" className="user-dropdown-item" onClick={() => setShowDropdown(false)}>
                👤 My Profile
              </Link>

              <button className="user-dropdown-item danger" onClick={logout}>
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
