"""Patch dashboard.html to add rollup cards (Task 17).
Inserts a thin row of stats (quotes/customers/won this month) and a
"Recent quotes" + "Recent customers" stack between the header and chips.
Idempotent via marker check.
"""
from pathlib import Path
PATH = Path(r"C:\Users\camer\Projects\Claude Cowork\TreeQ\treeq\dashboard.html")
src = PATH.read_text(encoding="utf-8")

MARKER = "ROLLUP-INJECTED"
if MARKER in src:
    print("dashboard.html already patched; nothing to do.")
    raise SystemExit(0)

# Inject the CSS additions before </style>
ROLLUP_CSS = """
  /* ROLLUP-INJECTED-CSS */
  .rollup-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 4px 0 4px; }
  .rollup-card { background: white; border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px;
    box-shadow: var(--shadow); }
  .rollup-card .lbl { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .rollup-card .val { font-size: 17px; font-weight: 700; color: var(--ink); }
  .rollup-card .sub { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .recents { background: white; border: 1px solid var(--border); border-radius: 12px;
    padding: 10px 12px; box-shadow: var(--shadow); margin-top: 4px; }
  .recents h3 { margin: 0 0 6px; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
  .recents .r-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px dashed var(--border);
    text-decoration: none; color: var(--ink); font-size: 13px; }
  .recents .r-row:last-child { border-bottom: none; }
  .recents .r-row .num { color: var(--forest); font-weight: 700; min-width: 32px; }
  .recents .r-row .main { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .recents .r-row .v { font-weight: 600; }
  .recents .more { display: block; text-align: center; font-size: 12px; color: var(--forest); text-decoration: none;
    margin-top: 6px; padding: 4px; }
  .quicklinks { display: flex; gap: 6px; margin-top: 4px; }
  .quicklinks a { flex: 1; padding: 8px 10px; background: white; border: 1px solid var(--border); border-radius: 10px;
    color: var(--forest); font-size: 12px; font-weight: 600; text-decoration: none; text-align: center; }
"""
src = src.replace("[hidden] { display: none !important; }", ROLLUP_CSS + "\n  [hidden] { display: none !important; }", 1)

# Inject markup right after the header inside #home
ROLLUP_HTML = """  </header>

  <!-- ROLLUP-INJECTED -->
  <div class="quicklinks">
    <a href="/quotes.html">Quotes</a>
    <a href="/customers.html">Customers</a>
    <a href="/spartan_pricing_tool.html">New quote</a>
    <a href="/settings.html">Settings</a>
  </div>

  <div class="rollup-cards" id="rollup-cards">
    <div class="rollup-card"><div class="lbl">Open quotes</div><div class="val" id="r-open">—</div><div class="sub" id="r-open-sub">draft + sent</div></div>
    <div class="rollup-card"><div class="lbl">Won this month</div><div class="val" id="r-won">—</div><div class="sub" id="r-won-sub">&nbsp;</div></div>
    <div class="rollup-card"><div class="lbl">Quotes this month</div><div class="val" id="r-month">—</div><div class="sub" id="r-month-sub">&nbsp;</div></div>
    <div class="rollup-card"><div class="lbl">Customers</div><div class="val" id="r-cust">—</div><div class="sub">total</div></div>
  </div>

  <div class="recents">
    <h3>Recent quotes</h3>
    <div id="recent-quotes"><div style="color:var(--muted);font-size:12px">Loading…</div></div>
    <a class="more" href="/quotes.html">All quotes →</a>
  </div>

  <div class="recents">
    <h3>Recent customers</h3>
    <div id="recent-customers"><div style="color:var(--muted);font-size:12px">Loading…</div></div>
    <a class="more" href="/customers.html">All customers →</a>
  </div>
"""
src = src.replace("  </header>\n", ROLLUP_HTML, 1)

# Append a script block (loads supabase + auth-client if not present, then fills rollup)
ROLLUP_JS = """
<script>
  if (!window.__SUPABASE_URL__) {
    window.__SUPABASE_URL__ = 'https://bhbubaopejjxijiqmujy.supabase.co';
    window.__SUPABASE_ANON_KEY__ = 'sb_publishable_CT6kIbqjVG5sbWLn_E1hQw_Hir_U65U';
  }
</script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js" crossorigin="anonymous"></script>
<script src="/assets/auth-client.js"></script>
<script>
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function monthStartISO() {
    const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)).toISOString();
  }
  async function load() {
    if (!window.TQAuth) return;
    const session = await window.TQAuth.getSession();
    if (!session) return;
    const from = monthStartISO();
    try {
      const [open, won, month, custs] = await Promise.all([
        window.TQAuth.apiJson('/.netlify/functions/crm-quotes?status=draft,sent&limit=1'),
        window.TQAuth.apiJson('/.netlify/functions/crm-quotes?status=won&from=' + encodeURIComponent(from) + '&limit=200'),
        window.TQAuth.apiJson('/.netlify/functions/crm-quotes?from=' + encodeURIComponent(from) + '&limit=200'),
        window.TQAuth.apiJson('/.netlify/functions/customers?limit=1'),
      ]);
      document.getElementById('r-open').textContent = open.total ?? (open.quotes || []).length;
      const wonSum = (won.quotes || []).reduce((s, q) => s + (q.total_cents || 0), 0);
      document.getElementById('r-won').textContent = won.total ?? (won.quotes || []).length;
      document.getElementById('r-won-sub').textContent = window.TQAuth.fmtMoney(wonSum);
      const monthSum = (month.quotes || []).reduce((s, q) => s + (q.total_cents || 0), 0);
      document.getElementById('r-month').textContent = month.total ?? (month.quotes || []).length;
      document.getElementById('r-month-sub').textContent = window.TQAuth.fmtMoney(monthSum);
      document.getElementById('r-cust').textContent = custs.total ?? (custs.customers || []).length;
    } catch (_) {}

    try {
      const r = await window.TQAuth.apiJson('/.netlify/functions/crm-quotes?limit=10');
      const el = document.getElementById('recent-quotes');
      const quotes = r.quotes || [];
      if (quotes.length === 0) {
        el.innerHTML = '<div style="color:var(--muted);font-size:12px">No quotes yet.</div>';
      } else {
        el.innerHTML = quotes.map(q => `
          <a class="r-row" href="/quote-detail.html?id=${encodeURIComponent(q.id)}">
            <span class="num">#${q.quote_number}</span>
            <span class="main">${esc(q.crm_customers?.name || 'No customer')}</span>
            <span class="v">${window.TQAuth.fmtMoney(q.total_cents)}</span>
          </a>
        `).join('');
      }
    } catch (_) {}

    try {
      const r = await window.TQAuth.apiJson('/.netlify/functions/customers?limit=5');
      const el = document.getElementById('recent-customers');
      const list = r.customers || [];
      if (list.length === 0) {
        el.innerHTML = '<div style="color:var(--muted);font-size:12px">No customers yet.</div>';
      } else {
        el.innerHTML = list.map(c => `
          <a class="r-row" href="/customer-detail.html?id=${encodeURIComponent(c.id)}">
            <span class="main">${esc(c.name)}</span>
            <span style="font-size:11px;color:var(--muted)">${esc(c.primary_phone || c.primary_email || '')}</span>
          </a>
        `).join('');
      }
    } catch (_) {}
  }
  if (document.readyState === 'complete') load();
  else window.addEventListener('load', load);
})();
</script>
</body>"""
src = src.replace("</body>", ROLLUP_JS, 1)

PATH.write_text(src, encoding="utf-8")
print(f"patched dashboard.html ({len(src)} bytes)")
