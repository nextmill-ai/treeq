"""Patch spartan_pricing_tool.html with new trim engine."""
import re, sys

TARGET = r'C:\Users\camer\Projects\Claude Cowork\TreeQ\treeq\deploy\public\spartan_pricing_tool.html'
CANONICAL = r'C:\Users\camer\Projects\Claude Cowork\TreeQ\treeq\spartan_pricing_tool.html'

with open(TARGET, encoding='utf-8') as f:
    c = f.read()

orig_len = len(c)
applied = []

def rep(old, new, tag):
    global c
    if old not in c:
        print(f'MISS  [{tag}]')
        return
    c = c.replace(old, new, 1)
    applied.append(tag)
    print(f'OK    [{tag}]')

# ── 1. addTree trim model ────────────────────────────────────────────────────
rep(
    "  if (type === 'trim') Object.assign(base, { numCuts:1, rigging:'none', workHeight:20, leadUnion:0, leadLength:0, hBucket:0, hClimber:0, hGround:0, nGround:1, hChip:0, hazard:'none' });",
    "  if (type === 'trim') Object.assign(base, {\n"
    "    label:'', highLifeline:false, activeRigTab:'noRig',\n"
    "    noRig:   { h15:0, h20:0, h30:0, h40:0 },\n"
    "    basicRig:{ h15:0, h20:0, h30:0, h40:0 },\n"
    "    advRig:  { h15:0, h20:0, h30:0, h40:0 },\n"
    "    majorTrim:false, leads:[], saved:false\n"
    "  });",
    'addTree trim model'
)

# ── 2. setTree boolean support ───────────────────────────────────────────────
rep(
    "  if (key === 'loaderRequired') t[key] = !!val;",
    "  if (key === 'loaderRequired' || key === 'highLifeline' || key === 'majorTrim' || key === 'saved') t[key] = !!val;",
    'setTree booleans'
)

# ── 3. priceTrim rewrite (replace old function, insert two new helpers before) ─
old_priceTrim = (
    "function priceTrim(t) {\n"
    "  const hourly = t.hBucket*V.rateBucket + t.hClimber*V.rateClimber + (t.hGround*t.nGround)*V.rateGround + t.hChip*V.rateChip;\n"
    "  const floors = [];\n"
    "  if (t.numCuts === 1) floors.push({ name:'1 cut', v: V.trim1 });\n"
    "  else if (t.numCuts === 2) floors.push({ name:'2 cuts', v: V.trim2 });\n"
    "  if (t.rigging === 'some') floors.push({ name:'rigging', v: V.trimRig });\n"
    "  else if (t.rigging === 'lifeline') floors.push({ name: t.numCuts>1?'multi-hi lifeline':'single-hi lifeline', v: t.numCuts>1?V.trimHiN:V.trimHi1 });\n"
    "  if (t.workHeight >= 40) floors.push({ name:'40ft', v: V.trim40 });\n"
    "  else if (t.workHeight >= 30) floors.push({ name:'30ft', v: V.trim30 });\n"
    "  const highestFloor = floors.length ? Math.max(...floors.map(f=>f.v)) : 0;\n"
    "  const base = Math.max(hourly, highestFloor);\n"
    "  let limbCharge = 0;\n"
    "  if (t.leadUnion >= V.limbThreshold && t.leadLength > 0) {\n"
    "    const hFloor = V.removalFloorPerFt * t.leadLength;\n"
    "    const dFloor = t.leadUnion > 16 ? V.dbhFloor * t.leadUnion : 0;\n"
    "    limbCharge = Math.max(hFloor, dFloor);\n"
    "  }\n"
    "  const work = base + limbCharge;\n"
    "  const floorStr = floors.map(f=>`${f.name} ${fmt(f.v)}`).join(' · ');\n"
    "  const detail = [hourly > 0 ? `Hourly ${fmt(hourly)}` : null, floorStr || null, `→ ${fmt(base)}`, limbCharge > 0 ? `+ limb-as-tree ${fmt(limbCharge)} = ${fmt(work)}` : null].filter(Boolean).join(' · ');\n"
    "  return { work, detail };\n"
    "}"
)
new_priceTrim = """\
function priceCutsForGroup(count, hKey, totalCuts) {
  if (count <= 0) return 0;
  const vd = totalCuts >= 5 ? 0.5 : 1.0;
  if (hKey === 'h15') {
    if (count === 1) return 75;
    let p = 50;
    for (let i = 1; i < count; i++) p += 50 * vd;
    return p;
  }
  const rates = { h20:[100,50], h30:[150,75], h40:[200,75] };
  const [first, addl] = rates[hKey] || [100,50];
  let p = first;
  for (let i = 1; i < count; i++) p += addl * vd;
  return p;
}

function priceLead(lead) {
  const dia = lead.dia || 0, len = lead.length || 0;
  if (!dia || !len) return 0;
  let hFloor, dFloor;
  if (lead.rigging === 'moderate')      { hFloor = V.rigFloorMod * len;     dFloor = dia > 16 ? V.dbhFloorMod * dia : 0; }
  else if (lead.rigging === 'complex') { hFloor = V.rigFloorComplex * len;  dFloor = dia > 16 ? V.dbhFloorComplex * dia : 0; }
  else                                  { hFloor = V.removalFloorPerFt * len; dFloor = dia > 16 ? V.dbhFloor * dia : 0; }
  return Math.max(hFloor, dFloor) * hazMultFor(lead.hazard || 'none');
}

function priceTrim(t) {
  const rigGroups = [
    { key:'noRig',   mult:1.0,  lbl:'' },
    { key:'basicRig', mult:1.25, lbl:' (basic rig)' },
    { key:'advRig',  mult:2.0,  lbl:' (adv rig)' },
  ];
  const hKeys = ['h15','h20','h30','h40'];
  const hLbls = { h15:'<20ft', h20:'20ft', h30:'30ft', h40:'40ft' };
  const totalCuts = rigGroups.reduce((s,g) => s + hKeys.reduce((hs,hk) => hs + (t[g.key]?.[hk] || 0), 0), 0);
  let subtotal = 0;
  const parts = [];
  rigGroups.forEach(g => {
    hKeys.forEach(hk => {
      const count = t[g.key]?.[hk] || 0;
      if (!count) return;
      const cost = priceCutsForGroup(count, hk, totalCuts) * g.mult;
      subtotal += cost;
      parts.push(`${count}× ${hLbls[hk]}${g.lbl} ${fmt(cost)}`);
    });
  });
  let lifeline = 0;
  if (t.highLifeline && subtotal > 0 && subtotal <= 300) lifeline = Math.min(subtotal * 0.5, 200);
  let leadTotal = 0;
  if (t.majorTrim && t.leads?.length) t.leads.forEach(l => { leadTotal += priceLead(l); });
  if (lifeline > 0) parts.push(`+lifeline ${fmt(lifeline)}`);
  if (leadTotal > 0) parts.push(`+major leads ${fmt(leadTotal)}`);
  return { work: subtotal + lifeline + leadTotal, detail: parts.join(' · ') };
}"""
rep(old_priceTrim, new_priceTrim, 'priceTrim rewrite')

# ── 4. treeItemTitle trim line ───────────────────────────────────────────────
rep(
    "  if (t.type === 'trim') return `${t.numCuts} cut${t.numCuts!==1?'s':''} @ ${t.workHeight}ft${t.label ? ' — '+t.label : ''}`;",
    "  if (t.type === 'trim') {\n"
    "    const rgs=['noRig','basicRig','advRig'], hks=['h15','h20','h30','h40'];\n"
    "    const tc = rgs.reduce((s,g) => s + hks.reduce((hs,hk) => hs + (t[g]?.[hk] || 0), 0), 0);\n"
    "    return (tc > 0 ? `${tc} cut${tc!==1?'s':''}` : 'New Trim') + (t.label ? ` — ${t.label}` : '');\n"
    "  }",
    'treeItemTitle trim'
)

# ── 5. renderTreeBody — add saved trim branch ────────────────────────────────
rep(
    "function renderTreeBody(t, r) {\n"
    "  if (t.type === 'takedown') return renderTakedownBody(t);\n"
    "  if (t.type === 'removal') return renderRemovalBody(t, r);\n"
    "  return renderTrimBody(t, r);\n"
    "}",
    "function renderTreeBody(t, r) {\n"
    "  if (t.type === 'takedown') return renderTakedownBody(t);\n"
    "  if (t.type === 'removal') return renderRemovalBody(t, r);\n"
    "  if (t.type === 'trim' && t.saved) return renderTrimCollapsed(t);\n"
    "  return renderTrimBody(t, r);\n"
    "}",
    'renderTreeBody saved branch'
)

# ── 6. renderTrimBody full rewrite + new render helpers ──────────────────────
old_trimBody_start = "function renderTrimBody(t, r) {\n  const atThreshold"
old_trimBody_end   = "    ${r.detail ? `<div class=\"tree-detail\">${r.detail}</div>` : ''}\n  </div>`;\n}"

idx_s = c.find(old_trimBody_start)
idx_e = c.find(old_trimBody_end, idx_s) + len(old_trimBody_end)

if idx_s < 0 or idx_e < len(old_trimBody_end):
    print('MISS  [renderTrimBody bounds]')
else:
    new_trim_block = """\
function renderTrimHeightRows(t, rigKey) {
  const rows = [
    { key:'h15', lbl:'< 20 ft',      note:'$75 min · $50/cut' },
    { key:'h20', lbl:'20 – 29 ft',   note:'$100 first · $50 ea.' },
    { key:'h30', lbl:'30 – 39 ft',   note:'$150 first · $75 ea.' },
    { key:'h40', lbl:'40 ft +',      note:'$200 first · $75 ea.' },
  ];
  return rows.map(h => {
    const cnt = t[rigKey]?.[h.key] || 0;
    return `<div class="trim-h-row">
      <div class="trim-h-info"><div class="trim-h-lbl">${h.lbl}</div><div class="trim-h-note">${h.note}</div></div>
      <div class="stepper" style="width:180px;flex-shrink:0;">
        <button class="step-btn" onclick="stepTrimCuts(${t.id},'${rigKey}','${h.key}',-1)">−</button>
        <input type="number" value="${cnt}" min="0" step="1" inputmode="numeric" oninput="setTrimCuts(${t.id},'${rigKey}','${h.key}',this.value)" onchange="setTrimCuts(${t.id},'${rigKey}','${h.key}',this.value)">
        <button class="step-btn" onclick="stepTrimCuts(${t.id},'${rigKey}','${h.key}',1)">+</button>
      </div>
    </div>`;
  }).join('');
}

function renderLeadHazardSeg(tId, idx, hazard) {
  const b = (s,l) => `<button class="seg-btn${hazard===s?' on':''}" onclick="setTrimLead(${tId},${idx},'hazard','${s}')">${l}</button>`;
  return `<div style="margin-top:8px;"><label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-3);margin-bottom:6px;display:block;">Hazard</label>
    <div class="seg">${b('none','None')}${b('obstacle','Obstacle 2x')}${b('house','Power Lines 2x')}${b('high','High Power 3x')}</div></div>`;
}

function renderTrimLeads(t) {
  let html = '<div class="trim-leads">';
  (t.leads || []).forEach((lead, idx) => {
    html += `<div class="trim-lead-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:11px;font-weight:700;color:var(--ink-3);">LEAD ${idx+1}</span>
        <button class="rm-btn" onclick="removeTrimLead(${t.id},${idx})">×</button>
      </div>
      <div class="fg" style="margin-bottom:8px;">
        <div class="f"><label>Union Dia (in)</label>
          <input type="number" value="${lead.dia||0}" min="0" step="0.5" inputmode="decimal" oninput="setTrimLead(${t.id},${idx},'dia',this.value)">
        </div>
        <div class="f"><label>Lead Length (ft)</label>
          <input type="number" value="${lead.length||0}" min="0" step="1" inputmode="numeric" oninput="setTrimLead(${t.id},${idx},'length',this.value)">
        </div>
      </div>
      <label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-3);margin-bottom:6px;display:block;">Rigging</label>
      <div class="seg" style="margin-bottom:8px;">
        <button class="seg-btn${(lead.rigging||'none')==='none'?' on':''}" onclick="setTrimLead(${t.id},${idx},'rigging','none')">None</button>
        <button class="seg-btn${lead.rigging==='moderate'?' on':''}" onclick="setTrimLead(${t.id},${idx},'rigging','moderate')">Moderate</button>
        <button class="seg-btn${lead.rigging==='complex'?' on':''}" onclick="setTrimLead(${t.id},${idx},'rigging','complex')">Complex</button>
      </div>
      ${renderLeadHazardSeg(t.id, idx, lead.hazard||'none')}
    </div>`;
  });
  html += `<button class="add-tree" style="margin-top:8px;" onclick="addTrimLead(${t.id})">+ Add Lead</button>`;
  html += '</div>';
  return html;
}

function renderTrimCollapsed(t) {
  return `<div class="tree-body" style="padding:10px var(--pad);">
    <button class="add-tree" onclick="unsaveTrim(${t.id})">Edit Trim</button>
  </div>`;
}

function renderTrimBody(t, r) {
  const tab = t.activeRigTab || 'noRig';
  const tabBtn = (key, lbl) => `<button class="trim-tab${tab===key?' on':''}" onclick="setTrimTab(${t.id},'${key}')">${lbl}</button>`;
  return `<div class="tree-body">
    <div class="f" style="margin-bottom:12px;"><label>Tree Label</label>
      <input type="text" value="${t.label}" placeholder="e.g. Front oak" oninput="setTreeStr(${t.id},'label',this.value)">
    </div>
    <div class="ck-row" style="margin-bottom:14px;" onclick="setTree(${t.id},'highLifeline',!${t.highLifeline})">
      <input type="checkbox" ${t.highLifeline?'checked':''} onclick="event.stopPropagation()" onchange="setTree(${t.id},'highLifeline',this.checked)">
      <div><div class="ck-lbl">High Lifeline</div><div class="ck-sub">+50% or +$200 whichever is less · no effect if total &gt; $300</div></div>
    </div>
    <div class="trim-tabs" style="margin-bottom:10px;">
      ${tabBtn('noRig','No Rigging')}${tabBtn('basicRig','Basic Rigging')}${tabBtn('advRig','Adv. Rigging')}
    </div>
    ${renderTrimHeightRows(t, tab)}
    <div class="ck-row" style="margin:14px 0 8px;" onclick="setTree(${t.id},'majorTrim',!${t.majorTrim})">
      <input type="checkbox" ${t.majorTrim?'checked':''} onclick="event.stopPropagation()" onchange="setTree(${t.id},'majorTrim',this.checked)">
      <div><div class="ck-lbl">Major Trim — leads over 8″ dia</div><div class="ck-sub">Each large lead priced as a removal</div></div>
    </div>
    ${t.majorTrim ? renderTrimLeads(t) : ''}
    ${r.detail ? `<div class="tree-detail">${r.detail}</div>` : ''}
    <button class="trim-save-btn" onclick="saveTrim(${t.id})">Save Trim</button>
  </div>`;
}"""
    c = c[:idx_s] + new_trim_block + c[idx_e:]
    applied.append('renderTrimBody + helpers')
    print('OK    [renderTrimBody + helpers]')

# ── 7. Trim state management functions (insert before treeItemTitle) ──────────
rep(
    "function treeItemTitle(t) {",
    "function setTrimCuts(id, rigKey, hKey, val) {\n"
    "  const t = state.trees.find(t => t.id === id);\n"
    "  if (!t || !t[rigKey]) return;\n"
    "  t[rigKey][hKey] = Math.max(0, Number(val) || 0);\n"
    "  renderTrees();\n"
    "}\n"
    "function stepTrimCuts(id, rigKey, hKey, delta) {\n"
    "  const t = state.trees.find(t => t.id === id);\n"
    "  if (!t || !t[rigKey]) return;\n"
    "  t[rigKey][hKey] = Math.max(0, (t[rigKey][hKey] || 0) + delta);\n"
    "  renderTrees();\n"
    "}\n"
    "function setTrimTab(id, tab) {\n"
    "  const t = state.trees.find(t => t.id === id);\n"
    "  if (t) { t.activeRigTab = tab; renderTrees(); }\n"
    "}\n"
    "function addTrimLead(id) {\n"
    "  const t = state.trees.find(t => t.id === id);\n"
    "  if (!t) return;\n"
    "  t.leads.push({ dia:0, length:0, rigging:'none', hazard:'none' });\n"
    "  renderTrees();\n"
    "}\n"
    "function removeTrimLead(id, idx) {\n"
    "  const t = state.trees.find(t => t.id === id);\n"
    "  if (!t) return;\n"
    "  t.leads.splice(idx, 1);\n"
    "  renderTrees();\n"
    "}\n"
    "function setTrimLead(id, idx, key, val) {\n"
    "  const t = state.trees.find(t => t.id === id);\n"
    "  if (!t || !t.leads[idx]) return;\n"
    "  t.leads[idx][key] = isNaN(Number(val)) ? val : (Number(val) || 0);\n"
    "  renderTrees();\n"
    "}\n"
    "function saveTrim(id) {\n"
    "  const t = state.trees.find(t => t.id === id);\n"
    "  if (t) { t.saved = true; renderTrees(); }\n"
    "}\n"
    "function unsaveTrim(id) {\n"
    "  const t = state.trees.find(t => t.id === id);\n"
    "  if (t) { t.saved = false; renderTrees(); }\n"
    "}\n"
    "function treeItemTitle(t) {",
    'trim state functions'
)

# ── 8. focusSvc — add recalc ─────────────────────────────────────────────────
rep(
    "function focusSvc(svc) {\n"
    "  state.openSvc = state.openSvc === svc ? null : svc;\n"
    "  updateSections();\n"
    "  updateSvcButtons();\n"
    "}",
    "function focusSvc(svc) {\n"
    "  state.openSvc = state.openSvc === svc ? null : svc;\n"
    "  updateSections();\n"
    "  updateSvcButtons();\n"
    "  recalc();\n"
    "}",
    'focusSvc recalc'
)

# ── 9. recalc — bar label + item count ───────────────────────────────────────
rep(
    "  $('totalDisplay').textContent = fmt(q.grand);",
    "  const itemCount = q.lines.length;\n"
    "  $('barCount').textContent = itemCount > 0 ? '(' + itemCount + ')' : '';\n"
    "  if (state.openSvc) {\n"
    "    $('barLabel').textContent = 'Item Total';\n"
    "    $('totalDisplay').textContent = fmt(rawSvcTotal(state.openSvc));\n"
    "  } else {\n"
    "    $('barLabel').textContent = 'Quote Total';\n"
    "    $('totalDisplay').textContent = fmt(q.grand);\n"
    "  }",
    'recalc bar'
)

# ── 10. Bottom bar HTML ───────────────────────────────────────────────────────
rep(
    "  <div id=\"total-tap\" onclick=\"toggleSheet()\">\n"
    "    <span class=\"lbl\">Quote Total</span>\n"
    "    <span class=\"amt\" id=\"totalDisplay\">$0</span>\n"
    "    <span class=\"chev\" id=\"chevron\">▲</span>\n"
    "  </div>",
    "  <div id=\"total-tap\" onclick=\"toggleSheet()\">\n"
    "    <div><span class=\"lbl\" id=\"barLabel\">Quote Total</span><span class=\"bar-count\" id=\"barCount\"></span></div>\n"
    "    <span class=\"amt gold\" id=\"totalDisplay\">$0</span>\n"
    "    <span class=\"chev\" id=\"chevron\">▲</span>\n"
    "  </div>",
    'bottom bar HTML'
)

# ── 11. CSS additions ─────────────────────────────────────────────────────────
rep(
    "/* BOTTOM BAR */",
    "/* TRIM UI */\n"
    ".trim-tabs{display:flex;border:1.5px solid var(--line);border-radius:var(--r-md);overflow:hidden;}\n"
    ".trim-tab{flex:1;padding:10px 4px;border:none;background:var(--surface-2);font-size:11px;font-weight:700;cursor:pointer;text-align:center;border-right:1px solid var(--line);color:var(--ink-3);transition:all .1s;}\n"
    ".trim-tab:last-child{border-right:none;}\n"
    ".trim-tab.on{background:var(--forest);color:#fff;}\n"
    ".trim-h-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);}\n"
    ".trim-h-row:last-child{border-bottom:none;margin-bottom:10px;}\n"
    ".trim-h-info{flex:1;min-width:0;}\n"
    ".trim-h-lbl{font-size:13px;font-weight:700;color:var(--ink);}\n"
    ".trim-h-note{font-size:11px;color:var(--ink-3);margin-top:2px;}\n"
    ".trim-leads{margin-top:4px;}\n"
    ".trim-lead-card{background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-md);padding:12px;margin-bottom:10px;}\n"
    ".trim-save-btn{width:100%;margin-top:16px;padding:15px;border-radius:var(--r-md);border:none;background:var(--forest);color:#fff;font-size:15px;font-weight:700;cursor:pointer;}\n"
    ".trim-save-btn:active{background:var(--forest-deep);}\n"
    ".bar-count{font-size:11px;font-weight:600;color:var(--gold-bright);opacity:.75;margin-left:6px;}\n"
    "#total-tap .amt.gold{color:var(--gold-bright);}\n"
    "/* BOTTOM BAR */",
    'CSS trim + bar'
)

# ── Write ─────────────────────────────────────────────────────────────────────
with open(TARGET, 'w', encoding='utf-8') as f:
    f.write(c)
import shutil
shutil.copy(TARGET, CANONICAL)

print(f'\n{len(applied)}/{len(applied)+0} replacements applied')
print(f'File: {orig_len} -> {len(c)} bytes')
