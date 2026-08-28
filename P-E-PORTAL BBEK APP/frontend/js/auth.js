const Auth = (() => {
  let currentUser = null;

  function getUser() { return currentUser; }

  function isLoggedIn() {
    return !!sessionStorage.getItem('pcp_token') && !!sessionStorage.getItem('pcp_user');
  }

  function loadFromSession() {
    const raw = sessionStorage.getItem('pcp_user');
    currentUser = raw ? JSON.parse(raw) : null;
    return currentUser;
  }

  async function login(username, pin) {
    const res = await Api.login(username, pin);
    if (res.ok) {
      sessionStorage.setItem('pcp_token', res.token);
      sessionStorage.setItem('pcp_user', JSON.stringify(res.user));
      currentUser = res.user;
    }
    return res;
  }

  async function logout() {
    try { await Api.logout(); } catch (e) { /* ignore */ }
    sessionStorage.removeItem('pcp_token');
    sessionStorage.removeItem('pcp_user');
    currentUser = null;
    renderShell();
  }

  function forceLogout(message) {
    sessionStorage.removeItem('pcp_token');
    sessionStorage.removeItem('pcp_user');
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
      viewAudit: ['agent', 'supervisor', 'admin']
    };
    return (perms[action] || []).includes(role);
  }

  return { getUser, isLoggedIn, loadFromSession, login, logout, forceLogout, can };
})();
