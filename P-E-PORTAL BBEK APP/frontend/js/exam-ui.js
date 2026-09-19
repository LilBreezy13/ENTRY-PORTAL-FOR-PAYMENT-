/* ============================================================
   EXAM SELECTION / SWITCHING / ADMIN UI
   ------------------------------------------------------------
   Everything new that multi-exam support needed on the frontend
   lives in this one file:
     - the full-screen "choose your exam" gate shown after login
     - the small exam-switcher dropdown/modal used from the topbar
     - the Admin > Exams management panel
   None of the existing screens (Home, Payment Entry, Recent,
   Payment History, Declarations, Admin > Users/Audit) were
   rewritten — this file only adds to them.
   ============================================================ */

let _pendingUsername = null;
let _pendingPin = null; // memory-only, cleared on logout/tab close — never persisted

function rememberPendingCredentials(username, pin) {
  _pendingUsername = username;
  _pendingPin = pin;
}
function forgetPendingCredentials() {
  _pendingUsername = null;
  _pendingPin = null;
}

/* ---------------------------------------------------------------
 * BOOT — decide whether to show Login, the Exam Gate, or the Shell
 * --------------------------------------------------------------- */
async function boot() {
  await Exams.loadExams();
  if (!Exams.getCurrent()) {
    const def = Exams.getDefaultExam();
    if (def) Exams.setCurrent(def);
  }

  if (!Auth.isLoggedIn()) {
    renderLogin();
    return;
  }
  Auth.loadFromSession();
  State.tab = 'home';
  renderShell();
}

// Called right after a fresh, successful login. Per the spec, exam
// selection happens after login — but if there's only one exam (or none
// registered yet, i.e. the Directory itself hasn't been set up), skip the
// extra screen and go straight in.
async function afterLoginGoToExamGate() {
  const exams = Exams.getExams();
  if (exams.length <= 1) {
    if (exams.length === 1) Exams.setCurrent(exams[0]);
    forgetPendingCredentials();
    State.tab = 'home';
    renderShell();
    return;
  }
  renderExamGate();
}

/* ---------------------------------------------------------------
 * EXAM GATE — full screen picker shown right after login
 * --------------------------------------------------------------- */
function examCardHtml(exam, selected) {
  return `
    <button class="exam-pick-card w-full text-left card p-4 flex items-center justify-between gap-3 ${selected ? 'ring-2' : ''}"
            style="${selected ? 'border-color:var(--amber-500)' : ''}" data-exam-code="${escapeHtml(exam.examCode)}">
      <div>
        <p class="font-display font-semibold">${escapeHtml(exam.examName)}</p>
        <p class="text-xs text-[var(--text-muted)] mt-0.5">${escapeHtml(exam.examCode)} · ${escapeHtml(exam.examMonth || '')} · ${escapeHtml(exam.examType || '')} · ${escapeHtml(exam.academicYear || '')}</p>
      </div>
      ${exam.isDefault ? '<span class="badge badge-warn">Default</span>' : ''}
    </button>`;
}

function renderExamGate() {
  const exams = Exams.getExams();
  const current = Exams.getCurrent();
  root.innerHTML = `
    <div class="min-h-screen flex items-center justify-center px-4" style="background: radial-gradient(circle at 20% 20%, var(--teal-800), var(--teal-950));">
      <div class="w-full max-w-md">
        <div class="flex flex-col items-center mb-6 text-white">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-xl mb-3" style="background:var(--amber-500)">📝</div>
          <h1 class="font-display text-xl font-semibold">Select an exam</h1>
          <p class="text-sm text-white/60 mt-1">Everything you do next will apply to this exam.</p>
        </div>
        <div id="examGateError" class="hidden badge badge-danger w-full !justify-center py-2 mb-3"></div>
        <div id="examGateList" class="space-y-2">
          ${exams.length ? exams.map(ex => examCardHtml(ex, current && current.examCode === ex.examCode)).join('') : emptyState('No exams registered yet.', 'Ask an admin to create one from the Admin panel.')}
        </div>
      </div>
    </div>
  `;
  Theme.init();
  document.querySelectorAll('[data-exam-code]').forEach(el => {
    el.addEventListener('click', () => {
      const exam = exams.find(e => e.examCode === el.dataset.examCode);
      if (exam) pickExam(exam);
    });
  });
}

/* ---------------------------------------------------------------
 * EXAM SWITCHER — compact control in the topbar + its modal
 * --------------------------------------------------------------- */
function examSwitcherHtml() {
  const exam = Exams.getCurrent();
  const label = exam ? exam.examName : 'Select exam';
  return `
    <button id="examSwitcherBtn" class="btn btn-ghost !text-white !border-white/20 btn-sm flex items-center gap-1.5" title="Switch exam">
      <span class="font-medium">${escapeHtml(label)}</span>
      <span>▾</span>
    </button>`;
}

function openExamSwitcherModal() {
  const exams = Exams.getExams();
  const current = Exams.getCurrent();
  openModal(`
    <h3 class="font-display font-semibold text-lg mb-1">Switch exam</h3>
    <p class="text-xs text-[var(--text-muted)] mb-4">Data across the app will refresh to the exam you pick.</p>
    <div id="examSwitchError" class="hidden badge badge-danger w-full !justify-center py-2 mb-3"></div>
    <div id="examSwitchList" class="space-y-2 max-h-[360px] overflow-y-auto scrollbar-thin pr-1">
      ${exams.map(ex => examCardHtml(ex, current && current.examCode === ex.examCode)).join('')}
    </div>
    <button id="cancelExamSwitch" class="btn btn-ghost w-full mt-4">Cancel</button>
  `);
  document.getElementById('cancelExamSwitch').addEventListener('click', closeModal);
  document.querySelectorAll('#examSwitchList [data-exam-code]').forEach(el => {
    el.addEventListener('click', () => {
      const exam = exams.find(e => e.examCode === el.dataset.examCode);
      if (exam) pickExam(exam, { fromModal: true });
    });
  });
}

/* ---------------------------------------------------------------
 * PICKING AN EXAM — the shared logic behind both screens above
 * --------------------------------------------------------------- */
function resetExamScopedState() {
  State.marketers = [];
  State.schools = [];
  State.selectedMarketer = null;
  State.selectedSchool = null;
  State.last20 = [];
  State.ledgerEntries = [];
  State.ledgerLoading = false;
  State.ledgerQuery = '';
  State.ledgerMatch = null;
  State.manualMatches = {};
}

async function pickExam(exam, opts = {}) {
  if (Exams.hasSession(exam.examCode)) {
    Exams.setCurrent(exam);
    Auth.loadFromSession();
    resetExamScopedState();
    forgetPendingCredentials();
    if (opts.fromModal) closeModal();
    State.tab = 'home';
    renderShell();
    return;
  }

  // Not authenticated with this exam yet this session — try the credentials
  // the user just typed at login (works whenever the same username/PIN was
  // provisioned across exams, which is the normal case for this org).
  if (_pendingUsername && _pendingPin) {
    const res = await Auth.loginToExam(exam, _pendingUsername, _pendingPin);
    if (res.ok) {
      Exams.setCurrent(exam);
      Auth.loadFromSession();
      resetExamScopedState();
      if (opts.fromModal) closeModal();
      State.tab = 'home';
      renderShell();
      return;
    }
  }

  promptExamPin(exam, opts);
}

function promptExamPin(exam, opts = {}) {
  const errHost = opts.fromModal ? document.getElementById('examSwitchError') : document.getElementById('examGateError');

  openModal(`
    <h3 class="font-display font-semibold text-lg mb-1">Sign in to ${escapeHtml(exam.examName)}</h3>
    <p class="text-xs text-[var(--text-muted)] mb-4">This exam needs its own sign-in the first time you use it this session.</p>
    <div id="examPinError" class="hidden badge badge-danger w-full !justify-center py-2 mb-3"></div>
    <div class="space-y-3 mb-4">
      <div><label class="field-label">Username</label><input id="epUsername" class="input mt-1" value="${escapeHtml(_pendingUsername || (Auth.getUser() || {}).username || '')}" /></div>
      <div><label class="field-label">PIN</label><input id="epPin" type="password" class="input mt-1" /></div>
    </div>
    <div class="flex gap-2">
      <button id="epCancel" class="btn btn-ghost flex-1">Cancel</button>
      <button id="epSubmit" class="btn btn-primary flex-1">Sign In</button>
    </div>
  `);
  document.getElementById('epCancel').addEventListener('click', () => {
    closeModal();
    if (opts.fromModal) openExamSwitcherModal();
  });
  document.getElementById('epSubmit').addEventListener('click', async () => {
    const username = document.getElementById('epUsername').value.trim();
    const pin = document.getElementById('epPin').value.trim();
    const err = document.getElementById('examPinError');
    const submitBtn = document.getElementById('epSubmit');
    err.classList.add('hidden');

    if (!username || !pin) {
      err.textContent = 'Enter a username and PIN.';
      err.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';
    try {
      const res = await Auth.loginToExam(exam, username, pin);
      if (!res.ok) {
        err.textContent = res.error || 'Unable to sign in to that exam.';
        err.classList.remove('hidden');
        return;
      }
      rememberPendingCredentials(username, pin);
      Exams.setCurrent(exam);
      Auth.loadFromSession();
      resetExamScopedState();
      closeModal();
      State.tab = 'home';
      renderShell();
      return;
    } catch (e) {
      console.error('Login request failed:', e);
      err.textContent = 'Could not reach ' + exam.examName + '\u2019s server. Check its API URL and Web App deployment. (' + (e.message || 'network error') + ')';
      err.classList.remove('hidden');
    }
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  });
}

/* ---------------------------------------------------------------
 * ADMIN > EXAMS
 * --------------------------------------------------------------- */
async function loadExamAdmin() {
  const host = document.getElementById('examsHost');
  if (!host) return;
  try {
    const res = await Exams.listExamsAll();
    if (!res.ok) throw new Error(res.error);
    host.innerHTML = `<div class="space-y-2">
      ${res.exams.map(ex => `
        <div class="surface-2 rounded-xl p-3 flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium">${escapeHtml(ex.examName)} <span class="text-xs text-[var(--text-muted)]">${escapeHtml(ex.examCode)}</span></p>
            <p class="text-xs text-[var(--text-muted)]">${escapeHtml(ex.examMonth || '')} · ${escapeHtml(ex.examType || '')} · ${escapeHtml(ex.academicYear || '')}</p>
          </div>
          <div class="flex items-center gap-2">
            ${ex.isDefault ? '<span class="badge badge-warn">Default</span>' : `<button class="btn btn-ghost btn-sm" data-set-default="${escapeHtml(ex.examCode)}">Make default</button>`}
            <span class="badge ${ex.active ? 'badge-success' : 'badge-danger'}">${ex.active ? 'Active' : 'Inactive'}</span>
            <button class="btn btn-ghost btn-sm" data-toggle-active="${escapeHtml(ex.examCode)}" data-active="${!ex.active}">${ex.active ? 'Deactivate' : 'Activate'}</button>
          </div>
        </div>`).join('')}
    </div>`;
    host.querySelectorAll('[data-set-default]').forEach(btn => btn.addEventListener('click', async () => {
      const res2 = await Exams.setDefaultExam(btn.dataset.setDefault);
      if (res2.ok) { toast('Default exam updated.', 'success'); await Exams.loadExams(); loadExamAdmin(); } else toast(res2.error, 'error');
    }));
    host.querySelectorAll('[data-toggle-active]').forEach(btn => btn.addEventListener('click', async () => {
      const res2 = await Exams.setExamActive(btn.dataset.toggleActive, btn.dataset.active === 'true');
      if (res2.ok) { toast('Exam updated.', 'success'); await Exams.loadExams(); loadExamAdmin(); } else toast(res2.error, 'error');
    }));
  } catch (ex) {
    host.innerHTML = errorState('Could not load exams.', ex.message);
  }
}

function openNewExamModal() {
  openModal(`
    <h3 class="font-display font-semibold text-lg mb-4">New exam</h3>
    <div class="space-y-3 mb-4">
      <div><label class="field-label">Exam name</label><input id="neName" class="input mt-1" placeholder="e.g. October Mock" /></div>
      <div><label class="field-label">Exam code</label><input id="neCode" class="input mt-1" placeholder="e.g. OCT-MOCK-2026" /></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="field-label">Month</label><input id="neMonth" class="input mt-1" placeholder="October" /></div>
        <div><label class="field-label">Type</label>
          <select id="neType" class="input mt-1">
            <option value="Mock">Mock</option>
            <option value="Terminal">Terminal</option>
          </select>
        </div>
      </div>
      <div><label class="field-label">Academic year</label><input id="neYear" class="input mt-1" placeholder="2026/27" /></div>
          <div><label class="field-label">Exam's Portal API URL</label><input id="neApiUrl" class="input mt-1" placeholder="https://script.google.com/macros/s/.../exec" /></div>
      <div>
        <label class="field-label">Portal spreadsheet ID</label>
        <input id="nePortalSheetId" class="input mt-1" placeholder="the ID from that exam's own Portal sheet URL" />
        <p class="text-xs text-[var(--text-muted)] mt-1">After deploying the worksheet appscript of the particular exam you want to link, get the WEB URL and the worksheet ID and paste in their right fields.</p>
      </div>
      <div>
        <label class="field-label">Ledger spreadsheet ID <span class="text-[var(--text-muted)]">(optional but best you add it)</span></label>
        <input id="neLedgerId" class="input mt-1" />
      </div>
    </div>
    <div class="flex gap-2">
      <button id="cancelNe" class="btn btn-ghost flex-1">Cancel</button>
      <button id="confirmNe" class="btn btn-primary flex-1">Create</button>
    </div>
  `);
  document.getElementById('cancelNe').addEventListener('click', closeModal);
  document.getElementById('confirmNe').addEventListener('click', async () => {
    const payload = {
      examName: document.getElementById('neName').value.trim(),
      examCode: document.getElementById('neCode').value.trim(),
      examMonth: document.getElementById('neMonth').value.trim(),
      examType: document.getElementById('neType').value,
      academicYear: document.getElementById('neYear').value.trim(),
      apiUrl: document.getElementById('neApiUrl').value.trim(),
      portalSheetId: document.getElementById('nePortalSheetId').value.trim(),
      ledgerSheetId: document.getElementById('neLedgerId').value.trim()
    };
    if (!payload.examName || !payload.examCode || !payload.apiUrl || !payload.portalSheetId) {
      toast('Exam name, exam code, API URL and Portal spreadsheet ID are required.', 'error');
      return;
    }
    const res = await Exams.createExam(payload);
    if (!res.ok) { toast(res.error || 'Could not create exam.', 'error'); return; }
    closeModal();
    toast('Exam created.', 'success');
    await Exams.loadExams();
    loadExamAdmin();
  });
}
