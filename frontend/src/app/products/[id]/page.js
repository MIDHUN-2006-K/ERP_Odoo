'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import Link from 'next/link';

/* ─── Constants ────────────────────────────────────────── */

const CATEGORIES = [
  { value: 'RAW_MATERIAL',  label: 'Raw Material',  color: '#BA7517', desc: 'Purchased from vendors, consumed in manufacturing' },
  { value: 'COMPONENT',     label: 'Component',     color: '#6366f1', desc: 'Intermediate part — bought or manufactured' },
  { value: 'CONSUMABLE',    label: 'Consumable',    color: '#0ea5e9', desc: 'Used during production, not sold directly' },
  { value: 'FINISHED_GOOD', label: 'Finished Good', color: '#1D9E75', desc: 'Final product sold to customers' },
];

const CAT_META = {
  RAW_MATERIAL:  { canHaveBom: false, showSalesPrice: false, showStrategy: false, defaultProcType: 'PURCHASE', showProcType: false, showProcureOnDemand: false },
  COMPONENT:     { canHaveBom: true,  showSalesPrice: false, showStrategy: false, defaultProcType: null,       showProcType: true,  showProcureOnDemand: true  },
  CONSUMABLE:    { canHaveBom: false, showSalesPrice: false, showStrategy: false, defaultProcType: 'PURCHASE', showProcType: false, showProcureOnDemand: false },
  FINISHED_GOOD: { canHaveBom: true,  showSalesPrice: true,  showStrategy: true,  defaultProcType: null,       showProcType: true,  showProcureOnDemand: true  },
};

// What categories can be used as BoM components
const BOM_COMPONENT_RULES = {
  FINISHED_GOOD: ['COMPONENT', 'RAW_MATERIAL', 'CONSUMABLE'],
  COMPONENT:     ['COMPONENT', 'RAW_MATERIAL', 'CONSUMABLE'],
};

const MOVEMENT_LABELS = {
  PURCHASE_RECEIPT: 'Purchase Receipt',
  SALE_DELIVERY: 'Sales Delivery',
  MO_CONSUMPTION: 'Mfg Consumption',
  MO_PRODUCTION: 'Mfg Production',
  ADJUSTMENT: 'Adjustment',
  PROCUREMENT_REPLENISHMENT: 'Replenishment',
};

const MOVEMENT_COLORS = {
  PURCHASE_RECEIPT: '#1D9E75',
  SALE_DELIVERY: '#E24B4A',
  MO_CONSUMPTION: '#BA7517',
  MO_PRODUCTION: '#6366f1',
  ADJUSTMENT: '#888780',
  PROCUREMENT_REPLENISHMENT: '#0ea5e9',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86400000);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/* ─── Category Selector ──────────────────────────────── */

function CategorySelector({ value, onChange, disabled }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
      {CATEGORIES.map(cat => {
        const active = value === cat.value;
        return (
          <button
            key={cat.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(cat.value)}
            style={{
              padding: '14px 12px', borderRadius: 10, cursor: disabled ? 'default' : 'pointer',
              border: active ? `2px solid ${cat.color}` : '1.5px solid var(--border-subtle)',
              background: active ? `${cat.color}0C` : 'var(--bg-primary)',
              transition: 'all 0.2s ease',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: active ? cat.color : 'var(--border-subtle)',
                transition: 'all 0.2s',
              }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: active ? cat.color : 'var(--text-primary)' }}>
                {cat.label}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {cat.desc}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Inline BoM Builder ─────────────────────────────── */

function InlineBomBuilder({ product, productId, allProducts, workCenters, category, mutate, toast }) {
  const [selectedBomId, setSelectedBomId] = useState('');
  const [editing, setEditing] = useState(false);
  const [components, setComponents] = useState([]);
  const [operations, setOperations] = useState([]);
  const [saving, setSaving] = useState(false);

  // Initialize and keep selectedBomId valid
  useEffect(() => {
    if (product?.boms?.length > 0) {
      const exists = product.boms.some(b => String(b.id) === selectedBomId);
      if (!exists) {
        const activeId = product.defaultBomId || product.defaultBom?.id;
        setSelectedBomId(activeId ? String(activeId) : String(product.boms[0].id));
      }
    } else {
      setSelectedBomId('');
    }
  }, [product]);

  const currentBom = (product?.boms || []).find(b => String(b.id) === selectedBomId);

  useEffect(() => {
    if (currentBom) {
      setComponents((currentBom.components || []).map(c => ({
        componentProductId: String(c.componentProductId),
        quantityPerUnit:    Number(c.quantityPerUnit),
      })));
      setOperations((currentBom.operations || []).map(op => ({
        sequence:        op.sequence,
        operationName:   op.operationName,
        workCenterId:    String(op.workCenterId),
        durationMinutes: op.durationMinutes,
      })));
    } else {
      setComponents([{ componentProductId: '', quantityPerUnit: 1 }]);
      setOperations([]);
    }
  }, [currentBom]);

  const allowedCategories = BOM_COMPONENT_RULES[category] || [];
  const filteredProducts = (allProducts || []).filter(p =>
    p.id !== productId && allowedCategories.includes(p.category)
  );

  function addComponent()    { setComponents(c => [...c, { componentProductId: '', quantityPerUnit: 1 }]); }
  function removeComponent(i){ setComponents(c => c.filter((_, idx) => idx !== i)); }
  function updateComponent(i, field, val) {
    setComponents(c => c.map((comp, idx) => idx === i ? { ...comp, [field]: val } : comp));
  }

  function addOperation()    { setOperations(o => [...o, { sequence: o.length + 1, operationName: '', workCenterId: '', durationMinutes: 30 }]); }
  function removeOperation(i){ setOperations(o => o.filter((_, idx) => idx !== i)); }
  function updateOperation(i, field, val) {
    setOperations(o => o.map((op, idx) => idx === i ? { ...op, [field]: val } : op));
  }

  async function handleSaveBom() {
    const validComps = components.filter(c => c.componentProductId);
    if (validComps.length === 0) { toast.error('Add at least one component'); return; }
    setSaving(true);
    try {
      const payload = {
        components: validComps.map(c => ({ componentProductId: Number(c.componentProductId), quantityPerUnit: Number(c.quantityPerUnit) })),
        operations: operations.filter(op => op.operationName && op.workCenterId).map(op => ({
          sequence: Number(op.sequence), operationName: op.operationName,
          workCenterId: Number(op.workCenterId), durationMinutes: Number(op.durationMinutes),
        })),
      };

      if (currentBom && currentBom.status === 'DRAFT') {
        await api.patch(`/boms/${currentBom.id}`, payload);
        toast.success('BoM updated');
      } else {
        const bom = await api.post('/boms', { productId, ...payload });
        toast.success('BoM created (DRAFT)');
        setSelectedBomId(String(bom.id));
      }
      setEditing(false);
      mutate();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleActivateBom() {
    if (currentBom?.status === 'DRAFT') {
      try {
        await api.post(`/boms/${currentBom.id}/activate`);
        toast.success('BoM activated');
        mutate();
      } catch (err) { toast.error(err.message); }
    }
  }

  const isReadOnly = (currentBom?.status === 'ACTIVE' || currentBom?.status === 'ARCHIVED') && !editing;

  return (
    <div className="chart-panel" style={{ borderLeft: '3px solid #6366f1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="chart-panel-title">Bill of Materials</span>
            {product?.boms?.length > 0 && (
              <select
                className="form-select"
                style={{
                  padding: '2px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  height: 'auto',
                  width: 'auto',
                  borderRadius: 6,
                  borderColor: 'var(--border-subtle)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
                value={selectedBomId}
                onChange={e => {
                  setSelectedBomId(e.target.value);
                  setEditing(false);
                }}
                disabled={saving}
              >
                {product.boms.map(b => (
                  <option key={b.id} value={b.id}>
                    v{b.version} ({b.status.toLowerCase()})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="chart-panel-subtitle">
            {currentBom
              ? `${currentBom.status === 'ACTIVE' ? 'Active default' : currentBom.status === 'DRAFT' ? 'Draft (inactive)' : 'Archived version'} v${currentBom.version}`
              : 'No BoM defined yet'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(currentBom?.status === 'ACTIVE' || currentBom?.status === 'ARCHIVED') && !editing && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>New Version</button>
          )}
          {(!currentBom || editing || currentBom?.status === 'DRAFT') && (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveBom} disabled={saving}>
              {saving ? 'Saving...' : currentBom?.status === 'DRAFT' ? 'Update BoM' : 'Save BoM'}
            </button>
          )}
          {currentBom?.status === 'DRAFT' && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#1D9E75', fontWeight: 700 }} onClick={handleActivateBom}>
              Activate
            </button>
          )}
        </div>
      </div>

      {/* Components */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Components</span>
          {!isReadOnly && <button type="button" className="btn btn-ghost btn-sm" onClick={addComponent}>+ Add</button>}
        </div>

        {isReadOnly ? (
          // Read-only tree
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            {(currentBom?.components || []).map((c, i) => (
              <div key={c.id || i} className="bom-tree-row">
                <span className="bom-tree-icon">{i === currentBom.components.length - 1 ? '└─' : '├─'}</span>
                <span className="bom-tree-name">{c.componentProduct?.name}</span>
                {c.componentProduct?.category && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 999,
                    background: (CATEGORIES.find(cat => cat.value === c.componentProduct.category)?.color || '#888') + '18',
                    color: CATEGORIES.find(cat => cat.value === c.componentProduct.category)?.color || '#888',
                  }}>
                    {CATEGORIES.find(cat => cat.value === c.componentProduct.category)?.label}
                  </span>
                )}
                <span className="bom-tree-qty">× {Number(c.quantityPerUnit)}</span>
                <span className="bom-tree-uom">{c.componentProduct?.uom}</span>
              </div>
            ))}
            {(!currentBom?.components || currentBom.components.length === 0) && (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: 'inherit' }}>No components defined</div>
            )}
          </div>
        ) : (
          // Editable rows
          components.map((comp, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 32px', gap: 8, marginBottom: 6, alignItems: 'end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                {i === 0 && <label className="form-label">Component Product</label>}
                <select className="form-select" value={comp.componentProductId} onChange={e => updateComponent(i, 'componentProductId', e.target.value)}>
                  <option value="">Select...</option>
                  {filteredProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — {CATEGORIES.find(c => c.value === p.category)?.label || 'No category'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                {i === 0 && <label className="form-label">Qty/Unit</label>}
                <input className="form-input" type="number" min="0.001" step="0.001" value={comp.quantityPerUnit} onChange={e => updateComponent(i, 'quantityPerUnit', e.target.value)} />
              </div>
              <button type="button" onClick={() => removeComponent(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E24B4A', fontSize: 16, paddingBottom: 4 }}>×</button>
            </div>
          ))
        )}
      </div>

      {/* Operations */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Operations</span>
          {!isReadOnly && <button type="button" className="btn btn-ghost btn-sm" onClick={addOperation}>+ Add</button>}
        </div>

        {isReadOnly ? (
          (currentBom?.operations || []).length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No operations defined</div>
          ) : (
            (currentBom?.operations || []).map((op, i) => (
              <div key={op.id || i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{op.sequence}. {op.operationName}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{op.workCenter?.name}</span>
                </div>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{op.durationMinutes} min</span>
              </div>
            ))
          )
        ) : (
          operations.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Optional — click + Add</div>
          ) : (
            operations.map((op, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px 32px', gap: 6, marginBottom: 6, alignItems: 'end' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  {i === 0 && <label className="form-label">Operation</label>}
                  <input className="form-input" placeholder="Assembly" value={op.operationName} onChange={e => updateOperation(i, 'operationName', e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  {i === 0 && <label className="form-label">Work Center</label>}
                  <select className="form-select" value={op.workCenterId} onChange={e => updateOperation(i, 'workCenterId', e.target.value)}>
                    <option value="">Select...</option>
                    {(workCenters || []).map(wc => <option key={wc.id} value={wc.id}>{wc.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  {i === 0 && <label className="form-label">Min</label>}
                  <input className="form-input" type="number" min="1" value={op.durationMinutes} onChange={e => updateOperation(i, 'durationMinutes', e.target.value)} />
                </div>
                <button type="button" onClick={() => removeOperation(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E24B4A', fontSize: 16, paddingBottom: 4 }}>×</button>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}

/* ─── Sidebar Widgets ────────────────────────────────── */

function InventorySnapshot({ product }) {
  const onHand   = Number(product.onHandQty);
  const reserved = Number(product.reservedQty);
  const free     = Number(product.freeToUseQty);
  const reorder  = Number(product.reorderPoint);
  const isLow    = product.isLowStock;

  const stockColor = free <= 0 ? '#E24B4A' : isLow ? '#BA7517' : '#1D9E75';

  return (
    <div className="chart-panel">
      <div className="chart-panel-title" style={{ marginBottom: 10 }}>Inventory</div>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 36, fontWeight: 800, color: stockColor, lineHeight: 1 }}>{onHand}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>On Hand</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ textAlign: 'center', padding: '8px 0', background: 'var(--bg-secondary)', borderRadius: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#BA7517' }}>{reserved}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Reserved</div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px 0', background: 'var(--bg-secondary)', borderRadius: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: stockColor }}>{free}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Free to Use</div>
        </div>
      </div>
      {reorder > 0 && (
        <div style={{
          marginTop: 10, padding: '6px 10px', borderRadius: 6, fontSize: 11,
          background: isLow ? '#E24B4A15' : '#1D9E7515',
          color: isLow ? '#E24B4A' : '#1D9E75',
          fontWeight: 600, textAlign: 'center',
        }}>
          {isLow ? `⚠ Below reorder point (${reorder})` : `Reorder point: ${reorder}`}
        </div>
      )}
    </div>
  );
}

function LinkedOrders({ product }) {
  const mos = product.linkedMOs || [];
  const pos = product.linkedPOs || [];
  if (mos.length === 0 && pos.length === 0) return null;

  const STATUS_COLORS = {
    DRAFT: '#888780', CONFIRMED: '#BA7517', IN_PROGRESS: '#6366f1',
    PARTIALLY_RECEIVED: '#BA7517', PARTIALLY_DELIVERED: '#BA7517',
  };

  return (
    <div className="chart-panel">
      <div className="chart-panel-title" style={{ marginBottom: 10 }}>Linked Orders</div>
      {mos.length > 0 && (
        <div style={{ marginBottom: mos.length > 0 && pos.length > 0 ? 12 : 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Manufacturing</div>
          {mos.map(mo => (
            <Link key={mo.id} href={`/manufacturing-orders`} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 0', borderBottom: '1px solid var(--border-subtle)',
              fontSize: 12, textDecoration: 'none', color: 'inherit',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{mo.orderNo}</span>
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 999, fontWeight: 700,
                background: (STATUS_COLORS[mo.status] || '#888') + '18',
                color: STATUS_COLORS[mo.status] || '#888',
              }}>{mo.status}</span>
            </Link>
          ))}
        </div>
      )}
      {pos.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Purchase</div>
          {pos.map(po => (
            <Link key={po.id} href={`/purchase-orders`} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 0', borderBottom: '1px solid var(--border-subtle)',
              fontSize: 12, textDecoration: 'none', color: 'inherit',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{po.orderNo}</span>
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 999, fontWeight: 700,
                background: (STATUS_COLORS[po.status] || '#888') + '18',
                color: STATUS_COLORS[po.status] || '#888',
              }}>{po.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StockLedgerMini({ product }) {
  const entries = product.recentLedger || [];
  if (entries.length === 0) return null;

  return (
    <div className="chart-panel">
      <div className="chart-panel-title" style={{ marginBottom: 10 }}>Recent Stock Movements</div>
      {entries.slice(0, 5).map((e, i) => {
        const qty      = Number(e.quantity);
        const isPlus   = qty > 0;
        const movColor = MOVEMENT_COLORS[e.movementType] || '#888780';
        return (
          <div key={e.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: movColor, flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                {MOVEMENT_LABELS[e.movementType] || e.movementType}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeAgo(e.createdAt)}</div>
            </div>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: isPlus ? '#1D9E75' : '#E24B4A',
              fontFamily: 'var(--font-mono)',
            }}>
              {isPlus ? '+' : ''}{qty}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Page Component ────────────────────────────── */

export default function ProductFormPage() {
  const router  = useRouter();
  const params  = useParams();
  const toast   = useToast();
  const isNew   = params.id === 'new';

  const { data: product, isLoading, mutate } = useSWR(isNew ? null : `/products/${params.id}`, fetcher);
  const { data: vendors }      = useSWR('/vendors', fetcher);
  const { data: allProducts }  = useSWR('/products', fetcher);
  const { data: workCenters }  = useSWR('/work-centers', fetcher);

  const [form, setForm] = useState({
    sku: '', name: '', category: '', uom: 'UNIT',
    salesPrice: 0, costPrice: 0,
    procurementStrategy: 'MTS', procureOnDemand: false,
    procurementType: '', defaultVendorId: '', reorderPoint: 0, reorderQty: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        sku:                 product.sku || '',
        name:                product.name || '',
        category:            product.category || '',
        uom:                 product.uom || 'UNIT',
        salesPrice:          Number(product.salesPrice) || 0,
        costPrice:           Number(product.costPrice) || 0,
        procurementStrategy: product.procurementStrategy || 'MTS',
        procureOnDemand:     product.procureOnDemand || false,
        procurementType:     product.procurementType || '',
        defaultVendorId:     product.defaultVendorId ? String(product.defaultVendorId) : '',
        reorderPoint:        Number(product.reorderPoint) || 0,
        reorderQty:          Number(product.reorderQty) || 0,
      });
    }
  }, [product]);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // When category changes, apply smart defaults
  function handleCategoryChange(cat) {
    const meta = CAT_META[cat];
    const updates = { category: cat };

    if (meta && !meta.showProcType && meta.defaultProcType) {
      updates.procurementType = meta.defaultProcType;
    }
    if (meta && !meta.showStrategy) {
      updates.procurementStrategy = 'MTS';
    }
    if (meta && !meta.showProcureOnDemand) {
      updates.procureOnDemand = false;
    }

    setForm(prev => ({ ...prev, ...updates }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.category) { toast.error('Please select a product category'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        salesPrice:      Number(form.salesPrice),
        costPrice:       Number(form.costPrice),
        reorderPoint:    Number(form.reorderPoint),
        reorderQty:      Number(form.reorderQty),
        defaultVendorId: form.defaultVendorId ? Number(form.defaultVendorId) : null,
        procurementType: form.procurementType || null,
        category:        form.category || null,
      };

      if (isNew) {
        const created = await api.post('/products', payload);
        toast.success('Product created');
        router.push(`/products/${created.id}`);
      } else {
        await api.patch(`/products/${params.id}`, payload);
        toast.success('Product updated');
        mutate();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && isLoading) return <div className="loading-page"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  const cat  = form.category;
  const meta = CAT_META[cat] || {};
  const showBom = meta.canHaveBom && form.procurementType === 'MANUFACTURING';
  const showVendor = cat === 'RAW_MATERIAL' || cat === 'CONSUMABLE' || (meta.showProcType && form.procurementType === 'PURCHASE');
  const showReorder = cat && (cat !== 'CONSUMABLE' || true); // show for all
  const showMtsFields = meta.showStrategy && form.procurementStrategy === 'MTS';
  const catInfo = CATEGORIES.find(c => c.value === cat);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isNew ? 'New Product' : product?.name}</h1>
          <p className="page-subtitle">
            {isNew ? 'Configure a new product for the catalog' : (
              <>
                {product?.sku}
                {catInfo && (
                  <span style={{
                    marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    background: `${catInfo.color}18`, color: catInfo.color,
                  }}>{catInfo.label}</span>
                )}
              </>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => router.push('/products')}>← Back</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Create Product' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: !isNew ? '1fr 300px' : '1fr', gap: 20, alignItems: 'start' }}>
        {/* ═══ LEFT COLUMN ═══ */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Panel 1: Category ── */}
          <div className="chart-panel">
            <div className="chart-panel-title" style={{ marginBottom: 12 }}>Product Category *</div>
            <CategorySelector value={form.category} onChange={handleCategoryChange} disabled={false} />
          </div>

          {/* ── Panel 2: Identity ── */}
          {cat && (
            <div className="chart-panel" style={{ transition: 'all 0.3s' }}>
              <div className="chart-panel-title" style={{ marginBottom: 12 }}>Identity</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">SKU *</label>
                  <input className="form-input" value={form.sku} onChange={e => handleChange('sku', e.target.value)} required disabled={!isNew} placeholder="e.g. RM-WD-001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input className="form-input" value={form.name} onChange={e => handleChange('name', e.target.value)} required placeholder="e.g. Wood Plank" />
                </div>
              </div>
              <div className="form-row" style={{ marginTop: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Unit of Measure</label>
                  <select className="form-select" value={form.uom} onChange={e => handleChange('uom', e.target.value)}>
                    <option value="UNIT">Unit</option>
                    <option value="PCS">Pieces</option>
                    <option value="KG">Kilogram</option>
                    <option value="LITRE">Litre</option>
                    <option value="PACK">Pack</option>
                    <option value="METRE">Metre</option>
                  </select>
                </div>
                <div className="form-group" />
              </div>
            </div>
          )}

          {/* ── Panel 3: Pricing ── */}
          {cat && (
            <div className="chart-panel">
              <div className="chart-panel-title" style={{ marginBottom: 12 }}>Pricing</div>
              <div className="form-row">
                {meta.showSalesPrice && (
                  <div className="form-group">
                    <label className="form-label">Sales Price (₹)</label>
                    <input className="form-input" type="number" step="0.01" min="0" value={form.salesPrice} onChange={e => handleChange('salesPrice', e.target.value)} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Cost Price (₹)</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={form.costPrice} onChange={e => handleChange('costPrice', e.target.value)} />
                </div>
                {!meta.showSalesPrice && <div className="form-group" />}
              </div>
            </div>
          )}

          {/* ── Panel 4: Procurement Configuration ── */}
          {cat && (
            <div className="chart-panel">
              <div className="chart-panel-title" style={{ marginBottom: 12 }}>Procurement</div>

              <div className="form-row">
                {meta.showProcType && (
                  <div className="form-group">
                    <label className="form-label">Procurement Type</label>
                    <select className="form-select" value={form.procurementType} onChange={e => handleChange('procurementType', e.target.value)}>
                      <option value="">Not set</option>
                      <option value="PURCHASE">Purchase from vendor</option>
                      <option value="MANUFACTURING">Manufacture in-house</option>
                    </select>
                  </div>
                )}
                {meta.showStrategy && (
                  <div className="form-group">
                    <label className="form-label">Strategy</label>
                    <select className="form-select" value={form.procurementStrategy} onChange={e => handleChange('procurementStrategy', e.target.value)}>
                      <option value="MTS">Make to Stock (MTS)</option>
                      <option value="MTO">Make to Order (MTO)</option>
                    </select>
                  </div>
                )}
                {!meta.showProcType && !meta.showStrategy && (
                  <div className="form-group">
                    <label className="form-label">Procurement Type</label>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '8px 0', fontWeight: 600 }}>
                      {meta.defaultProcType === 'PURCHASE' ? 'Purchase from vendor' : '—'}
                    </div>
                  </div>
                )}
              </div>

              {meta.showProcureOnDemand && (
                <div className="form-row" style={{ marginTop: 'var(--space-4)' }}>
                  <div className="form-group">
                    <label className="form-label">Procure on Demand (Auto)</label>
                    <select className="form-select" value={form.procureOnDemand ? 'true' : 'false'} onChange={e => handleChange('procureOnDemand', e.target.value === 'true')}>
                      <option value="false">No — manual procurement only</option>
                      <option value="true">Yes — auto-generate MO/PO on shortage</option>
                    </select>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      When enabled, confirming a Sales Order with insufficient stock will automatically create Manufacturing Orders or Purchase Orders.
                    </div>
                  </div>
                </div>
              )}

              {showVendor && (
                <div className="form-row" style={{ marginTop: 'var(--space-4)' }}>
                  <div className="form-group">
                    <label className="form-label">Preferred Vendor</label>
                    <select className="form-select" value={form.defaultVendorId} onChange={e => handleChange('defaultVendorId', e.target.value)}>
                      <option value="">No default vendor</option>
                      {(vendors || []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {showReorder && (
                <div className="form-row" style={{ marginTop: 'var(--space-4)' }}>
                  <div className="form-group">
                    <label className="form-label">Reorder Point</label>
                    <input className="form-input" type="number" min="0" value={form.reorderPoint} onChange={e => handleChange('reorderPoint', e.target.value)} />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Alert when stock falls to this level
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reorder Quantity</label>
                    <input className="form-input" type="number" min="0" value={form.reorderQty} onChange={e => handleChange('reorderQty', e.target.value)} />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      How much to order/produce when restocking
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Panel 5: Inline BoM Builder ── */}
          {showBom && !isNew && product && (
            <InlineBomBuilder
              product={product}
              productId={product.id}
              allProducts={allProducts || []}
              workCenters={workCenters || []}
              category={cat}
              mutate={mutate}
              toast={toast}
            />
          )}
          {showBom && isNew && (
            <div className="chart-panel" style={{ borderLeft: '3px solid #6366f1', opacity: 0.7 }}>
              <div className="chart-panel-title">Bill of Materials</div>
              <div className="chart-panel-subtitle">Save the product first, then configure the BoM here.</div>
            </div>
          )}
        </form>

        {/* ═══ RIGHT SIDEBAR (edit mode only) ═══ */}
        {!isNew && product && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 80 }}>
            <InventorySnapshot product={product} />
            <LinkedOrders product={product} />
            <StockLedgerMini product={product} />

            {/* BoM versions list */}
            {product.boms && product.boms.length > 0 && (
              <div className="chart-panel">
                <div className="chart-panel-title" style={{ marginBottom: 8 }}>BoM History</div>
                {product.boms.map(b => (
                  <Link key={b.id} href={`/boms/${b.id}`} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '5px 0', borderBottom: '1px solid var(--border-subtle)',
                    fontSize: 12, textDecoration: 'none', color: 'inherit',
                  }}>
                    <span style={{ fontWeight: 600 }}>v{b.version}</span>
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 999, fontWeight: 700,
                      background: b.status === 'ACTIVE' ? '#1D9E7518' : b.status === 'DRAFT' ? '#88878018' : '#BA751718',
                      color: b.status === 'ACTIVE' ? '#1D9E75' : b.status === 'DRAFT' ? '#888780' : '#BA7517',
                    }}>{b.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
