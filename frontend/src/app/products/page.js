'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const CATEGORIES = [
  { value: null,            label: 'All',           color: '#888780' },
  { value: 'RAW_MATERIAL',  label: 'Raw Material',  color: '#BA7517' },
  { value: 'COMPONENT',     label: 'Component',     color: '#6366f1' },
  { value: 'CONSUMABLE',    label: 'Consumable',    color: '#0ea5e9' },
  { value: 'FINISHED_GOOD', label: 'Finished Good', color: '#1D9E75' },
];

const PROC_LABELS = {
  PURCHASE: 'Buy',
  MANUFACTURING: 'Make',
};

const PROC_COLORS = {
  PURCHASE: '#D85A30',
  MANUFACTURING: '#6366f1',
};

function ProductCard({ product }) {
  const catDef    = CATEGORIES.find(c => c.value === product.category) || CATEGORIES[0];
  const onHand    = Number(product.onHandQty);
  const free      = Number(product.freeToUseQty ?? (onHand - Number(product.reservedQty)));
  const reorder   = Number(product.reorderPoint);
  const isLow     = product.isLowStock || (reorder > 0 && onHand <= reorder);
  const stockColor = free <= 0 ? '#E24B4A' : isLow ? '#BA7517' : '#1D9E75';

  return (
    <Link href={`/products/${product.id}`} className="stock-card" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {product.name}
          </div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 2 }}>
            {product.sku}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
          {product.category && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: `${catDef.color}15`, color: catDef.color,
            }}>{catDef.label}</span>
          )}
          {product.procurementType && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: `${PROC_COLORS[product.procurementType] || '#888'}15`,
              color: PROC_COLORS[product.procurementType] || '#888',
            }}>{PROC_LABELS[product.procurementType] || product.procurementType}</span>
          )}
        </div>
      </div>

      {/* Stock bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            <span>Stock</span>
            <span style={{ fontWeight: 700, color: stockColor }}>{onHand} on hand</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
            {reorder > 0 && (
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${Math.min(100, (onHand / (reorder * 3)) * 100)}%`,
                background: stockColor,
                transition: 'width 0.4s ease',
              }} />
            )}
            {reorder === 0 && onHand > 0 && (
              <div style={{ height: '100%', borderRadius: 3, width: '100%', background: '#1D9E75' }} />
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: stockColor, lineHeight: 1 }}>{free}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Free</div>
        </div>
      </div>

      {/* Pricing row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
        {Number(product.salesPrice) > 0 && (
          <span>Sales: <strong style={{ color: 'var(--text-primary)' }}>₹{Number(product.salesPrice).toLocaleString()}</strong></span>
        )}
        <span>Cost: <strong style={{ color: 'var(--text-primary)' }}>₹{Number(product.costPrice).toLocaleString()}</strong></span>
        {product.defaultVendor && (
          <span style={{ fontSize: 11 }}>Vendor: {product.defaultVendor.name}</span>
        )}
      </div>

      {/* Active BoM indicator */}
      {product.defaultBom && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#1D9E75', fontWeight: 600 }}>
          BoM v{product.defaultBom.version} active
        </div>
      )}

      {/* Low stock warning */}
      {isLow && (
        <div style={{
          marginTop: 8, fontSize: 11, fontWeight: 700,
          color: free <= 0 ? '#E24B4A' : '#BA7517',
        }}>
          {free <= 0 ? '⚠ Out of stock' : '⚠ Low stock'}
        </div>
      )}
    </Link>
  );
}

export default function ProductsPage() {
  const { data: products, isLoading } = useSWR('/products', fetcher);
  const [activeCat, setActiveCat]     = useState(null);
  const [search, setSearch]           = useState('');

  if (isLoading) return <div className="loading-page"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  const allProducts = products || [];
  const filtered    = allProducts.filter(p => {
    if (activeCat && p.category !== activeCat) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
    }
    return true;
  });

  // Summary counts
  const catCounts = CATEGORIES.slice(1).map(c => ({
    ...c,
    count: allProducts.filter(p => p.category === c.value).length,
  }));
  const lowStockCount = allProducts.filter(p => p.isLowStock).length;
  const uncategorized  = allProducts.filter(p => !p.category).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">
            {allProducts.length} products
            {lowStockCount > 0 && (
              <span style={{ color: '#E24B4A', fontWeight: 700, marginLeft: 8 }}>
                · {lowStockCount} low stock
              </span>
            )}
          </p>
        </div>
        <Link href="/products/new" className="btn btn-primary">+ New Product</Link>
      </div>

      {/* Category filter pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {CATEGORIES.map(cat => {
          const isActive = activeCat === cat.value;
          const count    = cat.value === null ? allProducts.length : catCounts.find(c => c.value === cat.value)?.count || 0;

          return (
            <button
              key={cat.label}
              onClick={() => setActiveCat(cat.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: 'none',
                background: isActive ? `${cat.color}18` : 'var(--bg-secondary)',
                color: isActive ? cat.color : 'var(--text-secondary)',
                transition: 'all 0.2s',
              }}
            >
              {cat.label}
              <span style={{
                background: isActive ? cat.color : 'var(--text-muted)',
                color: '#fff', borderRadius: 999, padding: '0 6px', fontSize: 10, fontWeight: 800,
              }}>{count}</span>
            </button>
          );
        })}
        {uncategorized > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 8 }}>
            {uncategorized} uncategorized
          </span>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          className="table-search"
          placeholder="Search by name or SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 320 }}
        />
      </div>

      {/* Product cards grid */}
      {filtered.length === 0 ? (
        <div className="table-empty" style={{ marginTop: 32 }}>
          {search ? 'No products match your search' : 'No products in this category'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {filtered.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </>
  );
}
