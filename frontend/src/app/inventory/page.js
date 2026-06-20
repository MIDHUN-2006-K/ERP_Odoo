'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useToast } from '@/lib/toast-context';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0)  return `${days} day${days !== 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (mins > 0)  return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  return 'Just now';
}

function StockHealthBar({ free, reserved, total }) {
  if (total <= 0) return (
    <div style={{ height: 8, borderRadius: 999, background: '#F2EDE6', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: '100%', background: '#E24B4A', borderRadius: 999 }} />
    </div>
  );
  const freePct = Math.round((free / total) * 100);
  const resPct  = Math.round((reserved / total) * 100);

  return (
    <div>
      <div className="stock-seg-bar">
        <div className="stock-seg-free"     style={{ width: `${freePct}%` }} />
        <div className="stock-seg-reserved" style={{ width: `${resPct}%` }} />
      </div>
      <div className="stock-bar-labels">
        <span>
          <span className="stock-bar-lbl-dot" style={{ background: '#1D9E75' }} />
          Free ({free})
        </span>
        {reserved > 0 && (
          <span>
            <span className="stock-bar-lbl-dot" style={{ background: '#BA7517' }} />
            Reserved ({reserved})
          </span>
        )}
      </div>
    </div>
  );
}

function StockCard({ product, onViewLedger }) {
  const onHand   = Number(product.onHandQty || 0);
  const reserved = Number(product.reservedQty || 0);
  const free     = Number(product.freeToUseQty || 0);

  const healthColor = free <= 0 ? '#E24B4A' : free < 10 ? '#BA7517' : '#1D9E75';
  const statusLabel = free <= 0 ? 'Critical' : free < 10 ? 'Low stock' : 'Adequate';

  return (
    <div className="stock-card">
      <div className="stock-card-header">
        <div>
          <div className="stock-card-name">{product.name}</div>
          <div className="stock-card-meta">
            {product.sku && <span style={{ fontFamily: 'var(--font-mono)', marginRight: 8 }}>{product.sku}</span>}
            {product.category && <span>{product.category}</span>}
            {product.uom && <span> · {product.uom}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 700,
            padding: '2px 8px', borderRadius: 999,
            background: `${healthColor}18`, color: healthColor,
          }}>
            {statusLabel}
          </span>
          {product.salePrice && (
            <div style={{ fontSize: 12, color: '#888780', marginTop: 4 }}>
              ₹{Number(product.salePrice).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      <div className="stock-card-numbers">
        <div className="stock-num-item">
          <div className="stock-num-val">{onHand}</div>
          <div className="stock-num-lbl">On Hand</div>
        </div>
        <div className="stock-num-item">
          <div className="stock-num-val" style={{ color: '#BA7517' }}>{reserved}</div>
          <div className="stock-num-lbl">Reserved</div>
        </div>
        <div className="stock-num-item">
          <div className="stock-num-val" style={{ color: healthColor }}>{free}</div>
          <div className="stock-num-lbl">Free to Use</div>
        </div>
      </div>

      <StockHealthBar free={free} reserved={reserved} total={onHand} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        {product.updatedAt && (
          <span style={{ fontSize: 11, color: '#B4B2A9' }}>
            Updated {timeAgo(product.updatedAt)}
          </span>
        )}
        <button
          onClick={() => onViewLedger(product)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, color: '#D85A30', padding: 0,
          }}
        >
          View ledger →
        </button>
      </div>
    </div>
  );
}

function LedgerTimeline({ entries }) {
  if (!entries || entries.length === 0) {
    return <div style={{ color: '#888780', fontSize: 13, padding: '1rem 0' }}>No stock movements found</div>;
  }

  return (
    <div className="ledger-timeline">
      {entries.map((entry, i) => {
        const qty      = Number(entry.quantity);
        const positive = qty > 0;
        const time     = new Date(entry.createdAt);
        const label    = entry.movementType?.replace(/_/g, ' ').toLowerCase() || '';
        const refDoc   = entry.referenceType && entry.referenceId
                         ? `${entry.referenceType} #${entry.referenceId}` : null;

        return (
          <div key={i} className="ledger-entry">
            <div className={`ledger-qty ${positive ? 'positive' : 'negative'}`}>
              {positive ? '+' : ''}{qty}
            </div>
            <div className="ledger-body">
              <div className="ledger-desc">
                {entry.product?.name && <strong>{entry.product.name}</strong>}
                {' '}{label}
                {refDoc && <span style={{ color: '#888780' }}> via {refDoc}</span>}
              </div>
              <div className="ledger-meta">
                Balance after: <strong>{Number(entry.balanceAfter)}</strong>
                {entry.createdByUser?.name && ` · ${entry.createdByUser.name}`}
              </div>
            </div>
            <div className="ledger-time">
              {time.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              {' '}
              {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function InventoryPage() {
  const [tab, setTab]               = useState('stock');
  const [search, setSearch]         = useState('');
  const [filterHealth, setFilter]   = useState('all'); // all / critical / low / adequate
  const [selectedProduct, setSelected] = useState(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjForm, setAdjForm]       = useState({ productId: '', quantity: 0, reason: '' });
  const [saving, setSaving]         = useState(false);

  const { data: stock,  isLoading: stockLoading  } = useSWR('/inventory/current-stock', fetcher);
  const { data: ledger, isLoading: ledgerLoading } = useSWR(
    tab === 'ledger' ? '/inventory/stock-ledger' : null, fetcher
  );
  const toast = useToast();

  async function handleAdjust(e) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/inventory/adjust', {
        productId: Number(adjForm.productId),
        quantity:  Number(adjForm.quantity),
        reason:    adjForm.reason,
      });
      toast.success('Stock adjusted');
      setShowAdjust(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const allStock = Array.isArray(stock) ? stock : [];

  // Filter + search
  const filtered = allStock.filter(p => {
    const free = Number(p.freeToUseQty);
    const matchHealth =
      filterHealth === 'all'      ? true :
      filterHealth === 'critical' ? free <= 0 :
      filterHealth === 'low'      ? (free > 0 && free < 10) :
      /* adequate */                free >= 10;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q)  ||
      p.category?.toLowerCase().includes(q);
    return matchHealth && matchSearch;
  });

  const critCount = allStock.filter(p => Number(p.freeToUseQty) <= 0).length;
  const lowCount  = allStock.filter(p => Number(p.freeToUseQty) > 0 && Number(p.freeToUseQty) < 10).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">
            {allStock.length} products
            {critCount > 0 && <span style={{ color: '#E24B4A' }}> · {critCount} critical</span>}
            {lowCount  > 0 && <span style={{ color: '#BA7517' }}> · {lowCount} low</span>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdjust(true)}>
          Stock Adjustment
        </button>
      </div>

      {/* Tab switcher */}
      <div className="filter-pills" style={{ marginBottom: 'var(--space-4)' }}>
        <button className={`filter-pill ${tab === 'stock' ? 'active' : ''}`} onClick={() => setTab('stock')}>
          Current Stock
        </button>
        <button className={`filter-pill ${tab === 'ledger' ? 'active' : ''}`} onClick={() => setTab('ledger')}>
          Stock Ledger
        </button>
      </div>

      {/* ── Current Stock tab ──────────────────── */}
      {tab === 'stock' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="table-search"
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 240 }}
            />
            <div className="filter-pills" style={{ margin: 0 }}>
              {[
                { label: 'All',       value: 'all' },
                { label: 'Critical',  value: 'critical' },
                { label: 'Low',       value: 'low' },
                { label: 'Adequate',  value: 'adequate' },
              ].map(f => (
                <button
                  key={f.value}
                  className={`filter-pill ${filterHealth === f.value ? 'active' : ''}`}
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {stockLoading ? (
            <div className="loading-page"><div className="spinner" style={{ width: 32, height: 32 }} /></div>
          ) : filtered.length === 0 ? (
            <div className="table-empty">No products match your filter</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 14 }}>
              {filtered.map(p => (
                <StockCard
                  key={p.id}
                  product={p}
                  onViewLedger={(prod) => { setSelected(prod); setTab('ledger'); }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Stock Ledger tab ───────────────────── */}
      {tab === 'ledger' && (
        <div className="chart-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div className="chart-panel-title">
                Stock Ledger {selectedProduct ? `— ${selectedProduct.name}` : ''}
              </div>
              <div className="chart-panel-subtitle">All stock movements, newest first</div>
            </div>
            {selectedProduct && (
              <button
                onClick={() => setSelected(null)}
                className="btn btn-ghost btn-sm"
              >
                Clear filter
              </button>
            )}
          </div>

          {ledgerLoading ? (
            <div className="loading-page"><div className="spinner" style={{ width: 24, height: 24 }} /></div>
          ) : (
            <LedgerTimeline
              entries={(ledger || []).filter(e =>
                !selectedProduct || e.product?.id === selectedProduct.id
              )}
            />
          )}
        </div>
      )}

      {/* ── Stock Adjustment modal ─────────────── */}
      {showAdjust && (
        <div className="modal-overlay" onClick={() => setShowAdjust(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Stock Adjustment</h3>
            <form onSubmit={handleAdjust} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Product *</label>
                <select
                  className="form-select"
                  value={adjForm.productId}
                  onChange={e => setAdjForm(p => ({ ...p, productId: e.target.value }))}
                  required
                >
                  <option value="">Select product</option>
                  {allStock.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — On Hand: {Number(p.onHandQty)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity (positive to add, negative to subtract) *</label>
                <input
                  className="form-input"
                  type="number"
                  value={adjForm.quantity}
                  onChange={e => setAdjForm(p => ({ ...p, quantity: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Reason *</label>
                <textarea
                  className="form-textarea"
                  value={adjForm.reason}
                  onChange={e => setAdjForm(p => ({ ...p, reason: e.target.value }))}
                  required rows={2}
                  placeholder="e.g. Physical count adjustment, damaged goods"
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAdjust(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Adjusting...' : 'Submit Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
