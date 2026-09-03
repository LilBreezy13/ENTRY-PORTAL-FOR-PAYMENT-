
const Api = (() => {
  function token() {
    return sessionStorage.getItem('pcp_token') || '';
  }

  async function call(action, payload = {}) {
    const body = JSON.stringify({ action, token: token(), ...payload });
    const res = await fetch(window.PORTAL_CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    });
    if (!res.ok) throw new Error('Network error (' + res.status + ')');
    const data = await res.json();
    if (data.ok === false && data.error === 'Session expired. Please log in again.') {
      Auth.forceLogout(data.error);
    }
    return data;
  }

  return {
    login: (username, pin) => call('login', { username, pin }),
    logout: () => call('logout'),
    me: () => call('me'),
    getMarketers: () => call('getMarketers'),
    getSchools: (marketer) => call('getSchools', { marketer }),
       getLedgerForMarketer: (marketer) => call('getLedgerForMarketer', { marketer }),
    manualMatchLedgerEntry: (p) => call('manualMatchLedgerEntry', p),
       getDashboardSummary: () => call('getDashboardSummary'),
    getLedgerToday: () => call('getLedgerToday'),
    addPayment: (p) => call('addPayment', p),
    addDeclaration: (p) => call('addDeclaration', p),
    getPaymentHistory: (p) => call('getPaymentHistory', p),
    getDeclarations: (p) => call('getDeclarations', p),
    reverseTransaction: (p) => call('reverseTransaction', p),
    reviewDeclaration: (p) => call('reviewDeclaration', p),
    getAuditLog: (p) => call('getAuditLog', p),
    listUsers: () => call('listUsers'),
    createUser: (p) => call('createUser', p),
    setUserStatus: (p) => call('setUserStatus', p)
  };
})();
