const Auth = (() => {
  let currentUser = null;

  function getUser() { return currentUser; }

  function activeExam() {
    return (typeof Exams !== 'undefined') ? Exams.getCurrent() : null;
  }

  function isLoggedIn() {
    const exam = activeExam();
    if (exam) {
      const session = Exams.getSession(exam.examCode);
      return !!(session && session.token && session.user);
    }
    // Legacy fallback path (no exam system reachable / configured yet).
    return !!sessionStorage.getItem('pcp_token') && !!sessionStorage.getItem('pcp_user');
  }

  function loadFromSession() {
    const exam = activeExam();
    if (exam) {
      const session = Exams.getSession(exam.examCode);
      currentUser = session ? session.user : null;
      return currentUser;
    }
    const raw = sessionStorage.getItem('pcp_user');
    currentUser = raw ? JSON.parse(raw) : null;
    return currentUser;
  }

  async function login(username, pin) {
    const res = await Api.login(username, pin);
    if (res.ok) {
      const exam = activeExam();
      if (exam) {
        Exams.saveSession(exam.examCode, res.token, res.user);
      } else {
        sessionStorage.setItem('pcp_token', res.token);
        sessionStorage.setItem('pcp_user', JSON.stringify(res.user));
      }
      currentUser = res.user;
    }
    return res;
  }

  // Used by the exam switcher: logs into a *different* exam using the
  // credentials the user just re-entered, without disturbing the session
  // already held for the currently active exam.
  async function loginToExam(exam, username, pin) {
    const res = await Api.loginForExam(exam, username, pin);
    if (res.ok) {
      Exams.saveSession(exam.examCode, res.token, res.user);
    }
    return res;
  }

  async function logout() {
    try { await Api.logout(); } catch (e) { /* ignore */ }
    const exam = activeExam();
    if (exam) {
      Exams.clearSession(exam.examCode);
    } else {
      sessionStorage.removeItem('pcp_token');
      sessionStorage.removeItem('pcp_user');
    }
    currentUser = null;
    renderShell();
  }

  function forceLogout(message) {
    const exam = activeExam();
    if (exam) {
      Exams.clearSession(exam.examCode);
    } else {
      sessionStorage.removeItem('pcp_token');
      sessionStorage.removeItem('pcp_user');
    }
    currentUser = null;
    renderShell(message);
  }

  function can(action) {
    if (!currentUser) return false;
    const role = currentUser.role;
     const perms = {
      enterPayment: ['agent', 'supervisor', 'admin'],
      reverse: ['agent', 'supervisor', 'admin'],
      review: ['agent', 'supervisor', 'admin'],
      manageUsers: ['admin'],
      manageExams: ['admin'],
      viewAudit: ['agent', 'supervisor', 'admin']
    };
    return (perms[action] || []).includes(role);
  }

  return { getUser, isLoggedIn, loadFromSession, login, loginToExam, logout, forceLogout, can };
})();
