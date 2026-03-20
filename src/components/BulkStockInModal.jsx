/**
 * BulkStockInModal.jsx — Cart/bucket procurement session
 *
 * Phase 1: Search global catalog → click a part → configure prices/stock → Add to Cart
 *          (repeat for as many parts as needed)
 * Phase 2: Add supplier/invoice details
 * Phase 3: Submit → bulk-stock-in API → updates inventory + movements everywhere
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { T, FONT } from '../theme';
import { fmt } from '../utils';
import { lookupCatalog, lookupByBarcode, bulkStockIn, contributePart, addInventory } from '../api/inventory';
import { mapInventoryToProduct } from '../api/sync';

// ─── helpers ──────────────────────────────────────────────────────────────────

const CAT_EMOJI = {
  Brakes: '🛞', Engine: '⚙️', Filters: '🔧', Electrical: '⚡',
  Suspension: '🔩', Body: '🚗', Transmission: '⚙️', Cooling: '🌡️',
  Exhaust: '💨', Fuel: '⛽', Lighting: '💡', Tyres: '🛞',
};
const catEmoji = (cat) => CAT_EMOJI[cat] || '📦';

function PartImage({ src, category, size = 36 }) {
  const [err, setErr] = useState(false);
  if (src && !err) {
    return (
      <img src={src} alt="" onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, background: T.card,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.55, flexShrink: 0,
    }}>
      {catEmoji(category)}
    </div>
  );
}

function Field({ label, required, children, error }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}{required && <span style={{ color: T.crimson }}> *</span>}
      </label>
      {children}
      {error && <span style={{ fontSize: 10, color: T.crimson }}>{error}</span>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', min, step, disabled, style }) {
  return (
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      min={min} step={step} disabled={disabled}
      style={{
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: '8px 10px', color: disabled ? T.t3 : T.t1, fontSize: 13, fontWeight: 600,
        fontFamily: FONT.ui, outline: 'none', width: '100%', boxSizing: 'border-box',
        ...style,
      }}
      onFocus={e => e.target.style.borderColor = T.amber}
      onBlur={e => e.target.style.borderColor = T.border}
    />
  );
}

// ─── PHASE 1: Search + Cart ────────────────────────────────────────────────────

function SearchPhase({ cart, setCart, onProceed, toast }) {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected]   = useState(null);   // catalog part being configured
  const [editIdx, setEditIdx]     = useState(null);    // cart item being re-edited
  const [noResults, setNoResults] = useState(false);

  // Configure form state
  const [form, setForm] = useState({ buyPrice: '', sellPrice: '', qty: '', rack: '', minAlert: '5', notes: '' });
  const [formErr, setFormErr] = useState({});

  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  // ── Search debounce ────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q) => {
    if (q.trim().length < 2) { setResults([]); setNoResults(false); return; }
    setSearching(true);
    try {
      const data = await lookupCatalog(q.trim(), 15);
      setResults(data.parts || []);
      setNoResults((data.parts || []).length === 0);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 280);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  // ── Barcode / Enter key exact scan ────────────────────────────────────────
  const handleKeyDown = async (e) => {
    if (e.key !== 'Enter' || !query.trim()) return;
    clearTimeout(debounceRef.current);
    setSearching(true);
    try {
      const data = await lookupByBarcode(query.trim());
      if (data.exactMatch) {
        selectPart(data.exactMatch);
        setResults([]);
        return;
      }
      if (data.parts?.length) {
        setResults(data.parts);
      } else {
        await doSearch(query.trim());
      }
    } catch {
      await doSearch(query.trim());
    } finally {
      setSearching(false);
    }
  };

  // ── Select a part from results ────────────────────────────────────────────
  const selectPart = (part) => {
    setSelected(part);
    setEditIdx(null);
    setForm({ buyPrice: '', sellPrice: '', qty: '1', rack: '', minAlert: '5', notes: '' });
    setFormErr({});
    setResults([]);
    setQuery('');
  };

  // ── Start editing a cart item ─────────────────────────────────────────────
  const editCartItem = (idx) => {
    const ci = cart[idx];
    setSelected(ci.part);
    setEditIdx(idx);
    setForm({ buyPrice: String(ci.buyPrice || ''), sellPrice: String(ci.sellPrice), qty: String(ci.qty), rack: ci.rack || '', minAlert: String(ci.minAlert || 5), notes: ci.notes || '' });
    setFormErr({});
  };

  // ── Validate configure form ───────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.sellPrice || parseFloat(form.sellPrice) <= 0) errs.sellPrice = 'Required';
    if (!form.qty || parseInt(form.qty) < 1) errs.qty = 'Min 1';
    return errs;
  };

  // ── Add / update cart ─────────────────────────────────────────────────────
  const addToCart = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFormErr(errs); return; }

    const cartItem = {
      part:     selected,
      masterPartId: selected.masterPartId,
      buyPrice:  form.buyPrice  ? parseFloat(form.buyPrice)  : null,
      sellPrice: parseFloat(form.sellPrice),
      qty:       parseInt(form.qty),
      rack:      form.rack.trim() || null,
      minAlert:  parseInt(form.minAlert) || 5,
      notes:     form.notes.trim() || null,
    };

    if (editIdx !== null) {
      setCart(prev => prev.map((c, i) => i === editIdx ? cartItem : c));
    } else {
      // Check if already in cart
      const existing = cart.findIndex(c => c.masterPartId === selected.masterPartId);
      if (existing >= 0) {
        setCart(prev => prev.map((c, i) => i === existing ? cartItem : c));
      } else {
        setCart(prev => [...prev, cartItem]);
      }
    }

    setSelected(null);
    setEditIdx(null);
    searchRef.current?.focus();
  };

  const removeFromCart = (idx) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
    if (editIdx === idx) { setSelected(null); setEditIdx(null); }
  };

  const totalValue = cart.reduce((s, c) => s + (c.buyPrice || c.sellPrice) * c.qty, 0);

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0, overflow: 'hidden' }}>

      {/* ── LEFT: Search + Configure ──────────────────────────────────── */}
      <div style={{ flex: '1 1 58%', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${T.border}`, overflow: 'hidden' }}>

        {/* Search bar */}
        <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.t3, fontSize: 15, pointerEvents: 'none' }}>🔍</span>
            <input
              ref={searchRef}
              autoFocus
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(null); }}
              onKeyDown={handleKeyDown}
              placeholder="Search by part name, brand, OEM number or scan barcode (Enter)…"
              style={{
                width: '100%', background: T.surface, border: `1px solid ${T.borderHi}`,
                borderRadius: 10, padding: '10px 14px 10px 38px', color: T.t1, fontSize: 13,
                fontFamily: FONT.ui, outline: 'none', boxSizing: 'border-box',
              }}
            />
            {searching && (
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: T.amber, fontSize: 12 }}>…</span>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scroll">
          {/* ── Results list ── */}
          {results.length > 0 && !selected && (
            <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {results.map(p => (
                <button key={p.masterPartId} onClick={() => selectPart(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, background: T.card,
                    border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s', width: '100%',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.amber; e.currentTarget.style.background = T.amberGlow; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.card; }}
                >
                  <PartImage src={p.imageUrl || p.images?.[0]} category={p.categoryL1} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.partName}</div>
                    <div style={{ fontSize: 11, color: T.t3, marginTop: 1 }}>
                      {p.brand && <span style={{ color: T.amber, marginRight: 6 }}>{p.brand}</span>}
                      {p.categoryL1 && <span>{p.categoryL1}</span>}
                      {p.oemNumber  && <span style={{ marginLeft: 6, color: T.sky }}>OEM: {p.oemNumber}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: p.status === 'VERIFIED' ? T.emerald : T.amber, flexShrink: 0 }}>
                    {p.status}
                  </div>
                </button>
              ))}

              {/* Contribute option */}
              <button onClick={() => selectPart({ _manual: true, partName: query.trim(), masterPartId: null })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, background: 'transparent',
                  border: `1px dashed ${T.border}`, borderRadius: 10, padding: '10px 12px',
                  cursor: 'pointer', color: T.t3, fontSize: 12, width: '100%', marginTop: 4,
                }}>
                <span style={{ fontSize: 18 }}>＋</span>
                Not found? Add "{query.trim()}" as a new part
              </button>
            </div>
          )}

          {noResults && !selected && query.trim().length >= 2 && (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔎</div>
              <div style={{ color: T.t2, fontSize: 13, marginBottom: 16 }}>No catalog match for "{query}"</div>
              <button onClick={() => selectPart({ _manual: true, partName: query.trim(), masterPartId: null })}
                style={{
                  background: T.amberGlow, border: `1px solid ${T.amber}44`, borderRadius: 8,
                  padding: '8px 20px', color: T.amber, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', fontFamily: FONT.ui,
                }}>
                ＋ Add as new part
              </button>
            </div>
          )}

          {!query && !selected && cart.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
              <div style={{ color: T.t2, fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Start adding products</div>
              <div style={{ color: T.t3, fontSize: 12 }}>Search the global catalog or scan a barcode</div>
            </div>
          )}

          {!query && !selected && cart.length > 0 && (
            <div style={{ padding: '20px 20px', textAlign: 'center', color: T.t3, fontSize: 12 }}>
              Search for another product to add to the cart
            </div>
          )}

          {/* ── Configure panel (part selected) ── */}
          {selected && (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Part header */}
              <div style={{ display: 'flex', gap: 12, padding: '12px 14px', background: T.card, borderRadius: 12, border: `1px solid ${T.border}` }}>
                <PartImage src={selected.imageUrl || selected.images?.[0]} category={selected.categoryL1} size={48} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.t1 }}>{selected.partName}</div>
                  <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>
                    {selected.brand && <span style={{ color: T.amber, marginRight: 6 }}>{selected.brand}</span>}
                    {selected.categoryL1 && <span>{selected.categoryL1}</span>}
                    {selected.categoryL2 && <span style={{ marginLeft: 4 }}>· {selected.categoryL2}</span>}
                  </div>
                  {selected.oemNumber && (
                    <div style={{ fontSize: 10, color: T.sky, marginTop: 2 }}>OEM: {selected.oemNumber}</div>
                  )}
                  {selected.fitments?.length > 0 && (
                    <div style={{ fontSize: 10, color: T.emerald, marginTop: 2 }}>
                      Fits: {selected.fitments.slice(0, 2).map(f => `${f.vehicle?.make} ${f.vehicle?.model}`).join(', ')}
                      {selected.fitments.length > 2 && ` +${selected.fitments.length - 2}`}
                    </div>
                  )}
                </div>
                <button onClick={() => { setSelected(null); searchRef.current?.focus(); }}
                  style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: T.t3, cursor: 'pointer', fontSize: 18, padding: 4, alignSelf: 'flex-start' }}>×</button>
              </div>

              {/* Manual part name if contribute mode */}
              {selected._manual && (
                <Field label="Part Name" required>
                  <Input value={form.partName || selected.partName || ''} onChange={e => setForm(f => ({ ...f, partName: e.target.value }))} placeholder="Full part name" />
                </Field>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Buying Price (₹)" error={formErr.buyPrice}>
                  <Input type="number" min="0" step="0.01" value={form.buyPrice} onChange={e => setForm(f => ({ ...f, buyPrice: e.target.value }))} placeholder="Cost price" />
                </Field>
                <Field label="Selling Price (₹)" required error={formErr.sellPrice}>
                  <Input type="number" min="0" step="0.01" value={form.sellPrice} onChange={e => setForm(f => ({ ...f, sellPrice: e.target.value }))} placeholder="MRP / sell price" />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Quantity (Units)" required error={formErr.qty}>
                  <Input type="number" min="1" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} placeholder="0" />
                </Field>
                <Field label="Min Stock Alert">
                  <Input type="number" min="0" value={form.minAlert} onChange={e => setForm(f => ({ ...f, minAlert: e.target.value }))} placeholder="5" />
                </Field>
              </div>

              <Field label="Rack / Bin Location">
                <Input value={form.rack} onChange={e => setForm(f => ({ ...f, rack: e.target.value }))} placeholder="e.g. A3-B2" />
              </Field>

              <Field label="Shop Notes">
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes for this product" />
              </Field>

              <button onClick={addToCart}
                style={{
                  background: T.amber, border: 'none', borderRadius: 10, padding: '11px 0',
                  fontSize: 13, fontWeight: 800, color: '#000', cursor: 'pointer', fontFamily: FONT.ui,
                  width: '100%', marginTop: 4,
                }}>
                {editIdx !== null ? 'Update Cart Item' : '＋ Add to Cart'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Cart ───────────────────────────────────────────────── */}
      <div style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px 10px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🛒</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: T.t1 }}>Cart</span>
          <span style={{ background: T.amberGlow, border: `1px solid ${T.amber}44`, color: T.amber, fontSize: 10, fontWeight: 800, borderRadius: 20, padding: '2px 8px' }}>{cart.length}</span>
          <div style={{ flex: 1 }} />
          {totalValue > 0 && (
            <span style={{ fontSize: 12, color: T.t2, fontFamily: FONT.mono }}>{fmt(totalValue)}</span>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }} className="custom-scroll">
          {cart.length === 0 && (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: T.t4, fontSize: 12 }}>
              Cart is empty.<br />Search and add products.
            </div>
          )}
          {cart.map((ci, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 10px',
              background: editIdx === idx ? T.amberGlow : T.card,
              border: `1px solid ${editIdx === idx ? T.amber + '44' : T.border}`,
              borderRadius: 10, marginBottom: 6,
            }}>
              <PartImage src={ci.part.imageUrl || ci.part.images?.[0]} category={ci.part.categoryL1} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ci.part.partName}</div>
                <div style={{ fontSize: 11, color: T.t3, marginTop: 1 }}>
                  {ci.qty} unit{ci.qty > 1 ? 's' : ''} × {ci.buyPrice ? fmt(ci.buyPrice) : '—'}
                </div>
                <div style={{ fontSize: 11, color: T.emerald, marginTop: 1 }}>
                  Sell: {fmt(ci.sellPrice)}
                  {ci.rack && <span style={{ color: T.t3, marginLeft: 6 }}>📍{ci.rack}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={() => editCartItem(idx)}
                  style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: '3px 8px', fontSize: 10, color: T.t2, cursor: 'pointer', fontFamily: FONT.ui }}>
                  Edit
                </button>
                <button onClick={() => removeFromCart(idx)}
                  style={{ background: T.crimsonBg, border: `1px solid ${T.crimson}33`, borderRadius: 6, padding: '3px 8px', fontSize: 10, color: T.crimson, cursor: 'pointer', fontFamily: FONT.ui }}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Proceed button */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.border}` }}>
          {cart.length > 0 && totalValue > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: T.t3 }}>Total procurement value</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: T.amber, fontFamily: FONT.mono }}>{fmt(totalValue)}</span>
            </div>
          )}
          <button onClick={onProceed} disabled={cart.length === 0}
            style={{
              background: cart.length > 0 ? T.amber : T.surface, border: 'none', borderRadius: 10,
              padding: '11px 0', fontSize: 13, fontWeight: 800,
              color: cart.length > 0 ? '#000' : T.t4, cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
              fontFamily: FONT.ui, width: '100%', transition: 'all 0.15s',
            }}>
            Proceed to Supplier Details →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PHASE 2: Supplier / Invoice Details ──────────────────────────────────────

function SupplierPhase({ cart, onBack, onSubmit, submitting }) {
  const [form, setForm] = useState({
    supplierName:  '',
    supplierPhone: '',
    invoiceNo:     '',
    invoiceDate:   new Date().toISOString().slice(0, 10),
    paymentMode:   'Cash',
    creditDays:    '30',
    notes:         '',
  });

  const totalQty   = cart.reduce((s, c) => s + c.qty, 0);
  const totalValue = cart.reduce((s, c) => s + (c.buyPrice || c.sellPrice) * c.qty, 0);

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Cart summary strip */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.border}`, background: T.amberGlow, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, color: T.amber, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Products</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: T.t1, fontFamily: FONT.mono }}>{cart.length}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: T.amber, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Units</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: T.t1, fontFamily: FONT.mono }}>{totalQty}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: T.amber, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Purchase Value</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: T.amber, fontFamily: FONT.mono }}>{fmt(totalValue)}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: T.t3, textAlign: 'right' }}>
          {cart.map(c => c.part.partName).slice(0, 2).join(', ')}{cart.length > 2 ? ` +${cart.length - 2} more` : ''}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }} className="custom-scroll">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxWidth: 600 }}>
          <Field label="Supplier / Vendor Name">
            <Input value={form.supplierName} onChange={f('supplierName')} placeholder="e.g. Bosch India Pvt Ltd" />
          </Field>
          <Field label="Supplier Phone">
            <Input value={form.supplierPhone} onChange={f('supplierPhone')} placeholder="+91 98765 43210" />
          </Field>
          <Field label="Invoice Number">
            <Input value={form.invoiceNo} onChange={f('invoiceNo')} placeholder="e.g. INV-2024-001" />
          </Field>
          <Field label="Invoice Date">
            <Input type="date" value={form.invoiceDate} onChange={f('invoiceDate')} />
          </Field>
          <Field label="Payment Mode">
            <select value={form.paymentMode} onChange={f('paymentMode')}
              style={{
                background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
                padding: '8px 10px', color: T.t1, fontSize: 13, fontWeight: 600,
                fontFamily: FONT.ui, outline: 'none', width: '100%',
              }}>
              <option>Cash</option>
              <option>UPI</option>
              <option>NEFT / Bank Transfer</option>
              <option>Credit</option>
              <option>Cheque</option>
            </select>
          </Field>
          {form.paymentMode === 'Credit' && (
            <Field label="Credit Days">
              <Input type="number" min="1" value={form.creditDays} onChange={f('creditDays')} placeholder="30" />
            </Field>
          )}
        </div>

        <div style={{ marginTop: 14, maxWidth: 600 }}>
          <Field label="Notes / Remarks">
            <textarea value={form.notes} onChange={f('notes')} placeholder="Any special notes about this purchase…"
              rows={3}
              style={{
                background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
                padding: '8px 10px', color: T.t1, fontSize: 13, fontFamily: FONT.ui,
                outline: 'none', width: '100%', resize: 'vertical', boxSizing: 'border-box',
              }} />
          </Field>
        </div>
      </div>

      {/* Action bar */}
      <div style={{ padding: '14px 24px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 10 }}>
        <button onClick={onBack} disabled={submitting}
          style={{
            background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 10,
            padding: '11px 24px', fontSize: 13, fontWeight: 700, color: T.t2,
            cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: FONT.ui,
          }}>
          ← Back
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={() => onSubmit(form)} disabled={submitting}
          style={{
            background: submitting ? T.amberDim : T.amber, border: 'none', borderRadius: 10,
            padding: '11px 32px', fontSize: 13, fontWeight: 800, color: '#000',
            cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: FONT.ui, minWidth: 160,
          }}>
          {submitting ? '⏳ Saving…' : `✓ Stock In ${cart.length} Products`}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN MODAL ───────────────────────────────────────────────────────────────

export function BulkStockInModal({ open, onClose, onSave, toast, activeShopId }) {
  const [phase, setPhase]         = useState(1);
  const [cart,  setCart]          = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) { setPhase(1); setCart([]); setSubmitting(false); }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (supplierForm) => {
    if (cart.length === 0) return;
    setSubmitting(true);

    const supplier = {
      name:        supplierForm.supplierName  || null,
      phone:       supplierForm.supplierPhone || null,
      invoiceNo:   supplierForm.invoiceNo     || null,
      invoiceDate: supplierForm.invoiceDate   || null,
      paymentMode: supplierForm.paymentMode   || null,
      creditDays:  supplierForm.paymentMode === 'Credit' ? parseInt(supplierForm.creditDays) || 30 : null,
      notes:       supplierForm.notes         || null,
    };

    // Separate items: catalog-backed vs manual contribute
    const catalogItems  = cart.filter(ci => ci.masterPartId);
    const manualItems   = cart.filter(ci => !ci.masterPartId);

    const resultProducts  = [];
    const resultMovements = [];

    // ── 1. Catalog items → bulk-stock-in ─────────────────────────────────────
    if (catalogItems.length > 0) {
      try {
        const payload = catalogItems.map(ci => ({
          masterPartId:     ci.masterPartId,
          sellingPrice:     ci.sellPrice,
          buyingPrice:      ci.buyPrice,
          stockQty:         ci.qty,
          rackLocation:     ci.rack,
          minStockAlert:    ci.minAlert,
          shopSpecificNotes: ci.notes,
        }));

        const data = await bulkStockIn(payload, supplier);

        // Build inventoryId → partName map so movements know which product they belong to
        const invNameMap = {};
        (data.items || []).forEach(inv => {
          invNameMap[inv.inventoryId] = inv.masterPart?.partName || '';
        });

        if (data.items) {
          data.items.forEach(inv => {
            resultProducts.push(mapInventoryToProduct(inv));
          });
        }
        if (data.movements) {
          // Enrich each movement with partName + supplier info before handing to App.jsx
          data.movements.forEach(mov => {
            resultMovements.push({
              ...mov,
              partName:     invNameMap[mov.inventoryId] || '',
              supplierName: supplier.name        || null,
              supplier:     supplier.name        || null,
              paymentMode:  supplier.paymentMode || null,
              invoiceNo:    supplier.invoiceNo   || null,
            });
          });
        }
      } catch (err) {
        // Offline fallback — create local products AND movement records so
        // inventory + history stay consistent even when the API is unreachable.
        catalogItems.forEach(ci => {
          const localId = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2);
          resultProducts.push({
            id: localId,
            name: ci.part.partName, sku: ci.part.oemNumber || '',
            buyPrice: ci.buyPrice || 0, sellPrice: ci.sellPrice,
            stock: ci.qty, minStock: ci.minAlert,
            category: ci.part.categoryL1 || 'Parts',
            image: ci.part.imageUrl || ci.part.images?.[0] || catEmoji(ci.part.categoryL1),
            location: ci.rack || '', rack: ci.rack || '',
            shopId: activeShopId,
            _pendingSync: true,
          });
          // Synthesize a movement record so HistoryPage reflects this stock-in
          if (ci.qty > 0) {
            resultMovements.push({
              movementId: localId,
              inventoryId: localId,
              shopId: activeShopId,
              type: 'PURCHASE',
              qty: ci.qty,
              unitPrice: ci.buyPrice || null,
              totalAmount: ci.buyPrice ? ci.buyPrice * ci.qty : null,
              partName: ci.part.partName,
              supplierName: supplier.name || null,
              supplier: supplier.name || null,
              paymentMode: supplier.paymentMode || null,
              invoiceNo: supplier.invoiceNo || null,
              notes: 'Stock-in (offline)',
              createdAt: new Date().toISOString(),
              _pendingSync: true,
            });
          }
        });
      }
    }

    // ── 2. Manual / contribute items → addInventory ───────────────────────────
    for (const ci of manualItems) {
      try {
        const contribData = await contributePart({
          partName:  ci.form?.partName || ci.part.partName,
          brand:     ci.form?.brand    || null,
          categoryL1: ci.form?.category || null,
        });

        if (contribData.part) {
          const inv = await addInventory({
            masterPartId:  contribData.part.masterPartId,
            sellingPrice:  ci.sellPrice,
            buyingPrice:   ci.buyPrice,
            stockQty:      ci.qty,
            rackLocation:  ci.rack,
            minStockAlert: ci.minAlert,
          });
          if (inv.item) resultProducts.push(mapInventoryToProduct(inv.item));
        }
      } catch {
        // Local fallback — product + movement so history stays in sync
        const localId = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        resultProducts.push({
          id: localId,
          name: ci.part.partName, sku: '',
          buyPrice: ci.buyPrice || 0, sellPrice: ci.sellPrice,
          stock: ci.qty, minStock: ci.minAlert,
          category: 'Parts', image: '📦',
          location: ci.rack || '', rack: ci.rack || '',
          shopId: activeShopId, _pendingSync: true,
        });
        if (ci.qty > 0) {
          resultMovements.push({
            movementId: localId,
            inventoryId: localId,
            shopId: activeShopId,
            type: 'PURCHASE',
            qty: ci.qty,
            unitPrice: ci.buyPrice || null,
            totalAmount: ci.buyPrice ? ci.buyPrice * ci.qty : null,
            partName: ci.part.partName,
            supplierName: supplier.name || null,
            supplier: supplier.name || null,
            paymentMode: supplier.paymentMode || null,
            invoiceNo: supplier.invoiceNo || null,
            notes: 'Stock-in (offline)',
            createdAt: new Date().toISOString(),
            _pendingSync: true,
          });
        }
      }
    }

    setSubmitting(false);

    if (resultProducts.length > 0) {
      onSave({ products: resultProducts, movements: resultMovements });
      toast(
        `${cart.length} product${cart.length > 1 ? 's' : ''} stocked in successfully!`,
        'success', 'Stock-In Complete'
      );
      onClose();
    } else {
      toast('No products were saved. Check your connection.', 'error', 'Stock-In Failed');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 960, height: '90vh', maxHeight: 720,
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
          borderBottom: `1px solid ${T.border}`, background: T.card, flexShrink: 0,
        }}>
          <span style={{ fontSize: 18 }}>📦</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.t1 }}>Stock In Products</div>
            <div style={{ fontSize: 11, color: T.t3 }}>
              {phase === 1 ? 'Search catalog → configure → add to cart' : 'Add supplier / invoice details'}
            </div>
          </div>
          <div style={{ flex: 1 }} />

          {/* Phase indicators */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {[1, 2].map(p => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.ui,
                  background: phase >= p ? T.amber : T.surface,
                  color: phase >= p ? '#000' : T.t4,
                  border: `2px solid ${phase >= p ? T.amber : T.border}`,
                }}>
                  {phase > p ? '✓' : p}
                </div>
                {p < 2 && <div style={{ width: 24, height: 2, background: phase > p ? T.amber : T.border, borderRadius: 2 }} />}
              </div>
            ))}
          </div>

          <button onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: T.t3, cursor: 'pointer', fontSize: 20, padding: '2px 8px', marginLeft: 4 }}>
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {phase === 1 && (
            <SearchPhase
              cart={cart}
              setCart={setCart}
              onProceed={() => { if (cart.length > 0) setPhase(2); }}
              toast={toast}
            />
          )}
          {phase === 2 && (
            <SupplierPhase
              cart={cart}
              onBack={() => setPhase(1)}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
