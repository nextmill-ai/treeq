/*
 * TQ Bottom Nav — fixed mobile-style tab bar across all app pages.
 * Include once per page:  <script src="/assets/bottom-nav.js"></script>
 * Auto-injects + highlights the active tab based on location.pathname.
 * Skips itself on /login.html and /index.html.
 */
(function () {
  if (window.__TQ_BOTTOM_NAV_INSTALLED__) return;
  window.__TQ_BOTTOM_NAV_INSTALLED__ = true;

  var path = location.pathname.toLowerCase();
  // Don't render on the auth landing pages.
  if (path === '/login.html' || path === '/index.html' || path === '/') return;

  var css = document.createElement('style');
  css.textContent = '\
    .tq-bnav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); \
      width: 100%; max-width: 480px; background: #ffffff; \
      border-top: 1px solid #d8e2d2; \
      display: grid; grid-template-columns: repeat(5, 1fr); \
      z-index: 60; padding-bottom: env(safe-area-inset-bottom, 0); \
      box-shadow: 0 -2px 12px rgba(0,0,0,0.05); \
      font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; } \
    .tq-bnav a { display: flex; flex-direction: column; align-items: center; justify-content: center; \
      padding: 8px 2px 10px; text-decoration: none; color: #7a8a7e; \
      font-size: 10px; font-weight: 600; gap: 3px; letter-spacing: .02em; \
      -webkit-tap-highlight-color: transparent; transition: color .12s; } \
    .tq-bnav a:active { background: #f4f8f1; } \
    .tq-bnav a.active { color: #2d5a3d; } \
    .tq-bnav a.center { transform: translateY(-12px); } \
    .tq-bnav a.center .tq-bnav-icon { width: 44px; height: 44px; border-radius: 50%; \
      background: #2d5a3d; color: #ffffff; display: flex; align-items: center; justify-content: center; \
      box-shadow: 0 4px 12px rgba(45,90,61,0.35); margin-bottom: 2px; } \
    .tq-bnav a.center.active .tq-bnav-icon { background: #1f4129; } \
    .tq-bnav a.center svg { width: 24px; height: 24px; } \
    .tq-bnav svg { width: 22px; height: 22px; } \
    /* === Default mode: nav at bottom, page padding reserves space for it === */ \
    body { padding-bottom: 72px !important; } \
    @supports (padding-bottom: env(safe-area-inset-bottom)) { \
      body { padding-bottom: calc(72px + env(safe-area-inset-bottom)) !important; } \
    } \
    .fab, #fab { bottom: calc(88px + env(safe-area-inset-bottom, 0px)) !important; } \
    /* === Quote Builder mode: total bar is the bottom; nav sits above it === */ \
    body.tq-has-bottom-bar .tq-bnav { bottom: 64px; padding-bottom: 0; } \
    body.tq-has-bottom-bar #bottom-bar { bottom: 0 !important; } \
    body.tq-has-bottom-bar .fab, body.tq-has-bottom-bar #fab { bottom: calc(160px + env(safe-area-inset-bottom, 0px)) !important; } \
    body.tq-has-bottom-bar { padding-bottom: calc(150px + env(safe-area-inset-bottom, 0px)) !important; } \
    /* === Standardize topbar app icon size across all pages === */ \
    .top img[src*="treeq-app-icon"], .top img[alt="TreeQ"] { width: 40px !important; height: 40px !important; border-radius: 10px !important; } \
    .brand-mark { width: 40px !important; height: 40px !important; border-radius: 10px !important; overflow: hidden; flex-shrink: 0; } \
    .brand-mark img { width: 100% !important; height: 100% !important; display: block; }';
  document.head.appendChild(css);

  function isActive() {
    for (var i = 0; i < arguments.length; i++) {
      var p = arguments[i].toLowerCase();
      if (path === p || path.indexOf(p) === 0) return ' active';
    }
    return '';
  }

  // Icons (Feather-style, inline SVG)
  var IC = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  };

  var nav = document.createElement('nav');
  nav.className = 'tq-bnav';
  nav.setAttribute('aria-label', 'Primary');
  nav.innerHTML =
    '<a href="/dashboard.html"        class="' + isActive('/dashboard.html').trim()                                + '"><span class="tq-bnav-icon">' + IC.home     + '</span><span>Home</span></a>' +
    '<a href="/customers.html"        class="' + isActive('/customers.html', '/customer-detail.html').trim()      + '"><span class="tq-bnav-icon">' + IC.users    + '</span><span>Customers</span></a>' +
    '<a href="/quote-builder.html"    class="center' + isActive('/quote-builder.html', '/spartan_pricing_tool.html')         + '"><span class="tq-bnav-icon">' + IC.plus     + '</span><span>New</span></a>' +
    '<a href="/quotes.html"           class="' + isActive('/quotes.html', '/quote-detail.html').trim()            + '"><span class="tq-bnav-icon">' + IC.file     + '</span><span>Quotes</span></a>' +
    '<a href="/settings.html"         class="' + isActive('/settings.html').trim()                                + '"><span class="tq-bnav-icon">' + IC.settings + '</span><span>Settings</span></a>';

  // Append after the page has at least a body. Detect Quote Builder mode
  // (page has a fixed #bottom-bar) and toggle the body class so the nav
  // sits above the bar instead of vice versa.
  function install() {
    if (!document.body) { setTimeout(install, 20); return; }
    document.body.appendChild(nav);
    if (document.getElementById('bottom-bar')) {
      document.body.classList.add('tq-has-bottom-bar');
    }
  }
  install();
})();
