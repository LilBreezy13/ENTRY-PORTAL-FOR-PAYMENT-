const Api = (() => {
  function currentApiUrl() {
    const exam = typeof Exams !== "undefined" ? Exams.getCurrent() : null;
    return (
      (exam && exam.apiUrl) ||
      window.PORTAL_CONFIG.DEFAULT_API_URL ||
      window.PORTAL_CONFIG.API_URL
    );
  }

  function token() {
    const exam = typeof Exams !== "undefined" ? Exams.getCurrent() : null;
    if (exam) {
      const session = Exams.getSession(exam.examCode);
      if (session) return session.token;
    }
    // Legacy single-exam fallback (used only before any exam has been selected).
    return sessionStorage.getItem("pcp_token") || "";
  }

  async function call(action, payload = {}) {
    const body = JSON.stringify({
      action,
      token: token(),
      examCode:
        typeof Exams !== "undefined" && Exams.getCurrent()
          ? Exams.getCurrent().examCode
          : undefined,
      ...payload,
    });
    const res = await fetch(currentApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });
    if (!res.ok) throw new Error("Network error (" + res.status + ")");
    const data = await res.json();
    if (
      data.ok === false &&
      data.error === "Session expired. Please log in again."
    ) {
      Auth.forceLogout(data.error);
    }
    return data;
  }

  // Same call() helper, but targets a specific exam explicitly rather than
  // "whichever exam is currently selected" — used when logging into an exam
  // that isn't the active one yet (e.g. first-time switch to another exam).
  async function callForExam(exam, action, payload = {}) {
    const session = Exams.getSession(exam.examCode);
    const body = JSON.stringify({
      action,
      token: session ? session.token : "",
      examCode: exam.examCode,
      ...payload,
    });
    const res = await fetch(exam.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });
    if (!res.ok) throw new Error("Network error (" + res.status + ")");
    return res.json();
  }

  return {
    login: (username, pin) => call("login", { username, pin }),
    loginForExam: (exam, username, pin) =>
      callForExam(exam, "login", { username, pin }),
    logout: () => call("logout"),
    me: () => call("me"),
    getMarketers: () => call("getMarketers"),
    getSchools: (marketer) => call("getSchools", { marketer }),
    getLedgerForMarketer: (marketer) =>
      call("getLedgerForMarketer", {
        marketer,
        examCode: (Exams.getCurrent() || {}).examCode || "",
      }),
    manualMatchLedgerEntry: (p) => call("manualMatchLedgerEntry", p),
    resolveLedgerEntry: (p) => call("resolveLedgerEntry", p),
    getDashboardSummary: () => call("getDashboardSummary"),
    getLedgerToday: () => call("getLedgerToday"),
    addPayment: (p) => call("addPayment", p),
    addDeclaration: (p) => call("addDeclaration", p),
    getPaymentHistory: (p) => call("getPaymentHistory", p),
    getDeclarations: (p) => call("getDeclarations", p),
    reverseTransaction: (p) => call("reverseTransaction", p),
    reviewDeclaration: (p) => call("reviewDeclaration", p),
    getAuditLog: (p) => call("getAuditLog", p),
    listUsers: () => call("listUsers"),
    createUser: (p) => call("createUser", p),
    setUserStatus: (p) => call("setUserStatus", p),
  };
})();
