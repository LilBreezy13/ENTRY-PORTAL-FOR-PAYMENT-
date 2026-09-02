/* ============================================================
   PAYMENT CONTROL PORTAL — FRONTEND APP
   ============================================================ */

const root = document.getElementById('root');

const State = {
  tab: 'home',
  marketers: [],
  schools: [],
  selectedMarketer: null,
  selectedSchool: null,
  entryMode: 'payment', // 'payment' | 'status'
  last20: [],
  toasts: [],
  ledgerEntries: [],     
  ledgerLoading: false,
  ledgerQuery: '',        
  ledgerMatch: null        
};

const fmt = {
  money(n) {
    const v = Number(n || 0);
    return window.PORTAL_CONFIG.CURRENCY + ' ' + v.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  date(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return String(d);
    const datePart = dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    const timePart = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `<span class="block whitespace-nowrap">${datePart}</span><span class="block whitespace-nowrap text-xs text-[var(--text-muted)]">${timePart}</span>`;
  }
};


function debounce(fn, wait) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

/* ---------------------------------------------------------------
 * Toasts
 * --------------------------------------------------------------- */
function toast(message, type = 'info') {
  const id = Date.now() + Math.random();
  State.toasts.push({ id, message, type });
  renderToasts();
  setTimeout(() => {
    State.toasts = State.toasts.filter(t => t.id !== id);
    renderToasts();
  }, 4500);
}
function renderToasts() {
  let host = document.getElementById('toastHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toastHost';
    host.className = 'fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm';
    document.body.appendChild(host);
  }
  const colors = { info: 'border-l-4', success: 'border-l-4', error: 'border-l-4' };
  host.innerHTML = State.toasts.map(t => `
    <div class="card px-4 py-3 flex items-start gap-3 ${colors[t.type]}"
         style="border-left-color:${t.type === 'error' ? 'var(--danger)' : t.type === 'success' ? 'var(--success)' : 'var(--amber-500)'}">
      <span class="text-sm">${t.type === 'success' ? '' : t.type === 'error' ? '' : 'ℹ'}</span>
      <p class="text-sm flex-1">${escapeHtml(t.message)}</p>
    </div>`).join('');
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------------------------------------------------------
 * Modal (confirmation dialogs)
 * --------------------------------------------------------------- */
function openModal(html) {
  closeModal();
  const wrap = document.createElement('div');
  wrap.id = 'modalHost';
  wrap.className = 'fixed inset-0 z-[90] modal-backdrop flex items-center justify-center p-4';
  wrap.innerHTML = `<div class="card w-full max-w-md p-6">${html}</div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeModal(); });
  document.body.appendChild(wrap);
}
function closeModal() {
  const el = document.getElementById('modalHost');
  if (el) el.remove();
}

/* ---------------------------------------------------------------
 * Shell / routing
 * --------------------------------------------------------------- */
function renderShell(loginMessage) {
  if (!Auth.isLoggedIn()) {
    renderLogin(loginMessage);
    return;
  }
  Auth.loadFromSession();
  const user = Auth.getUser();

  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'entry', label: 'Payment Entry' },
    { id: 'recent', label: 'Recent Payments' },
    { id: 'history', label: 'Payment History' },
    { id: 'declarations', label: 'Declarations' }
  ];
  if (Auth.can('manageUsers')) tabs.push({ id: 'admin', label: 'Admin' });

  root.innerHTML = `
    <div class="min-h-screen flex flex-col">
      <header class="topbar sticky top-0 z-30 shadow-md">
        <div class="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div class="flex items-center justify-between h-16 gap-4">
            <div class="flex items-center gap-3 shrink-0">
              <div class="w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold" style="background:var(--amber-500)">₵</div>
              <div class="hidden sm:block">
                <p class="font-display font-semibold leading-tight">${window.PORTAL_CONFIG.APP_NAME}</p>
                <p class="text-[11px] text-white/60 leading-tight">Best Brain Examinations Konsortium Ltd</p>
              </div>
            </div>
            <nav class="hidden md:flex items-center gap-1 overflow-x-auto">
              ${tabs.map(t => `<div class="nav-tab ${State.tab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.label}</div>`).join('')}
            </nav>
            <div class="flex items-center gap-2 shrink-0">
              <button id="themeToggle" class="btn btn-ghost !text-white !border-white/20 btn-sm" title="Toggle theme"><span id="themeIcon">🌙</span></button>
              <div class="relative">
                <button id="profileBtn" class="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-white/10 transition">
                  <span class="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm" style="background:var(--amber-500);color:#fff">${initials(user.name)}</span>
                  <span class="hidden lg:flex flex-col items-start leading-tight">
                    <span class="text-sm font-medium">${escapeHtml(user.name)}</span>
                    <span class="text-[11px] text-white/60 capitalize">${escapeHtml(user.role)}</span>
                  </span>
                </button>
                <div id="profileMenu" class="hidden absolute right-0 mt-2 w-56 card p-2 text-[var(--text)]">
                  <div class="px-3 py-2 border-b" style="border-color:var(--border)">
                    <p class="text-sm font-medium">${escapeHtml(user.name)}</p>
                    <p class="text-xs text-[var(--text-muted)]">@${escapeHtml(user.username)} · ${escapeHtml(user.role)}</p>
                  </div>
                  <button id="logoutBtn" class="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--surface-2)] text-sm mt-1 text-[var(--danger)]">Log out</button>
                </div>
              </div>
            </div>
          </div>
          <nav class="flex md:hidden items-center gap-1 pb-2 overflow-x-auto scrollbar-thin">
            ${tabs.map(t => `<div class="nav-tab shrink-0 ${State.tab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.label}</div>`).join('')}
          </nav>
        </div>
      </header>
      <main class="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6" id="tabContent"></main>
      <footer class="text-center text-xs text-[var(--text-muted)] py-4">Payment Entry Portal · data lives in your Google Sheet — this is an Entry layer on top of it. <br />Designed By Nick</footer>
    </div>
  `;

  Theme.init();
  document.getElementById('themeToggle').addEventListener('click', Theme.toggle);
  document.getElementById('profileBtn').addEventListener('click', () => {
    document.getElementById('profileMenu').classList.toggle('hidden');
  });
  document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', () => { State.tab = el.dataset.tab; renderShell(); });
  });

  routeTab();
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function routeTab() {
  const c = document.getElementById('tabContent');
  if (!c) return;
  if (State.tab === 'home') renderHome(c);
  else if (State.tab === 'entry') renderEntry(c);
  else if (State.tab === 'recent') renderRecent(c);
  else if (State.tab === 'history') renderHistory(c);
  else if (State.tab === 'declarations') renderDeclarations(c);
  else if (State.tab === 'admin' && Auth.can('manageUsers')) renderAdmin(c);
}

/* ---------------------------------------------------------------
 * LOGIN
 * --------------------------------------------------------------- */
function renderLogin(message) {
  root.innerHTML = `
    <div class="min-h-screen flex items-center justify-center px-4" style="background: radial-gradient(circle at 20% 20%, var(--teal-800), var(--teal-950));">
      <div class="w-full max-w-sm">
        <div class="flex flex-col items-center mb-6 text-white">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-xl mb-3" style="background:var(--amber-500)">₵</div>
          <h1 class="font-display text-xl font-semibold">${window.PORTAL_CONFIG.APP_NAME}</h1>
          <p class="text-sm text-white/60 mt-1">Sign in to enter or review payments</p>
        </div>
        <form id="loginForm" class="card p-6 space-y-4">
          ${message ? `<div class="badge badge-warn w-full !justify-center py-2">${escapeHtml(message)}</div>` : ''}
          <div id="loginError" class="hidden badge badge-danger w-full !justify-center py-2"></div>
          <div>
            <label class="field-label">Username</label>
            <input id="username" class="input mt-1" autocomplete="username" placeholder="e.g. Nicco" />
          </div>
          <div>
            <label class="field-label">PIN</label>
            <div class="relative mt-1">
              <input id="pin" type="password" class="input pr-16" autocomplete="current-password" placeholder="••••" />
              <button type="button" id="togglePin" class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">Show</button>
            </div>
          </div>
          <button type="submit" id="loginSubmit" class="btn btn-primary w-full">Sign In</button>
          <p class="text-xs text-center text-[var(--text-muted)]">Forgot your PIN? Ask Admin for help.</p>
        </form>
      </div>
    </div>
  `;
  Theme.init();
  document.getElementById('togglePin').addEventListener('click', () => {
    const p = document.getElementById('pin');
    p.type = p.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginSubmit');
    const err = document.getElementById('loginError');
    err.classList.add('hidden');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const res = await Auth.login(document.getElementById('username').value.trim(), document.getElementById('pin').value.trim());
      if (!res.ok) {
        err.textContent = res.error || 'Unable to sign in.';
        err.classList.remove('hidden');
        btn.disabled = false; btn.textContent = 'Sign In';
        return;
      }
      State.tab = 'home';
      renderShell();
    } catch (ex) {
      err.textContent = 'Could not reach the server. Check your connection and the API URL in config.js.';
      err.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  });
}


  // HOME / DASHBOARD
 
function refreshDashboardCache() {
  Api.getDashboardSummary().then((res) => {
    if (res && res.ok) PortalCache.write('dashboard_summary', res);
  }).catch(() => {});
}

function renderHome(container) {
 
  const cached = PortalCache.read('dashboard_summary');
  if (!cached) container.innerHTML = skeletonKPIs() + skeletonTable();

  PortalCache.fetchWithCache('dashboard_summary', () => Api.getDashboardSummary(), (res, fromCache) => {
    if (!res.ok) {
      if (!fromCache) container.innerHTML = errorState('Could not load the dashboard.', res.error);
      return;
    }
    paintHome(container, res.summary, fromCache);
  });
}

function paintHome(container, summary, fromCache) {
const kpis = [
  { label: "Today's Payments", value: fmt.money(summary.todayTotalPayments), sub: 'All collections' },
  { label: "Today's Entries", value: summary.todayEntries, sub: 'Logged today' },
  { label: 'Schools Paid Today', value: summary.schoolsPaidToday, sub: 'Unique schools' },
  { label: 'Outstanding Balance', value: fmt.money(summary.outstandingBalance), sub: 'All marketers combined' },
  { label: "Today's Declarations", value: summary.todayDeclarations, sub: 'Clearance / discount / etc.' },
  { label: 'Reversed Today', value: summary.reversedToday, sub: 'Corrections made' }
];

  container.innerHTML = `
    <div class="flex items-center justify-between mb-5 fade-in">
      <div>
        <h1 class="font-display text-xl font-semibold">Dashboard</h1>
        <p class="text-sm text-[var(--text-muted)] flex items-center gap-2 mt-0.5"><span class="pulse-dot"></span>${fromCache ? 'Showing last known entries · updating…' : 'Live from your Marketers Ledger'}</p>
      </div>
             <div class="flex items-center gap-2">
        <button id="viewLedgerToday" class="btn btn-sm" style="background:var(--success); color:#fff; border-color:var(--success);">Today's Ledger</button>
        <button id="refreshHome" class="btn btn-ghost btn-sm">↻ Refresh</button>
      </div>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
    ${kpis.map(k => `
  <div class="card kpi-card p-4">
    <p class="kpi-label">${k.label}</p>
    <p class="kpi-value font-display tabular-nums">${k.value}</p>
    <p class="kpi-sub">${k.sub}</p>
  </div>`).join('')}
    </div>

       <div class="card p-5 mb-6 fade-in">
      <h2 class="font-display font-semibold mb-4">Marketers overview</h2>
      <div class="table-wrap">
        <table class="data">
          <thead>
            ${(() => {
              const totals = summary.marketers.reduce((acc, m) => ({
                schools: acc.schools + (Number(m.schools) || 0),
                enrolment: acc.enrolment + (Number(m.enrolment) || 0),
                bill: acc.bill + (Number(m.bill) || 0),
                collected: acc.collected + (Number(m.collected) || 0),
                balance: acc.balance + (Number(m.balance) || 0)
              }), { schools: 0, enrolment: 0, bill: 0, collected: 0, balance: 0 });
              return `
              <tr style="color:var(--success); font-weight:700;">
                <td>TOTAL</td>
                <td class="tabular-nums">${totals.schools}</td>
                <td class="tabular-nums">${totals.enrolment}</td>
                <td class="tabular-nums">${fmt.money(totals.bill)}</td>
                <td class="tabular-nums">${fmt.money(totals.collected)}</td>
                <td class="tabular-nums">${fmt.money(totals.balance)}</td>
              </tr>`;
            })()}
            <tr><th>Marketer</th><th>Schools</th><th>Enrolment</th><th>Bill</th><th>Collected</th><th>Balance</th></tr>
          </thead>
          <tbody>
            ${summary.marketers.map(m => `
              <tr>
                <td class="font-medium">${escapeHtml(m.name)}</td>
                <td>${m.schools}</td>
                <td>${m.enrolment}</td>
                <td class="tabular-nums">${fmt.money(m.bill)}</td>
                <td class="tabular-nums">${fmt.money(m.collected)}</td>
                <td class="tabular-nums ${m.balance > 0 ? 'text-[var(--warn)]' : ''}">${fmt.money(m.balance)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.getElementById('refreshHome').addEventListener('click', () => renderHome(container));
  document.getElementById('viewLedgerToday').addEventListener('click', openLedgerTodayModal);
}


const LedgerTodayState = { seenKeys: new Set(), initialized: false, open: false };

function openLedgerTodayModal() {
  LedgerTodayState.open = true;
  PortalCache.fetchWithCache('ledger_today', () => Api.getLedgerToday(), (res, fromCache) => {
    if (!LedgerTodayState.open) return; // modal was closed / user navigated away before this resolved
    if (!res.ok) {
      if (!fromCache) toast('Could not load today\'s ledger.', 'error');
      return;
    }
    renderLedgerTodayModal(res, fromCache);
  });
}

function closeLedgerTodayModal() {
  LedgerTodayState.open = false;
  closeModal();
}
function renderLedgerTodayModal(res, fromCache) {
  if (!LedgerTodayState.open) return;
  const firstEverLoad = !LedgerTodayState.initialized;
  const newKeys = [];
  res.entries.forEach(e => {
    const key = e.marketer + '#' + e.rowRef;
    e._isNew = !firstEverLoad && !LedgerTodayState.seenKeys.has(key);
    if (e._isNew) newKeys.push(key);
  });
  res.entries.forEach(e => LedgerTodayState.seenKeys.add(e.marketer + '#' + e.rowRef));
  LedgerTodayState.initialized = true;

  const wrap = document.getElementById('modalHost') || document.createElement('div');
  wrap.id = 'modalHost';
  wrap.className = 'fixed inset-0 z-[90] modal-backdrop flex items-center justify-center p-4';
  wrap.innerHTML = `
    <div class="card w-[95vw] max-w-6xl p-6 max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between mb-1">
        <h2 class="font-display font-semibold">Today's Ledger</h2>
        <button id="closeLedgerToday" class="btn btn-ghost btn-sm">✕</button>
      </div>
      <p class="text-xs text-[var(--text-muted)] mb-4">
        ${fromCache ? 'Showing last known entries · updating…' : 'Live'} ·
        <span style="color:var(--success)" class="font-semibold">${res.entered} entered</span> ·
        <span style="color:var(--warn)" class="font-semibold">${res.pending} not yet entered</span> ·
        ${res.total} total today
        ${newKeys.length > 0 ? `· <span class="font-semibold pulse-badge" style="color:var(--success)">${newKeys.length} new</span>` : ''}
      </p>
      <div class="table-wrap overflow-auto flex-1">
        <table class="data">
          <thead><tr><th>Date</th><th>Marketer</th><th>School</th><th>Sender</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            ${res.entries.length === 0 ? `<tr><td colspan="6" class="text-sm text-[var(--text-muted)] py-4">Nothing yet.</td></tr>` : ''}
            ${res.entries.map(e => `
              <tr class="${e._isNew ? 'row-flash-green' : ''}" style="${!e._isNew && e.entered ? 'background:color-mix(in srgb, var(--success) 12%, transparent);' : ''}">
                <td class="text-xs">${e.dateLabel || ''}${e.loggedTimeLabel ? `<br><span class="text-[var(--text-muted)]">${e.loggedTimeLabel}</span>` : ''}</td>
                <td class="font-medium">${escapeHtml(e.marketer)}</td>
                <td>${escapeHtml(e.schoolNameOnly || e.school)}</td>
                <td>${escapeHtml(e.sender)}</td>
                <td class="tabular-nums">${fmt.money(e.amount)}</td>
                <td>${e.entered
                  ? `<span class="font-semibold" style="color:var(--success)">✓ Entered</span>`
                  : `<span class="font-semibold" style="color:var(--warn)">Pending</span>`}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeLedgerTodayModal(); });
  if (!wrap.isConnected) document.body.appendChild(wrap);
  document.getElementById('closeLedgerToday').addEventListener('click', closeLedgerTodayModal);
}

function skeletonKPIs() {
  return `<div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
    ${Array.from({ length: 6 }).map(() => `<div class="card p-4"><div class="skeleton h-8 w-8 rounded-lg mb-3"></div><div class="skeleton h-5 w-3/4 mb-2"></div><div class="skeleton h-3 w-1/2"></div></div>`).join('')}
  </div>`;
}
function skeletonTable(rows = 5) {
  return `<div class="card p-5"><div class="skeleton h-5 w-40 mb-4"></div>${Array.from({ length: rows }).map(() => `<div class="skeleton h-9 w-full mb-2"></div>`).join('')}</div>`;
}
function errorState(title, detail) {
  return `<div class="card p-8 text-center">
    <p class="text-3xl mb-2">⚠️</p>
    <p class="font-display font-semibold">${escapeHtml(title)}</p>
    <p class="text-sm text-[var(--text-muted)] mt-1">${escapeHtml(detail || '')}</p>
  </div>`;
}
function emptyState(title, subtitle) {
  return `<div class="text-center py-14">
    <p class="text-3xl mb-2"></p>
    <p class="font-display font-semibold">${escapeHtml(title)}</p>
    <p class="text-sm text-[var(--text-muted)] mt-1">${escapeHtml(subtitle || '')}</p>
  </div>`;
}


//  PAYMENT ENTRY
 
function renderEntry(container) {
  container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 fade-in">
      <div class="lg:col-span-2 space-y-5" id="entryLeft"></div>
      <div class="space-y-5" id="entryRight"></div>
    </div>
  `;
  document.getElementById('entryRight').innerHTML = skeletonTable(6);
  renderEntryLeft();
  renderLedgerPanel();

  
  PortalCache.fetchWithCache('marketers', () => Api.getMarketers(), (res) => {
    if (!res.ok) return;
    State.marketers = res.marketers;
    
    if (State.tab === 'entry') renderEntryLeft();
  });
}

function renderEntryLeft() {
  const el = document.getElementById('entryLeft');
  if (!el) return;
  el.innerHTML = `
    <div class="card p-5">
      <h1 class="font-display text-lg font-semibold mb-1">Payment Entry</h1>
      <p class="text-sm text-[var(--text-muted)] mb-4">Select a marketer and a school to begin.</p>

      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="field-label">Marketer / Rep</label>
          <div id="marketerCombo" class="mt-1"></div>
        </div>
        <div>
          <label class="field-label">School</label>
          <div id="schoolCombo" class="mt-1"></div>
        </div>
      </div>
    </div>
    <div id="paymentFormHost"></div>
  `;
  buildCombobox('marketerCombo', {
    placeholder: State.marketers.length ? 'Search marketers…' : 'Loading marketers…',
    disabled: State.marketers.length === 0,
    items: State.marketers.map(m => ({ id: m.name, label: m.name, sub: `${m.schools} schools · Bal ${fmt.money(m.balance)}` })),
    selected: State.selectedMarketer,
    onSelect: (item) => {
      State.selectedMarketer = item.id;
      State.selectedSchool = null;
      State.ledgerMatch = null;
      State.ledgerQuery = '';

     
      const cacheKey = 'schools:' + item.id;
      const cached = PortalCache.read(cacheKey);
      State.schools = cached ? cached.schools : [];
      renderEntryLeft();
      renderPaymentFormHost();

      if (!cached) {
        const schoolHost = document.getElementById('schoolCombo');
        if (schoolHost) schoolHost.innerHTML = `<div class="skeleton h-10 w-full"></div>`;
      }

      PortalCache.fetchWithCache(cacheKey, () => Api.getSchools(item.id), (res) => {
        if (!res.ok) { toast('Could not load schools for this marketer.', 'error'); return; }
        // Only apply if the user hasn't since switched to a different marketer.
        if (State.selectedMarketer === item.id) {
          State.schools = res.schools;
          renderEntryLeft();
        }
      });

      loadMarketerLedger(item.id);
    }
  });
  buildCombobox('schoolCombo', {
    placeholder: !State.selectedMarketer ? 'Select a marketer first' : 'Search by ID, name or location…',
    disabled: !State.selectedMarketer,
    items: State.schools.map(s => ({ id: s.schoolId, label: s.name, sub: `${s.schoolId} · ${s.location} · Bal ${fmt.money(s.balance)}`, raw: s })),
    selected: State.selectedSchool,
    onSelect: (item) => {
      State.selectedSchool = item.raw;
      State.ledgerMatch = matchLedgerEntry(State.ledgerEntries, item.raw);
      renderPaymentFormHost();
      renderLedgerPanel();
    }
  });
  renderPaymentFormHost();
}

function renderPaymentFormHost() {
  const host = document.getElementById('paymentFormHost');
  if (!host) return;
  if (!State.selectedSchool) {
    host.innerHTML = `<div class="card p-8 text-center mt-5">
      <p class="text-3xl mb-2"></p>
      <p class="font-display font-semibold">Select a marketer and school to begin payment entry.</p>
      <p class="text-sm text-[var(--text-muted)] mt-1">The payment form appears once a school is chosen.</p>
    </div>`;
    return;
  }
  const s = State.selectedSchool;
  host.innerHTML = `
    <div class="card p-5 mt-5">
      <div class="flex flex-wrap items-start justify-between gap-3 mb-4 pb-4 border-b" style="border-color:var(--border)">
        <div>
          <p class="font-display font-semibold">${escapeHtml(s.name)}</p>
          <p class="text-xs text-[var(--text-muted)]">${escapeHtml(s.schoolId)} · ${escapeHtml(s.location)} · ${escapeHtml(State.selectedMarketer)}</p>
        </div>
        <div class="flex gap-4 text-right">
          <div><p class="text-xs text-[var(--text-muted)]">Bill</p><p class="font-semibold tabular-nums">${fmt.money(s.bill)}</p></div>
          <div><p class="text-xs text-[var(--text-muted)]">Collected</p><p class="font-semibold tabular-nums">${fmt.money(s.collected)}</p></div>
          <div><p class="text-xs text-[var(--text-muted)]">Balance</p><p class="font-semibold tabular-nums" style="color:var(--warn)">${fmt.money(s.balance)}</p></div>
        </div>
      </div>

      <div class="flex gap-2 mb-4">
        <button data-mode="payment" class="btn ${State.entryMode === 'payment' ? 'btn-primary' : 'btn-ghost'} btn-sm">Add Payment</button>
        <button data-mode="status" class="btn ${State.entryMode === 'status' ? 'btn-primary' : 'btn-ghost'} btn-sm">Status / Declaration</button>
      </div>

      ${State.entryMode === 'payment' ? paymentModeHtml() : statusModeHtml()}
    </div>
  `;
  host.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { State.entryMode = b.dataset.mode; renderPaymentFormHost(); }));

  if (State.entryMode === 'payment') wirePaymentMode();
  else wireStatusMode();
}

function paymentModeHtml() {
  return `
    <form id="paymentForm" class="space-y-3">
      <div>
        <label class="field-label">Amount (${window.PORTAL_CONFIG.CURRENCY})</label>
        <input id="paymentAmount" type="number" min="0.01" step="0.01" class="input mt-1 text-lg font-semibold" placeholder="0.00" />
      </div>
      <button type="submit" class="btn btn-primary w-full" ${Auth.can('enterPayment') ? '' : 'disabled'}>Add Payment</button>
      ${Auth.can('enterPayment') ? '' : '<p class="text-xs text-center text-[var(--danger)]">Your role cannot enter payments.</p>'}
    </form>
  `;
}

function statusModeHtml() {
  return `
    <form id="statusForm" class="space-y-3">
      <div>
        <label class="field-label">Status / Declaration</label>
        <select id="statusType" class="input mt-1">
          <option value="">Select…</option>
          <option>Clearance</option>
          <option>Discount</option>
          <option>Bad debt</option>
          <option>Rejected</option>
        </select>
      </div>
      <div>
        <label class="field-label">Amount / value (${window.PORTAL_CONFIG.CURRENCY})</label>
        <input id="statusAmount" type="number" min="0" step="0.01" class="input mt-1" placeholder="0.00" />
      </div>
      <div>
        <label class="field-label">Reason / note</label>
        <textarea id="statusReason" rows="2" class="input mt-1" placeholder="Why is this being declared?"></textarea>
      </div>
      <button type="submit" class="btn btn-primary w-full" ${Auth.can('enterPayment') ? '' : 'disabled'}>Submit Declaration</button>
    </form>
  `;
}

function wirePaymentMode() {
  const form = document.getElementById('paymentForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amountInput = document.getElementById('paymentAmount');
    const amount = Number(amountInput.value);
    if (!amount || amount <= 0) { toast('Enter a valid amount greater than zero.', 'error'); return; }
    confirmPayment(amount);
  });
}

function confirmPayment(amount) {
  const s = State.selectedSchool;
  openModal(`
    <h3 class="font-display font-semibold text-lg mb-4">Confirm Payment</h3>
    <div class="space-y-2 text-sm mb-5">
      <div class="flex justify-between"><span class="text-[var(--text-muted)]">School</span><span class="font-medium">${escapeHtml(s.name)}</span></div>
      <div class="flex justify-between"><span class="text-[var(--text-muted)]">Marketer</span><span class="font-medium">${escapeHtml(State.selectedMarketer)}</span></div>
      <div class="flex justify-between"><span class="text-[var(--text-muted)]">Amount</span><span class="font-semibold tabular-nums">${fmt.money(amount)}</span></div>
      <div class="flex justify-between"><span class="text-[var(--text-muted)]">Expected new balance</span><span class="font-semibold tabular-nums">${fmt.money(Math.max(0, s.balance - amount))}</span></div>
    </div>
    <div class="flex gap-2">
      <button id="cancelPay" class="btn btn-ghost flex-1">Cancel</button>
      <button id="confirmPay" class="btn btn-primary flex-1">Confirm Payment</button>
    </div>
  `);
  document.getElementById('cancelPay').addEventListener('click', closeModal);
  document.getElementById('confirmPay').addEventListener('click', async () => {
    const btn = document.getElementById('confirmPay');
    btn.disabled = true; btn.textContent = 'Submitting…';
    try {
      const res = await Api.addPayment({
        marketer: State.selectedMarketer,
        schoolId: s.schoolId,
        amount,
        idempotencyKey: 'pay_' + s.schoolId + '_' + Date.now(),
        ledgerRowRef: State.ledgerMatch ? State.ledgerMatch.rowRef : undefined
      });
      if (!res.ok) { toast(res.error || 'Payment failed.', 'error'); btn.disabled = false; btn.textContent = 'Confirm Payment'; return; }
      closeModal();
      toast(`Payment recorded · ${res.transaction.transactionId} · Google Sheet synchronized.`, 'success');
      s.collected = res.transaction.newCollected;
      s.balance = res.transaction.newBalance;
      State.last20.unshift({ schoolName: s.name, schoolId: s.schoolId, marketer: State.selectedMarketer, amount, time: new Date(), status: 'Payment' });
      State.last20 = State.last20.slice(0, 20);

      
         if (res.transaction.ledgerRowRef) {
        State.ledgerEntries = State.ledgerEntries.filter(e => e.rowRef !== res.transaction.ledgerRowRef);
        PortalCache.write('ledger:' + State.selectedMarketer, { ok: true, entries: State.ledgerEntries });
      }
      State.ledgerMatch = null;

      renderPaymentFormHost();
      renderLedgerPanel();
      refreshDashboardCache();
    } catch (ex) {
      toast('Network error while submitting payment.', 'error');
      btn.disabled = false; btn.textContent = 'Confirm Payment';
    }
  });
}

function wireStatusMode() {
  const form = document.getElementById('statusForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('statusType').value;
    const amount = Number(document.getElementById('statusAmount').value || 0);
    const reason = document.getElementById('statusReason').value.trim();
    if (!status) { toast('Choose a status type.', 'error'); return; }
    confirmDeclaration(status, amount, reason);
  });
}

function confirmDeclaration(status, amount, reason) {
  const s = State.selectedSchool;
  openModal(`
    <h3 class="font-display font-semibold text-lg mb-4">Confirm ${escapeHtml(status)}</h3>
    <div class="space-y-2 text-sm mb-5">
      <div class="flex justify-between"><span class="text-[var(--text-muted)]">School</span><span class="font-medium">${escapeHtml(s.name)}</span></div>
      <div class="flex justify-between"><span class="text-[var(--text-muted)]">Marketer</span><span class="font-medium">${escapeHtml(State.selectedMarketer)}</span></div>
      <div class="flex justify-between"><span class="text-[var(--text-muted)]">Amount / value</span><span class="font-semibold tabular-nums">${fmt.money(amount)}</span></div>
      ${reason ? `<div class="flex justify-between gap-4"><span class="text-[var(--text-muted)] shrink-0">Reason</span><span class="text-right">${escapeHtml(reason)}</span></div>` : ''}
    </div>
    <div class="flex gap-2">
      <button id="cancelDec" class="btn btn-ghost flex-1">Cancel</button>
      <button id="confirmDec" class="btn btn-primary flex-1">Submit</button>
    </div>
  `);
  document.getElementById('cancelDec').addEventListener('click', closeModal);
  document.getElementById('confirmDec').addEventListener('click', async () => {
    const btn = document.getElementById('confirmDec');
    btn.disabled = true; btn.textContent = 'Submitting…';
    try {
      const res = await Api.addDeclaration({ marketer: State.selectedMarketer, schoolId: s.schoolId, status, amount, reason });
      if (!res.ok) { toast(res.error || 'Submission failed.', 'error'); btn.disabled = false; btn.textContent = 'Submit'; return; }
      closeModal();
      toast(`${status} recorded · ${res.declaration.declarationId}`, 'success');
      s.bill = res.declaration.newBill;
      s.balance = res.declaration.newBalance;
      State.last20.unshift({ schoolName: s.name, schoolId: s.schoolId, marketer: State.selectedMarketer, amount, time: new Date(), status });
      State.last20 = State.last20.slice(0, 20);
      renderPaymentFormHost();
      refreshDashboardCache();
    } catch (ex) {
      toast('Network error while submitting declaration.', 'error');
      btn.disabled = false; btn.textContent = 'Submit';
    }
  });
}


//  MARKETER'S LEDGER PANEL (Payment Entry, right column)
  
function matchLedgerEntry(entries, school) {
  if (!school || !entries || !entries.length) return null;
  const wantId = String(school.schoolId || '').trim();
  if (wantId) {
    const byId = entries.find(e => e.schoolId && e.schoolId === wantId);
    if (byId) return byId;
  }
  const wantName = String(school.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (wantName) {
    const byName = entries.find(e => (e.schoolNameOnly || '').trim().toLowerCase().replace(/\s+/g, ' ') === wantName);
    if (byName) return byName;
  }
  return null;
}
async function loadMarketerLedger(marketer) {

  const cacheKey = 'ledger:' + marketer;
  const cached = PortalCache.read(cacheKey);
  State.ledgerEntries = cached ? cached.entries : [];
  State.ledgerLoading = !cached;
  State.ledgerMatch = State.selectedSchool ? matchLedgerEntry(State.ledgerEntries, State.selectedSchool) : null;
  renderLedgerPanel();

  PortalCache.fetchWithCache(cacheKey, () => Api.getLedgerForMarketer(marketer), (res) => {
    if (State.selectedMarketer !== marketer) return; // switched marketer while this was in flight
    State.ledgerLoading = false;
    if (!res.ok) { if (!cached) { toast('Could not load ' + marketer + '\'s ledger.', 'error'); } return; }
    State.ledgerEntries = res.entries;
    State.ledgerMatch = State.selectedSchool ? matchLedgerEntry(State.ledgerEntries, State.selectedSchool) : null;
    renderLedgerPanel();
  });
}
function renderLedgerPanel() {
  const el = document.getElementById('entryRight');
  if (!el) return;

  if (!State.selectedMarketer) {
    el.innerHTML = `<div class="card p-5">
      <h2 class="font-display font-semibold mb-2">Marketer's Ledger</h2>
      <p class="text-sm text-[var(--text-muted)]">Select a marketer to see what they've logged as collected but not yet entered.</p>
    </div>`;
    return;
  }

  if (State.ledgerLoading) { el.innerHTML = skeletonTable(6); return; }

  const q = (State.ledgerQuery || '').toLowerCase();
  let rows = !q ? State.ledgerEntries.slice() : State.ledgerEntries.filter(e =>
    (e.school + ' ' + e.sender).toLowerCase().indexOf(q) !== -1);

  
  if (State.ledgerMatch) {
    rows = rows.filter(e => e.rowRef !== State.ledgerMatch.rowRef);
    rows.unshift(State.ledgerMatch);
  }

  el.innerHTML = `
    <div class="card p-5">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-display font-semibold">${escapeHtml(State.selectedMarketer)}'s Ledger</h2>
        <span class="badge">${State.ledgerEntries.length} pending</span>
      </div>
      <input id="ledgerSearch" class="input mb-3" placeholder="Search school or sender…" value="${escapeHtml(State.ledgerQuery)}" />
      ${rows.length === 0 ? emptyState(
        State.ledgerEntries.length === 0 ? 'Nothing pending' : 'No matches',
        State.ledgerEntries.length === 0 ? 'Every logged entry for this marketer has been entered or no entry at all yet.' : 'Try a different search.'
      ) : `
      <div class="space-y-2 max-h-[560px] overflow-y-auto scrollbar-thin pr-1">
        ${rows.map(e => {
          const isMatch = State.ledgerMatch && e.rowRef === State.ledgerMatch.rowRef;
          return `
          <div class="surface-2 rounded-xl p-3${isMatch ? ' ledger-match' : ''}" data-ledger-row="${e.rowRef}">
            <div class="flex items-center justify-between gap-2">
              <p class="font-medium text-sm truncate">${escapeHtml(e.schoolNameOnly || e.school)}</p>
              ${isMatch ? '<span class="badge badge-success">Matches selected school</span>' : (e.status ? `<span class="badge badge-warn">${escapeHtml(e.status)}</span>` : '')}
            </div>
            <p class="text-xs text-[var(--text-muted)] mt-0.5">${escapeHtml(e.sender || '—')}${e.schoolId ? ' · ' + escapeHtml(e.schoolId) : ''}</p>
                     <div class="flex items-center justify-between mt-1.5">
              <div>
                <span class="text-xs text-[var(--text-muted)]">${fmt.date(e.loggedAt || e.date)}</span>
                ${e.loggedAt ? '<span class="text-[10px] text-[var(--text-muted)]">logged in ledger</span>' : ''}
              </div>
              <span class="font-semibold text-sm tabular-nums">${fmt.money(e.amount)}</span>
            </div>
          </div>`;
        }).join('')}
      </div>`}
    </div>
  `;
   const search = document.getElementById('ledgerSearch');
  if (search) {
    search.addEventListener('input', () => {
      State.ledgerQuery = search.value;
      const caret = search.selectionStart; 
      renderLedgerPanel();
      const fresh = document.getElementById('ledgerSearch');
      if (fresh) {
        fresh.focus();
        fresh.setSelectionRange(caret, caret); 
      }
    });
  }
}

/* ---------------------------------------------------------------
 * RECENT PAYMENTS (standalone tab) — last 20 payments + declarations,
 * filterable by marketer.
 * --------------------------------------------------------------- */
const RecentState = { marketer: '', entries: [] };

async function renderRecent(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h1 class="font-display text-lg font-semibold">Recent Payments</h1>
    </div>
    <div class="card p-4 mb-5 flex flex-wrap gap-3 items-end">
      <div>
        <label class="field-label">Marketer</label>
        <select id="rMarketer" class="input mt-1 w-48"><option value="">All marketers</option></select>
      </div>
    </div>
    <div id="recentHost">${skeletonTable(6)}</div>
  `;
  if (State.marketers.length === 0) {
    try { const r = await Api.getMarketers(); if (r.ok) State.marketers = r.marketers; } catch (e) {}
  }
  const msel = document.getElementById('rMarketer');
  msel.innerHTML += State.marketers.map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('');
  msel.value = RecentState.marketer;
  msel.addEventListener('change', () => { RecentState.marketer = msel.value; loadRecent(); });
  loadRecent();
}

async function loadRecent() {
  const host = document.getElementById('recentHost');
  if (!host) return;
  const marketer = RecentState.marketer;
  const cacheKey = 'recent:' + marketer;

  
  const cached = PortalCache.read(cacheKey);
  if (cached) {
    RecentState.entries = cached.entries;
    renderRecentList();
  } else {
    host.innerHTML = skeletonTable(6);
  }

  PortalCache.fetchWithCache(cacheKey, async () => {
    const [payRes, declRes] = await Promise.all([
      Api.getPaymentHistory({ dateRange: 'all', marketer, search: '', page: 1, pageSize: 20 }),
      Api.getDeclarations({ status: '', marketer, search: '', page: 1, pageSize: 20 })
    ]);
     const entries = [];
    if (payRes.ok) {
      payRes.result.rows.forEach(r => entries.push({
        schoolName: r.schoolName, schoolId: r.schoolId, marketer: r.marketer,
        amount: r.amountAdded, time: r.date, status: 'Payment', reversed: r.reversed, rowIndex: r.rowIndex
      }));
    }
    if (declRes.ok) {
      declRes.result.rows.forEach(r => entries.push({
        schoolName: r.schoolName, schoolId: r.schoolId, marketer: r.marketer,
        amount: r.amount, time: r.date, status: r.status, reversed: r.reversed, rowIndex: r.rowIndex
      }));
    }
    entries.sort((a, b) => {
      const d = new Date(b.time) - new Date(a.time);
      return d !== 0 ? d : (b.rowIndex || 0) - (a.rowIndex || 0);
    });
    return { ok: true, entries: entries.slice(0, 20) };
  }, (res) => {
    if (RecentState.marketer !== marketer) return; 
    RecentState.entries = res.entries;
    if (document.getElementById('recentHost')) renderRecentList();
  });
}


function renderRecentList() {
  const host = document.getElementById('recentHost');
  if (!host) return;
  if (RecentState.entries.length === 0) { host.innerHTML = emptyState('Nothing entered yet', 'Payments and declarations submitted will appear here.'); return; }
  host.innerHTML = `
    <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
      ${RecentState.entries.map(e => `
        <div class="card p-3">
          <div class="flex items-center justify-between gap-2">
            <p class="font-medium text-sm truncate">${escapeHtml(e.schoolName)}</p>
            <span class="badge ${e.reversed ? 'badge-danger' : (e.status === 'Payment' ? 'badge-success' : 'badge-warn')}">${e.reversed ? 'Reversed' : escapeHtml(e.status)}</span>
          </div>
          <p class="text-xs text-[var(--text-muted)] mt-0.5">${escapeHtml(e.schoolId)} · ${escapeHtml(e.marketer)}</p>
          <div class="flex items-center justify-between mt-1.5">
            <span class="text-xs text-[var(--text-muted)]">${fmt.date(e.time)}</span>
            <span class="font-semibold text-sm tabular-nums">${fmt.money(e.amount)}</span>
          </div>
        </div>`).join('')}
    </div>
  `;
}

/* ---------------------------------------------------------------
 * Reusable searchable combobox
 * --------------------------------------------------------------- */
function buildCombobox(hostId, { items, placeholder, onSelect, selected, disabled }) {
  const host = document.getElementById(hostId);
  if (!host) return;
  const selectedLabel = selected ? (selected.name || selected.schoolId ? `${selected.label || ''}` : '') : '';
  host.innerHTML = `
    <div class="combobox">
      <input class="input" ${disabled ? 'disabled' : ''} placeholder="${escapeHtml(placeholder)}"
        value="${selected ? escapeHtml(typeof selected === 'string' ? selected : (selected.name || '')) : ''}" autocomplete="off" />
      <div class="combobox-panel hidden"></div>
    </div>
  `;
  const input = host.querySelector('input');
  const panel = host.querySelector('.combobox-panel');

  function renderOptions(filter) {
    const f = (filter || '').toLowerCase();
    const filtered = !f ? items : items.filter(i => (i.label + ' ' + (i.sub || '')).toLowerCase().includes(f));
    if (filtered.length === 0) {
      panel.innerHTML = `<div class="combobox-option text-[var(--text-muted)] text-sm">No matches found.</div>`;
    } else {
      panel.innerHTML = filtered.slice(0, 60).map((i, idx) => `
        <div class="combobox-option" data-idx="${idx}">
          <p class="text-sm font-medium">${escapeHtml(i.label)}</p>
          ${i.sub ? `<p class="id">${escapeHtml(i.sub)}</p>` : ''}
        </div>`).join('');
      panel.querySelectorAll('.combobox-option').forEach((opt, idx) => {
        opt.addEventListener('click', () => {
          input.value = filtered[idx].label;
          panel.classList.add('hidden');
          onSelect(filtered[idx]);
        });
      });
    }
    panel.classList.remove('hidden');
  }

  input.addEventListener('focus', () => { if (!disabled) renderOptions(input.value); });
  input.addEventListener('input', () => renderOptions(input.value));
  input.addEventListener('blur', () => setTimeout(() => panel.classList.add('hidden'), 150));
}

/* ---------------------------------------------------------------
 * PAYMENT HISTORY
 * --------------------------------------------------------------- */
const HistoryState = { page: 1, filters: { dateRange: 'today', marketer: '', search: '', reversed: '' }, allRows: [], baseTotal: 0 };

async function renderHistory(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h1 class="font-display text-lg font-semibold">Payment History</h1>
    </div>
    <div class="card p-4 mb-5 flex flex-wrap gap-3 items-end">
      <div>
        <label class="field-label">Date range</label>
        <select id="hDateRange" class="input mt-1 w-40">
          <option value="all">All time</option>
          <option value="today" selected>Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last7">Last 7 days</option>
          <option value="last30">Last 30 days</option>
        </select>
      </div>
      <div>
        <label class="field-label">Marketer</label>
        <select id="hMarketer" class="input mt-1 w-44"><option value="">All marketers</option></select>
      </div>
      <div>
        <label class="field-label">Reversed</label>
        <select id="hReversed" class="input mt-1 w-36">
          <option value="">All</option>
          <option value="yes">Reversed only</option>
          <option value="no">Not reversed</option>
        </select>
      </div>
      <div class="flex-1 min-w-[180px]">
        <label class="field-label">Search</label>
        <input id="hSearch" class="input mt-1" placeholder="School ID or name…" />
      </div>
    </div>
    <div id="historyTableHost" class="card p-0 overflow-hidden">${skeletonTable(8)}</div>
  `;
  if (State.marketers.length === 0) {
    try { const r = await Api.getMarketers(); if (r.ok) State.marketers = r.marketers; } catch (e) {}
  }
  const msel = document.getElementById('hMarketer');
  msel.innerHTML += State.marketers.map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('');
  msel.value = HistoryState.filters.marketer;
  document.getElementById('hDateRange').value = HistoryState.filters.dateRange;
  document.getElementById('hReversed').value = HistoryState.filters.reversed;
  document.getElementById('hSearch').value = HistoryState.filters.search;

  // Date range / marketer / reversed change which rows come back from the
  // server, so those still trigger a real (cached-when-possible) fetch.
  function applyHistoryBaseFilters() {
    HistoryState.filters.dateRange = document.getElementById('hDateRange').value;
    HistoryState.filters.marketer = document.getElementById('hMarketer').value;
    HistoryState.filters.reversed = document.getElementById('hReversed').value;
    HistoryState.page = 1;
    loadHistoryBase();
  }
  document.getElementById('hDateRange').addEventListener('change', applyHistoryBaseFilters);
  document.getElementById('hMarketer').addEventListener('change', applyHistoryBaseFilters);
  document.getElementById('hReversed').addEventListener('change', applyHistoryBaseFilters);

  
  document.getElementById('hSearch').addEventListener('input', () => {
    HistoryState.filters.search = document.getElementById('hSearch').value.trim();
    HistoryState.page = 1;
    renderHistoryFromMemory();
  });

  loadHistoryBase();
}

function loadHistoryBase() {
  const host = document.getElementById('historyTableHost');
  const baseFilters = { dateRange: HistoryState.filters.dateRange, marketer: HistoryState.filters.marketer, reversed: HistoryState.filters.reversed };
  const cacheKey = 'payhistbase:' + JSON.stringify(baseFilters);
  const cached = PortalCache.read(cacheKey);
  if (cached) {
    
  } else if (!host.querySelector('table')) {
    host.innerHTML = skeletonTable(8);
  } else {
    host.classList.add('opacity-50', 'pointer-events-none');
  }

  PortalCache.fetchWithCache(cacheKey, () => Api.getPaymentHistory({ ...baseFilters, search: '', page: 1, pageSize: 200 }), (res, fromCache) => {
    const stillCurrent = document.getElementById('historyTableHost') && cacheKey === 'payhistbase:' + JSON.stringify({ dateRange: HistoryState.filters.dateRange, marketer: HistoryState.filters.marketer, reversed: HistoryState.filters.reversed });
    if (!stillCurrent) return;
    if (!res.ok) {
      if (!fromCache) { host.classList.remove('opacity-50', 'pointer-events-none'); host.innerHTML = errorState('Could not load payment history.', res.error); }
      return;
    }
    HistoryState.allRows = res.result.rows;
    HistoryState.baseTotal = res.result.total;
    renderHistoryFromMemory();
  });
}

function renderHistoryFromMemory() {
  const host = document.getElementById('historyTableHost');
  const q = HistoryState.filters.search.toLowerCase();
  const filtered = !q ? HistoryState.allRows : HistoryState.allRows.filter(r =>
    (String(r.schoolId) + ' ' + String(r.schoolName)).toLowerCase().indexOf(q) !== -1);
  const pageSize = 20;
  const start = (HistoryState.page - 1) * pageSize;
  paintHistoryTable(host, {
    rows: filtered.slice(start, start + pageSize),
    total: filtered.length,
    capped: HistoryState.baseTotal > HistoryState.allRows.length
  });
}

function paintHistoryTable(host, result) {
  host.classList.remove('opacity-50', 'pointer-events-none');
  if (result.rows.length === 0) { host.innerHTML = emptyState('No payments found', 'Try changing your filters.'); return; }

  host.innerHTML = `
    <div class="table-wrap">
      <table class="data">
        <thead><tr>
          <th>Date</th><th>School</th><th>Marketer</th><th>Amount</th><th>Collected</th><th>Balance</th><th>Agent</th><th>Txn ID</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${result.rows.map(r => `
            <tr>
                          <td>${fmt.date(r.date)}</td>
              <td><p class="font-medium">${escapeHtml(r.schoolName)}</p><p class="text-xs text-[var(--text-muted)]">${escapeHtml(r.schoolId)}</p></td>
              <td>${escapeHtml(r.marketer)}</td>
              <td class="tabular-nums font-medium">${fmt.money(r.amountAdded)}</td>
              <td class="tabular-nums">${fmt.money(r.collected)}</td>
              <td class="tabular-nums">${fmt.money(r.balance)}</td>
                            <td class="text-xs whitespace-normal break-words max-w-[110px]">${escapeHtml(r.agent)}</td>
              <td class="text-xs whitespace-normal break-words max-w-[110px]">${escapeHtml(r.transactionId)}</td>
              <td>${r.reversed ? '<span class="badge badge-danger">Reversed</span>' : '<span class="badge badge-success">Synced</span>'}</td>
              <td>${(!r.reversed && Auth.can('reverse')) ? `<button class="btn btn-ghost btn-sm" data-reverse="${r.transactionId}">Reverse</button>` : ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${result.capped ? `<p class="text-xs text-[var(--warn)] px-4 py-2 border-t" style="border-color:var(--border)">Showing the first 200 matching records for these filters — narrow the date range or marketer to see everything.</p>` : ''}
    <div class="flex items-center justify-between p-4 border-t" style="border-color:var(--border)">
      <p class="text-xs text-[var(--text-muted)]">${result.total} total transactions</p>
      <div class="flex gap-2">
        <button id="hPrev" class="btn btn-ghost btn-sm" ${HistoryState.page <= 1 ? 'disabled' : ''}>Previous</button>
        <button id="hNext" class="btn btn-ghost btn-sm" ${HistoryState.page * 20 >= result.total ? 'disabled' : ''}>Next</button>
      </div>
    </div>
  `;
  const prev = document.getElementById('hPrev'), next = document.getElementById('hNext');
  if (prev) prev.addEventListener('click', () => { HistoryState.page--; renderHistoryFromMemory(); });
  if (next) next.addEventListener('click', () => { HistoryState.page++; renderHistoryFromMemory(); });
  document.querySelectorAll('[data-reverse]').forEach(btn => {
    btn.addEventListener('click', () => promptReversal('payment', btn.dataset.reverse, loadHistoryBase));
  });
}

function promptReversal(source, transactionId, onDone) {
  openModal(`
    <h3 class="font-display font-semibold text-lg mb-1">Reverse Transaction</h3>
    <p class="text-sm text-[var(--text-muted)] mb-4">${escapeHtml(transactionId)} — this does not delete the record, it corrects the balance and preserves full history.</p>
    <label class="field-label">Reason for reversal</label>
    <textarea id="reverseReason" rows="3" class="input mt-1 mb-4" placeholder="e.g. entered against the wrong school"></textarea>
    <div class="flex gap-2">
      <button id="cancelRev" class="btn btn-ghost flex-1">Cancel</button>
      <button id="confirmRev" class="btn btn-danger flex-1">Reverse</button>
    </div>
  `);
  document.getElementById('cancelRev').addEventListener('click', closeModal);
  document.getElementById('confirmRev').addEventListener('click', async () => {
    const reason = document.getElementById('reverseReason').value.trim();
    if (!reason) { toast('A reason is required.', 'error'); return; }
    const btn = document.getElementById('confirmRev');
    btn.disabled = true; btn.textContent = 'Reversing…';
    try {
      const res = await Api.reverseTransaction({ source, transactionId, reason });
      if (!res.ok) { toast(res.error || 'Reversal failed.', 'error'); btn.disabled = false; btn.textContent = 'Reverse'; return; }
      closeModal();
      toast('Transaction reversed.', 'success');
      onDone();
      refreshDashboardCache();

      if (State.selectedMarketer) loadMarketerLedger(State.selectedMarketer);
    } catch (ex) {
      toast('Network error while reversing.', 'error');
      btn.disabled = false; btn.textContent = 'Reverse';
    }
  });
}

/* ---------------------------------------------------------------
 * DECLARATIONS
 * --------------------------------------------------------------- */
const DeclState = { page: 1, filters: { status: '', marketer: '', search: '', reversed: '' }, allRows: [], baseTotal: 0 };

async function renderDeclarations(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-5"><h1 class="font-display text-lg font-semibold">Declarations</h1></div>
    <div class="card p-4 mb-5 flex flex-wrap gap-3 items-end">
      <div>
        <label class="field-label">Type</label>
        <select id="dStatus" class="input mt-1 w-40">
          <option value="">All types</option>
          <option>Clearance</option><option>Discount</option><option>Bad debt</option><option>Rejected</option>
        </select>
      </div>
      <div>
        <label class="field-label">Marketer</label>
        <select id="dMarketer" class="input mt-1 w-44"><option value="">All marketers</option></select>
      </div>
      <div>
        <label class="field-label">Reversed</label>
        <select id="dReversed" class="input mt-1 w-36">
          <option value="">All</option>
          <option value="yes">Reversed only</option>
          <option value="no">Not reversed</option>
        </select>
      </div>
      <div class="flex-1 min-w-[180px]">
        <label class="field-label">Search</label>
        <input id="dSearch" class="input mt-1" placeholder="School ID or name…" />
      </div>
    </div>
    <div id="declTableHost" class="card p-0 overflow-hidden">${skeletonTable(8)}</div>
  `;
  if (State.marketers.length === 0) {
    try { const r = await Api.getMarketers(); if (r.ok) State.marketers = r.marketers; } catch (e) {}
  }
  const msel = document.getElementById('dMarketer');
  msel.innerHTML += State.marketers.map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('');
  msel.value = DeclState.filters.marketer;
  document.getElementById('dStatus').value = DeclState.filters.status;
  document.getElementById('dReversed').value = DeclState.filters.reversed;
  document.getElementById('dSearch').value = DeclState.filters.search;

  
  function applyDeclBaseFilters() {
    DeclState.filters.status = document.getElementById('dStatus').value;
    DeclState.filters.marketer = document.getElementById('dMarketer').value;
    DeclState.filters.reversed = document.getElementById('dReversed').value;
    DeclState.page = 1;
    loadDeclBase();
  }
  document.getElementById('dStatus').addEventListener('change', applyDeclBaseFilters);
  document.getElementById('dMarketer').addEventListener('change', applyDeclBaseFilters);
  document.getElementById('dReversed').addEventListener('change', applyDeclBaseFilters);

 
  document.getElementById('dSearch').addEventListener('input', () => {
    DeclState.filters.search = document.getElementById('dSearch').value.trim();
    DeclState.page = 1;
    renderDeclFromMemory();
  });

  loadDeclBase();
}

function loadDeclBase() {
  const host = document.getElementById('declTableHost');
  const baseFilters = { status: DeclState.filters.status, marketer: DeclState.filters.marketer, reversed: DeclState.filters.reversed };
  const cacheKey = 'declbase:' + JSON.stringify(baseFilters);
  const cached = PortalCache.read(cacheKey);
  if (cached) {
    
  } else if (!host.querySelector('table')) {
    host.innerHTML = skeletonTable(8);
  } else {
    host.classList.add('opacity-50', 'pointer-events-none');
  }

  PortalCache.fetchWithCache(cacheKey, () => Api.getDeclarations({ ...baseFilters, search: '', page: 1, pageSize: 200 }), (res, fromCache) => {
    const stillCurrent = document.getElementById('declTableHost') && cacheKey === 'declbase:' + JSON.stringify({ status: DeclState.filters.status, marketer: DeclState.filters.marketer, reversed: DeclState.filters.reversed });
    if (!stillCurrent) return;
    if (!res.ok) {
      if (!fromCache) { host.classList.remove('opacity-50', 'pointer-events-none'); host.innerHTML = errorState('Could not load declarations.', res.error); }
      return;
    }
    DeclState.allRows = res.result.rows;
    DeclState.baseTotal = res.result.total;
    renderDeclFromMemory();
  });
}

function renderDeclFromMemory() {
  const host = document.getElementById('declTableHost');
  const q = DeclState.filters.search.toLowerCase();
  const filtered = !q ? DeclState.allRows : DeclState.allRows.filter(r =>
    (String(r.schoolId) + ' ' + String(r.schoolName)).toLowerCase().indexOf(q) !== -1);
  const pageSize = 20;
  const start = (DeclState.page - 1) * pageSize;
  paintDeclTable(host, {
    rows: filtered.slice(start, start + pageSize),
    total: filtered.length,
    capped: DeclState.baseTotal > DeclState.allRows.length
  });
}

function paintDeclTable(host, result) {
  host.classList.remove('opacity-50', 'pointer-events-none');
  if (result.rows.length === 0) { host.innerHTML = emptyState('No declarations found', 'Try widening your filters.'); return; }

  const statusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'clearance') return 'badge-success';
    if (s === 'discount') return 'badge-neutral';
    if (s === 'bad debt') return 'badge-danger';
    return 'badge-warn';
  };
  const reviewBadge = (rs) => {
    const s = String(rs || '').toLowerCase();
    if (s.indexOf('approved') !== -1) return 'badge-success';
    if (s.indexOf('pending') !== -1) return 'badge-warn';
    return 'badge-neutral';
  };

  host.innerHTML = `
    <div class="table-wrap">
      <table class="data">
        <thead><tr>
          <th>Date</th><th>School</th><th>Marketer</th><th>Type</th><th>Amount</th><th>Agent</th><th>Review</th><th>Decl. ID</th><th></th><th></th>
        </tr></thead>
        <tbody>
          ${result.rows.map(r => `
            <tr>
                        <td>${fmt.date(r.date)}</td>
              <td><p class="font-medium">${escapeHtml(r.schoolName)}</p><p class="text-xs text-[var(--text-muted)]">${escapeHtml(r.schoolId)}</p></td>
              <td>${escapeHtml(r.marketer)}</td>
              <td><span class="badge ${statusBadge(r.status)}">${escapeHtml(r.status)}</span></td>
              <td class="tabular-nums font-medium">${fmt.money(r.amount)}</td>
                           <td class="text-xs whitespace-normal break-words max-w-[110px]">${escapeHtml(r.agent)}</td>
              <td>${r.reversed ? '<span class="badge badge-danger">Reversed</span>' : `<span class="badge ${reviewBadge(r.reviewStatus)}">${escapeHtml(r.reviewStatus || '—')}</span>`}</td>
              <td class="text-xs whitespace-normal break-words max-w-[110px]">${escapeHtml(r.transactionId)}</td>
              <td>${(Auth.can('review') && !r.reversed && String(r.reviewStatus).toLowerCase() === 'pending review') ? `
                <button class="btn btn-ghost btn-sm" data-approve="${r.transactionId}">Approve</button>` : ''}</td>
              <td>${(!r.reversed && Auth.can('reverse')) ? `<button class="btn btn-ghost btn-sm" data-reverse="${r.transactionId}">Reverse</button>` : ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="flex items-center justify-between p-4 border-t" style="border-color:var(--border)">
      <p class="text-xs text-[var(--text-muted)]">${result.total} total declarations</p>
      <div class="flex gap-2">
        <button id="dPrev" class="btn btn-ghost btn-sm" ${DeclState.page <= 1 ? 'disabled' : ''}>Previous</button>
        <button id="dNext" class="btn btn-ghost btn-sm" ${DeclState.page * 20 >= result.total ? 'disabled' : ''}>Next</button>
      </div>
    </div>
  `;
  const prev = document.getElementById('dPrev'), next = document.getElementById('dNext');
  if (prev) prev.addEventListener('click', () => { DeclState.page--; renderDeclFromMemory(); });
  if (next) next.addEventListener('click', () => { DeclState.page++; renderDeclFromMemory(); });
  document.querySelectorAll('[data-reverse]').forEach(btn => btn.addEventListener('click', () => promptReversal('declaration', btn.dataset.reverse, loadDeclBase)));
  document.querySelectorAll('[data-approve]').forEach(btn => btn.addEventListener('click', async () => {
    btn.disabled = true; btn.textContent = '…';
    try {
      const res = await Api.reviewDeclaration({ transactionId: btn.dataset.approve, decision: 'approve' });
      if (!res.ok) { toast(res.error || 'Failed to approve.', 'error'); return; }
      toast('Declaration approved.', 'success');
      loadDeclBase();
      refreshDashboardCache();
    } catch (ex) { toast('Network error.', 'error'); }
  }));
}

/* ---------------------------------------------------------------
 * ADMIN (users + audit log) — admin role only
 * --------------------------------------------------------------- */
async function renderAdmin(container) {
  container.innerHTML = `
    <h1 class="font-display text-lg font-semibold mb-5">Admin</h1>
    <div class="grid lg:grid-cols-2 gap-6">
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-display font-semibold">Users</h2>
          <button id="newUserBtn" class="btn btn-primary btn-sm">+ New user</button>
        </div>
        <div id="usersHost">${skeletonTable(4)}</div>
      </div>
      <div class="card p-5">
        <h2 class="font-display font-semibold mb-4">Recent audit log</h2>
        <div id="auditHost">${skeletonTable(6)}</div>
      </div>
    </div>
  `;
  document.getElementById('newUserBtn').addEventListener('click', openNewUserModal);
  loadUsers();
  loadAudit();
}

async function loadUsers() {
  const host = document.getElementById('usersHost');
  try {
    const res = await Api.listUsers();
    if (!res.ok) throw new Error(res.error);
    host.innerHTML = `<div class="space-y-2">
      ${res.users.map(u => `
        <div class="surface-2 rounded-xl p-3 flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium">${escapeHtml(u.name)} <span class="text-xs text-[var(--text-muted)]">@${escapeHtml(u.username)}</span></p>
            <p class="text-xs text-[var(--text-muted)] capitalize">${escapeHtml(u.role)}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}">${escapeHtml(u.status)}</span>
            <button class="btn btn-ghost btn-sm" data-toggle="${escapeHtml(u.username)}" data-status="${u.status === 'active' ? 'disabled' : 'active'}">${u.status === 'active' ? 'Disable' : 'Enable'}</button>
          </div>
        </div>`).join('')}
    </div>`;
    host.querySelectorAll('[data-toggle]').forEach(btn => btn.addEventListener('click', async () => {
      const res2 = await Api.setUserStatus({ username: btn.dataset.toggle, status: btn.dataset.status });
      if (res2.ok) { toast('User updated.', 'success'); loadUsers(); } else toast(res2.error, 'error');
    }));
  } catch (ex) {
    host.innerHTML = errorState('Could not load users.', ex.message);
  }
}

function openNewUserModal() {
  openModal(`
    <h3 class="font-display font-semibold text-lg mb-4">New user</h3>
    <div class="space-y-3 mb-4">
      <div><label class="field-label">Full name</label><input id="nuName" class="input mt-1" /></div>
      <div><label class="field-label">Username</label><input id="nuUsername" class="input mt-1" /></div>
      <div><label class="field-label">PIN</label><input id="nuPin" class="input mt-1" type="password" /></div>
      <div><label class="field-label">Role</label>
        <select id="nuRole" class="input mt-1">
          <option value="agent">Payment Entry Agent</option>
          <option value="supervisor">Supervisor</option>
          <option value="admin">Super Admin</option>
        </select>
      </div>
    </div>
    <div class="flex gap-2">
      <button id="cancelNu" class="btn btn-ghost flex-1">Cancel</button>
      <button id="confirmNu" class="btn btn-primary flex-1">Create</button>
    </div>
  `);
  document.getElementById('cancelNu').addEventListener('click', closeModal);
  document.getElementById('confirmNu').addEventListener('click', async () => {
    const payload = {
      name: document.getElementById('nuName').value.trim(),
      username: document.getElementById('nuUsername').value.trim(),
      pin: document.getElementById('nuPin').value.trim(),
      role: document.getElementById('nuRole').value
    };
    if (!payload.username || !payload.pin) { toast('Username and PIN are required.', 'error'); return; }
    const res = await Api.createUser(payload);
    if (!res.ok) { toast(res.error || 'Could not create user.', 'error'); return; }
    closeModal(); toast('User created.', 'success'); loadUsers();
  });
}

async function loadAudit() {
  const host = document.getElementById('auditHost');
  try {
    const res = await Api.getAuditLog({ limit: 50 });
    if (!res.ok) throw new Error(res.error);
    host.innerHTML = `<div class="space-y-2 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
      ${res.log.map(l => `
        <div class="text-xs border-b pb-2" style="border-color:var(--border)">
          <div class="flex justify-between"><span class="font-medium">${escapeHtml(l.action)}</span><span class="text-[var(--text-muted)]">${fmt.date(l.timestamp)}</span></div>
          <p class="text-[var(--text-muted)]">${escapeHtml(l.actor)} (${escapeHtml(l.role)}) → ${escapeHtml(l.target)}</p>
        </div>`).join('')}
    </div>`;
  } catch (ex) {
    host.innerHTML = errorState('Could not load audit log.', ex.message);
  }
}

/* ---------------------------------------------------------------
 * BOOT
 * --------------------------------------------------------------- */
document.addEventListener('click', (e) => {
  const menu = document.getElementById('profileMenu');
  const btn = document.getElementById('profileBtn');
  if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
    menu.classList.add('hidden');
  }
});

renderShell();
