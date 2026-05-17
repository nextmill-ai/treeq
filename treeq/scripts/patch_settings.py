"""Patch settings.html — replace the Team stub with real team management UI
and append the JS handlers before </script>.
Idempotent: re-running detects existing markers and aborts.
"""
import re
from pathlib import Path

PATH = Path(r"C:\Users\camer\Projects\Claude Cowork\TreeQ\treeq\settings.html")
src = PATH.read_text(encoding="utf-8")

MARKER = "<!-- TEAM-MGMT-INJECTED -->"
if MARKER in src:
    print("settings.html already patched; nothing to do.")
    raise SystemExit(0)

# 1. Replace the Team tab body
new_panel = '''    <!-- Team tab -->
    <div id="tab-team" class="tab-panel">
      <!-- TEAM-MGMT-INJECTED -->
      <div class="section-card">
        <div class="section-header">Your team</div>
        <div class="section-body">
          <p style="font-size:.875rem;color:var(--muted);margin-bottom:1rem">
            Invite teammates to your account. Owners can manage roles and remove members.
          </p>
          <div id="members-list" style="display:flex;flex-direction:column;gap:.5rem">
            <span style="color:var(--muted);font-size:.875rem">Loading…</span>
          </div>
        </div>
      </div>

      <div class="section-card" style="margin-top:1rem">
        <div class="section-header">Invite a teammate</div>
        <div class="section-body">
          <div class="field">
            <label for="invite-email">Email</label>
            <input type="email" id="invite-email" placeholder="teammate@example.com">
          </div>
          <div class="field">
            <label for="invite-role">Role</label>
            <select id="invite-role">
              <option value="estimator">Estimator (build &amp; send quotes)</option>
              <option value="admin">Admin (manage team + quotes)</option>
              <option value="viewer">Viewer (read-only)</option>
            </select>
          </div>
          <div class="row-actions">
            <button class="btn btn-primary" id="btn-invite" onclick="createInvite()">Generate invite link</button>
          </div>
          <div id="invite-result" style="margin-top:.75rem;display:none">
            <p style="font-size:.875rem;color:var(--muted);margin-bottom:.4rem">
              Share this link with your teammate. Expires in 7 days.
            </p>
            <div style="display:flex;gap:.5rem;align-items:center">
              <input type="text" id="invite-link" readonly style="flex:1;font-size:.8rem">
              <button class="btn btn-ghost" type="button" onclick="copyInviteLink()">Copy</button>
            </div>
          </div>
        </div>
      </div>

      <div class="section-card" style="margin-top:1rem">
        <div class="section-header">Pending invitations</div>
        <div class="section-body">
          <div id="invites-list" style="display:flex;flex-direction:column;gap:.5rem">
            <span style="color:var(--muted);font-size:.875rem">Loading…</span>
          </div>
        </div>
      </div>
    </div>
'''

old_panel_pattern = re.compile(
    r'    <!-- Team tab \(P5 stub\) -->\s*\n'
    r'    <div id="tab-team" class="tab-panel">.*?    </div>\n'
    r'(?=\s*\n\s*<!-- danger zone -->)',
    re.DOTALL,
)
if not old_panel_pattern.search(src):
    print("ERROR: could not locate Team tab stub.")
    raise SystemExit(1)
src = old_panel_pattern.sub(new_panel, src, count=1)

# 2. Append the JS handlers right before init();
new_js = r"""

// ── Team / Invitations management (Task 11) ──────────────────────────────
async function teamApi(path, opts) {
  const o = Object.assign({}, opts || {});
  const headers = new Headers(o.headers || {});
  if (o.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (currentSession?.access_token) headers.set('Authorization', 'Bearer ' + currentSession.access_token);
  o.headers = headers;
  if (o.body && typeof o.body === 'object') o.body = JSON.stringify(o.body);
  const r = await fetch(path, o);
  let body = null;
  try { body = await r.json(); } catch (_) {}
  if (!r.ok && r.status !== 204) {
    const msg = body?.error || ('HTTP ' + r.status);
    throw new Error(msg);
  }
  return body;
}

let _myRole = 'owner';

async function loadTeam() {
  try {
    const profile = await sbClient
      .from('profiles')
      .select('role')
      .eq('id', currentSession.user.id)
      .maybeSingle();
    _myRole = profile?.data?.role || 'owner';
  } catch (_) {}

  const listEl = document.getElementById('members-list');
  const invListEl = document.getElementById('invites-list');
  if (listEl) listEl.innerHTML = '<span style="color:var(--muted);font-size:.875rem">Loading…</span>';
  if (invListEl) invListEl.innerHTML = '<span style="color:var(--muted);font-size:.875rem">Loading…</span>';

  try {
    const data = await teamApi('/.netlify/functions/members');
    renderMembers(data.members || []);
  } catch (e) {
    if (listEl) listEl.innerHTML = '<span style="color:var(--muted);font-size:.875rem">Error loading team: ' + escHtml(e.message) + '</span>';
  }

  try {
    const inv = await teamApi('/.netlify/functions/invitations');
    renderInvites(inv.invitations || []);
  } catch (e) {
    // Non-owners get 403 — that's fine, just hide
    if (invListEl) invListEl.innerHTML = '<span style="color:var(--muted);font-size:.875rem">No pending invitations.</span>';
  }
}

function renderMembers(members) {
  const el = document.getElementById('members-list');
  if (!el) return;
  if (members.length === 0) {
    el.innerHTML = '<span style="color:var(--muted);font-size:.875rem">No teammates yet.</span>';
    return;
  }
  const canManage = _myRole === 'owner';
  el.innerHTML = members.map(m => {
    const name = escHtml(m.full_name || m.email || 'Unknown');
    const email = escHtml(m.email || '');
    const isSelf = m.is_self;
    const roleControl = canManage && !isSelf
      ? `<select onchange="changeMemberRole('${m.id}', this.value)" style="font-size:.85rem">
           ${['owner','admin','estimator','viewer'].map(r => `<option value="${r}"${r===m.role?' selected':''}>${r}</option>`).join('')}
         </select>`
      : `<span style="font-size:.85rem;color:var(--muted)">${escHtml(m.role)}</span>`;
    const removeBtn = canManage && !isSelf
      ? `<button class="btn btn-ghost" style="padding:.3rem .6rem;font-size:.85rem" onclick="removeMember('${m.id}', '${name.replace(/'/g, "\\'")}')">Remove</button>`
      : '';
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.5rem;border:1px solid var(--line, #e5e7eb);border-radius:8px">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.95rem">${name}${isSelf ? ' <span style="color:var(--muted);font-weight:400">(you)</span>' : ''}</div>
        ${email ? `<div style="font-size:.8rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis">${email}</div>` : ''}
      </div>
      ${roleControl}
      ${removeBtn}
    </div>`;
  }).join('');
}

function renderInvites(invites) {
  const el = document.getElementById('invites-list');
  if (!el) return;
  if (invites.length === 0) {
    el.innerHTML = '<span style="color:var(--muted);font-size:.875rem">No pending invitations.</span>';
    return;
  }
  el.innerHTML = invites.map(i => {
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.5rem;border:1px solid var(--line, #e5e7eb);border-radius:8px">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.9rem">${escHtml(i.email)}</div>
        <div style="font-size:.8rem;color:var(--muted)">Role: ${escHtml(i.role)} · Expires ${new Date(i.expires_at).toLocaleDateString()}</div>
      </div>
      <button class="btn btn-ghost" style="padding:.3rem .6rem;font-size:.85rem" onclick="copyInviteUrl('${i.invite_url.replace(/'/g, "\\'")}')">Copy link</button>
      <button class="btn btn-ghost" style="padding:.3rem .6rem;font-size:.85rem;color:var(--danger,#c44)" onclick="revokeInvite('${i.id}')">Revoke</button>
    </div>`;
  }).join('');
}

async function createInvite() {
  const email = document.getElementById('invite-email').value.trim();
  const role = document.getElementById('invite-role').value;
  if (!email) { toast('Email required'); return; }
  const btn = document.getElementById('btn-invite');
  btn.disabled = true;
  try {
    const r = await teamApi('/.netlify/functions/invitations', { method: 'POST', body: { email, role } });
    const url = r.invitation.invite_url;
    document.getElementById('invite-link').value = url;
    document.getElementById('invite-result').style.display = '';
    document.getElementById('invite-email').value = '';
    toast('Invite link generated');
    await loadTeam();
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
}

function copyInviteLink() {
  const inp = document.getElementById('invite-link');
  inp.select();
  document.execCommand('copy');
  toast('Link copied');
}

function copyInviteUrl(url) {
  navigator.clipboard?.writeText(url).then(() => toast('Link copied'), () => toast('Copy failed'));
}

async function revokeInvite(id) {
  if (!confirm('Revoke this invitation?')) return;
  try {
    await teamApi('/.netlify/functions/invitations?id=' + encodeURIComponent(id), { method: 'DELETE' });
    toast('Invitation revoked');
    await loadTeam();
  } catch (e) {
    toast(e.message);
  }
}

async function changeMemberRole(id, role) {
  try {
    await teamApi('/.netlify/functions/members?id=' + encodeURIComponent(id), { method: 'PATCH', body: { role } });
    toast('Role updated');
    await loadTeam();
  } catch (e) {
    toast(e.message);
    await loadTeam();
  }
}

async function removeMember(id, name) {
  if (!confirm('Remove ' + name + ' from this account?')) return;
  try {
    await teamApi('/.netlify/functions/members?id=' + encodeURIComponent(id), { method: 'DELETE' });
    toast('Removed');
    await loadTeam();
  } catch (e) {
    toast(e.message);
  }
}

// Hook into existing tab switch so loadTeam fires when tab is opened
const _origSwitchTab = window.switchTab;
window.switchTab = function (name) {
  if (typeof _origSwitchTab === 'function') _origSwitchTab(name);
  if (name === 'team' && currentSession) loadTeam();
};

// Also load team eagerly on init so badge counts are accurate
const _origInit = init;
init = async function () {
  await _origInit();
  if (currentSession) {
    try { await loadTeam(); } catch (_) {}
  }
};

"""

src = src.replace("\ninit();\n", new_js + "\ninit();\n", 1)

PATH.write_text(src, encoding="utf-8")
print(f"patched settings.html ({len(src)} bytes)")
