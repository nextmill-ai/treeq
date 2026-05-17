"""Patch spartan_pricing_tool.html to enable cloud-aware persistence.

Inserts:
  1. <head>: supabase JS + auth-client.js + env globals (before </head>).
  2. After body, before </body>: a single <script> that overrides saveQuote/loadQuote
     to use the cloud when authenticated, falls back to localStorage when not.
     Also injects a customer/property header bar and a "Save & Send" button.

Idempotent: detects CLOUD-WIRE-INJECTED marker and aborts.
"""
import re
from pathlib import Path

PATH = Path(r"C:\Users\camer\Projects\Claude Cowork\TreeQ\treeq\spartan_pricing_tool.html")
src = PATH.read_text(encoding="utf-8")

MARKER = "CLOUD-WIRE-INJECTED"
if MARKER in src:
    print("spartan_pricing_tool.html already patched; nothing to do.")
    raise SystemExit(0)

HEAD_INJECT = """<script>
  /* CLOUD-WIRE-INJECTED-HEAD */
  window.__SUPABASE_URL__ = 'https://bhbubaopejjxijiqmujy.supabase.co';
  window.__SUPABASE_ANON_KEY__ = 'sb_publishable_CT6kIbqjVG5sbWLn_E1hQw_Hir_U65U';
</script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js" crossorigin="anonymous"></script>
<script src="/assets/auth-client.js"></script>
</head>"""

if "</head>" not in src:
    raise SystemExit("ERROR: </head> not found")
src = src.replace("</head>", HEAD_INJECT, 1)

BODY_INJECT = r"""
<script>
/* CLOUD-WIRE-INJECTED — Cloud-aware persistence for the Quote Builder.
   Runs AFTER the main script, so it can override saveQuote/loadQuote and hook
   into state. When signed in, the quote round-trips to public.crm_quotes.
   When signed out, localStorage fallback (the existing behavior) is used.
*/
(function () {
  'use strict';

  const urlParams = new URLSearchParams(location.search);
  const cloud = {
    enabled: false,
    profile: null,
    quoteId: urlParams.get('quote_id') || null,
    customerId: urlParams.get('customer_id') || null,
    propertyId: urlParams.get('property_id') || null,
    customer: null,
    property: null,
    saveTimer: null,
    saving: false,
    lastSerialized: null,
    initialLoaded: false,
  };

  function fmtMoney(cents) {
    return '$' + (Math.round((Number(cents)||0))/100 >= 0 ? Math.round(Number(cents)/100).toLocaleString() : '0');
  }

  function debounce(fn, ms) {
    return function (...args) {
      clearTimeout(cloud.saveTimer);
      cloud.saveTimer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // ── Header bar (customer + property) injected after .topbar ────────────
  function injectHeaderBar() {
    if (document.getElementById('cloud-bar')) return;
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;
    const bar = document.createElement('div');
    bar.id = 'cloud-bar';
    bar.style.cssText = 'display:none;padding:8px 16px;background:#fff;border-bottom:1px solid var(--line);font-size:.85rem;color:var(--ink);display:flex;align-items:center;gap:8px;flex-wrap:wrap';
    bar.innerHTML = `
      <span id="cloud-bar-info" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink-2)">Loading…</span>
      <button id="cloud-bar-change" type="button" style="font-size:.78rem;padding:5px 9px;border:1px solid var(--line);background:#fff;border-radius:6px;cursor:pointer">Change</button>
      <button id="cloud-bar-send" type="button" style="font-size:.78rem;padding:5px 9px;border:none;background:var(--forest,#2d5a3d);color:#fff;border-radius:6px;cursor:pointer">Save &amp; Send</button>
    `;
    topbar.parentNode.insertBefore(bar, topbar.nextSibling);
    document.getElementById('cloud-bar-change').addEventListener('click', openCustomerPicker);
    document.getElementById('cloud-bar-send').addEventListener('click', saveAndSend);
  }

  function updateHeaderBar() {
    const bar = document.getElementById('cloud-bar');
    if (!bar) return;
    if (!cloud.enabled) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    let info;
    if (cloud.customer) {
      const propAddr = cloud.property ? cloud.property.address_line1 : '';
      info = `<strong>${esc(cloud.customer.name)}</strong>${propAddr ? ' · ' + esc(propAddr) : ''}`;
    } else {
      info = '<em style="color:var(--muted)">No customer linked</em>';
    }
    document.getElementById('cloud-bar-info').innerHTML = info;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ── Customer picker modal ───────────────────────────────────────────────
  function ensurePickerModal() {
    if (document.getElementById('cust-picker-ov')) return;
    const ov = document.createElement('div');
    ov.id = 'cust-picker-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);display:none;align-items:flex-end;justify-content:center;z-index:9000';
    ov.innerHTML = `
      <div style="background:var(--cream,#f4f8f1);width:100%;max-width:480px;border-radius:16px 16px 0 0;padding:18px;max-height:80vh;overflow-y:auto">
        <h3 style="font-size:1rem;margin-bottom:10px">Link a customer</h3>
        <input id="cust-picker-q" type="text" placeholder="Search customers…" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;font-size:.95rem;margin-bottom:10px">
        <div id="cust-picker-list" style="display:flex;flex-direction:column;gap:6px;max-height:50vh;overflow-y:auto"></div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button id="cust-picker-clear" type="button" style="flex:1;padding:10px;border:1px solid var(--line);background:#fff;border-radius:8px;cursor:pointer">Unlink</button>
          <button id="cust-picker-close" type="button" style="flex:1;padding:10px;border:1px solid var(--line);background:#fff;border-radius:8px;cursor:pointer">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    let qTimer = null;
    document.getElementById('cust-picker-q').addEventListener('input', (e) => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => searchCustomers(e.target.value), 300);
    });
    document.getElementById('cust-picker-close').addEventListener('click', () => { ov.style.display = 'none'; });
    document.getElementById('cust-picker-clear').addEventListener('click', async () => {
      cloud.customerId = null; cloud.propertyId = null;
      cloud.customer = null;   cloud.property = null;
      updateHeaderBar();
      ov.style.display = 'none';
      scheduleSave();
    });
  }

  async function openCustomerPicker() {
    ensurePickerModal();
    document.getElementById('cust-picker-ov').style.display = 'flex';
    await searchCustomers('');
  }

  async function searchCustomers(q) {
    const list = document.getElementById('cust-picker-list');
    list.innerHTML = '<div style="color:var(--muted);font-size:.85rem">Loading…</div>';
    try {
      const data = await window.TQAuth.apiJson('/.netlify/functions/customers' + (q ? ('?q=' + encodeURIComponent(q)) : ''));
      const customers = data.customers || [];
      if (customers.length === 0) {
        list.innerHTML = '<div style="color:var(--muted);font-size:.85rem">No matches. <a href="/customers.html" style="color:var(--forest)">Create one</a>.</div>';
        return;
      }
      list.innerHTML = customers.map(c => `
        <button type="button" data-id="${c.id}" style="text-align:left;padding:10px;border:1px solid var(--line);background:#fff;border-radius:8px;cursor:pointer;font-family:inherit">
          <div style="font-weight:600">${esc(c.name)}</div>
          <div style="font-size:.8rem;color:var(--muted)">${esc([c.primary_phone,c.primary_email].filter(Boolean).join(' · '))}</div>
        </button>
      `).join('');
      list.querySelectorAll('button[data-id]').forEach(b => {
        b.addEventListener('click', async () => {
          await selectCustomer(b.dataset.id);
          document.getElementById('cust-picker-ov').style.display = 'none';
        });
      });
    } catch (e) {
      list.innerHTML = '<div style="color:var(--danger,#b3261e);font-size:.85rem">' + esc(e.message) + '</div>';
    }
  }

  async function selectCustomer(id) {
    cloud.customerId = id;
    try {
      const data = await window.TQAuth.apiJson('/.netlify/functions/customers?id=' + encodeURIComponent(id));
      cloud.customer = data.customer;
      const props = data.properties || [];
      cloud.property = props[0] || null;
      cloud.propertyId = cloud.property ? cloud.property.id : null;
    } catch (e) { /* keep id but skip detail */ }
    updateHeaderBar();
    scheduleSave();
  }

  // ── Line normalization for the API ─────────────────────────────────────
  function normalizeLines() {
    if (typeof computeQuote !== 'function') return [];
    const q = computeQuote();
    return (q.lines || []).map((l, idx) => ({
      line_type: inferLineType(l.label || ''),
      label: String(l.label || 'Line item').slice(0, 200),
      detail: l.detail ? String(l.detail).slice(0, 500) : null,
      amount_cents: Math.round((Number(l.amount) || 0) * 100),
      sort_order: idx,
    }));
  }

  function inferLineType(label) {
    const l = label.toLowerCase();
    if (l.includes('removal')) return 'tree_removal';
    if (l.includes('trim'))    return 'tree_trim';
    if (l.includes('felling') || l.includes('takedown')) return 'takedown';
    if (l.includes('stump'))    return 'stump';
    if (l.includes('haul') || l.includes('load')) return 'haul';
    if (l.includes('land clearing') || l.includes('forestry')) return 'land_clearing';
    if (l.includes('mulch') || l.includes('topsoil') || l.includes('seed') || l.includes('edging') || l.includes('cleanup') || l.includes('powerwashing') || l.includes('fabric') || l.includes('stone') || l.includes('polymeric') || l.includes('prep')) return 'landscaping';
    if (l.includes('cabling') || l.includes('cobra') || l.includes('phc')) return 'phc';
    if (l.includes('plant')) return 'planting';
    if (l.includes('priority') || l.includes('adjustment') || l.includes('minimum') || l.includes('discount')) return 'adjustment';
    if (l.includes('worker') || l.includes('climber') || l.includes('truck') || l.includes('crane') || l.includes('spider') || l.includes('grapple') || l.includes('equipment') || l.includes('mat')) return 'labor';
    return 'other';
  }

  // ── Cloud save / load ──────────────────────────────────────────────────
  async function cloudSave() {
    if (cloud.saving) return;
    cloud.saving = true;
    try {
      const q = computeQuote();
      const totalCents = Math.round((q.grand || 0) * 100);
      const snapshot = {
        state: { ...state, svcActive: [...state.svcActive] },
        seq, topsoilMode,
        fields: collectFields(),
      };
      const body = {
        customer_id: cloud.customerId,
        property_id: cloud.propertyId,
        snapshot_jsonb: snapshot,
        notes: null,
        lines: normalizeLines(),
        total_cents: totalCents,
      };

      let result;
      if (cloud.quoteId) {
        result = await window.TQAuth.apiJson('/.netlify/functions/crm-quotes?id=' + encodeURIComponent(cloud.quoteId), {
          method: 'PATCH', body,
        });
      } else {
        result = await window.TQAuth.apiJson('/.netlify/functions/crm-quotes', { method: 'POST', body });
        if (result?.quote?.id) {
          cloud.quoteId = result.quote.id;
          const url = new URL(location.href);
          url.searchParams.set('quote_id', cloud.quoteId);
          history.replaceState({}, '', url.toString());
        }
      }
    } catch (e) {
      console.warn('cloud save failed:', e.message);
    } finally {
      cloud.saving = false;
    }
  }

  const scheduleSave = debounce(() => { if (cloud.enabled) cloudSave(); }, 1500);

  function collectFields() {
    const ids = (typeof PERSIST_IDS !== 'undefined') ? PERSIST_IDS : [];
    const cks = (typeof PERSIST_CHECKS !== 'undefined') ? PERSIST_CHECKS : [];
    const out = {};
    ids.forEach(id => { const el = document.getElementById(id); if (el) out[id] = el.value; });
    cks.forEach(id => { const el = document.getElementById(id); if (el) out[id] = el.checked; });
    return out;
  }

  function applySnapshot(snap) {
    if (!snap || !snap.state) return;
    Object.assign(state, snap.state);
    state.svcActive = new Set(snap.state.svcActive || []);
    if (typeof seq !== 'undefined' && snap.seq != null) {
      // seq is module-scoped let; rebind via window if exposed
      try { seq = snap.seq; } catch (_) {}
    }
    if (typeof topsoilMode !== 'undefined' && snap.topsoilMode) {
      try { topsoilMode = snap.topsoilMode; } catch (_) {}
    }
    const fields = snap.fields || {};
    const ids = (typeof PERSIST_IDS !== 'undefined') ? PERSIST_IDS : [];
    const cks = (typeof PERSIST_CHECKS !== 'undefined') ? PERSIST_CHECKS : [];
    ids.forEach(id => { const el = document.getElementById(id); if (el && fields[id] != null) el.value = fields[id]; });
    cks.forEach(id => { const el = document.getElementById(id); if (el && fields[id] != null) el.checked = fields[id]; });
    if (typeof updateSections === 'function') updateSections();
    if (typeof renderTrees === 'function') renderTrees();
    if (typeof recalc === 'function') recalc();
  }

  async function cloudLoad(id) {
    try {
      const data = await window.TQAuth.apiJson('/.netlify/functions/crm-quotes?id=' + encodeURIComponent(id));
      cloud.quoteId = data.quote.id;
      cloud.customerId = data.quote.customer_id || null;
      cloud.propertyId = data.quote.property_id || null;
      cloud.customer = data.quote.crm_customers || null;
      cloud.property = data.quote.crm_properties || null;
      applySnapshot(data.quote.snapshot_jsonb);
      updateHeaderBar();
    } catch (e) {
      alert('Failed to load quote: ' + e.message);
    }
  }

  async function loadCustomerProperty() {
    if (cloud.customerId && !cloud.customer) {
      try {
        const data = await window.TQAuth.apiJson('/.netlify/functions/customers?id=' + encodeURIComponent(cloud.customerId));
        cloud.customer = data.customer;
        if (cloud.propertyId) {
          cloud.property = (data.properties || []).find(p => p.id === cloud.propertyId) || null;
        } else if (data.properties?.length) {
          cloud.property = data.properties[0];
          cloud.propertyId = cloud.property.id;
        }
      } catch (e) {}
    }
    updateHeaderBar();
  }

  async function saveAndSend() {
    if (!cloud.enabled) { alert('Please sign in to send.'); return; }
    await cloudSave();
    if (!cloud.quoteId) { alert('Save failed. Try again.'); return; }
    try {
      await window.TQAuth.apiJson('/.netlify/functions/crm-quotes/transition', {
        method: 'POST', body: { id: cloud.quoteId, to_status: 'sent' },
      });
    } catch (e) {
      try {
        await window.TQAuth.apiJson('/.netlify/functions/crm-quotes?action=transition', {
          method: 'POST', body: { id: cloud.quoteId, to_status: 'sent' },
        });
      } catch (e2) {
        alert('Transition failed: ' + e2.message);
        return;
      }
    }
    location.href = '/quote-detail.html?id=' + encodeURIComponent(cloud.quoteId);
  }

  // ── Override the localStorage saveQuote with a cloud-aware version ────
  const _origSave = window.saveQuote;
  window.saveQuote = function () {
    if (cloud.enabled) {
      // Skip localStorage entirely when signed in (autosave handles cloud).
      // Defer to debounced cloud save.
      if (cloud.initialLoaded) scheduleSave();
      return;
    }
    if (typeof _origSave === 'function') _origSave();
  };

  // ── Boot ──────────────────────────────────────────────────────────────
  async function boot() {
    injectHeaderBar();
    if (!window.TQAuth) return; // anonymous mode — localStorage stays in charge

    let session = null;
    try { session = await window.TQAuth.getSession(); } catch (_) {}
    if (!session) return; // anonymous; localStorage stays

    let profile = null;
    try { profile = await window.TQAuth.getProfile(); } catch (_) {}
    if (!profile) return;
    cloud.profile = profile;
    cloud.enabled = true;

    if (cloud.quoteId) {
      await cloudLoad(cloud.quoteId);
    } else if (cloud.customerId) {
      await loadCustomerProperty();
      updateHeaderBar();
    } else {
      updateHeaderBar();
    }
    cloud.initialLoaded = true;
  }

  // Wait for window load so the existing init has run.
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
</script>
</body>"""

if "</body>" not in src:
    raise SystemExit("ERROR: </body> not found")
src = src.replace("</body>", BODY_INJECT, 1)

PATH.write_text(src, encoding="utf-8")
print(f"patched spartan_pricing_tool.html ({len(src)} bytes)")
