/* ============================================================
   EXAM REGISTRY CLIENT
   ------------------------------------------------------------
   Talks to the shared "Exam Directory" Apps Script (see
   backend/ExamDirectory.gs). Knows nothing about payments,
   marketers or schools — its only job is:
     1. list the exams an admin has registered
     2. remember which exam is currently selected
     3. hold one API session (token+user) per exam per browser
        session, so switching exams doesn't force a re-login
        when you've already authenticated with that exam before
   ============================================================ */

const Exams = (() => {
  const SESSIONS_KEY = 'pcp_exam_sessions';   // { [examCode]: { token, user } }
  const CURRENT_KEY = 'pcp_current_exam';     // exam object of the active exam
  const LIST_CACHE_KEY = 'pcp_exam_list_cache';

  let list = [];       // cached list of exams from the Directory
  let current = null;  // the exam object currently in use

  function directoryUrl() {
    return window.PORTAL_CONFIG.DIRECTORY_API_URL;
  }

  async function directoryCall(action, payload = {}) {
    const res = await fetch(directoryUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload })
    });
    if (!res.ok) throw new Error('Directory network error (' + res.status + ')');
    return res.json();
  }

  async function loadExams() {
    try {
      const res = await directoryCall('listExams');
      if (res.ok) {
        list = res.exams;
        try { sessionStorage.setItem(LIST_CACHE_KEY, JSON.stringify(list)); } catch (e) {}
      }
      return res;
    } catch (e) {
      // Directory unreachable — fall back to whatever we last saw this session,
      // so a flaky connection doesn't strand a user who already picked an exam.
      const cached = sessionStorage.getItem(LIST_CACHE_KEY);
      if (cached) { list = JSON.parse(cached); return { ok: true, exams: list, stale: true }; }
      return { ok: false, error: e.message || 'Could not reach the Exam Directory.' };
    }
  }

  function getExams() { return list; }

  function getDefaultExam() {
    return list.find(e => e.isDefault) || list[0] || null;
  }

  function getCurrent() {
    if (current) return current;
    const raw = sessionStorage.getItem(CURRENT_KEY);
    current = raw ? JSON.parse(raw) : null;
    return current;
  }

  function setCurrent(exam) {
    current = exam;
    sessionStorage.setItem(CURRENT_KEY, JSON.stringify(exam));
  }

  function clearCurrent() {
    current = null;
    sessionStorage.removeItem(CURRENT_KEY);
  }

  function allSessions() {
    try { return JSON.parse(sessionStorage.getItem(SESSIONS_KEY) || '{}'); } catch (e) { return {}; }
  }

  function getSession(examCode) {
    return allSessions()[examCode] || null;
  }

  function saveSession(examCode, token, user) {
    const sessions = allSessions();
    sessions[examCode] = { token, user };
    sessionStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }

  function clearSession(examCode) {
    const sessions = allSessions();
    delete sessions[examCode];
    sessionStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }

  function clearAllSessions() {
    sessionStorage.removeItem(SESSIONS_KEY);
    clearCurrent();
  }

  function hasSession(examCode) {
    return !!getSession(examCode);
  }

  /* ---- Admin exam-management actions (each verified against the
     admin's CURRENT exam session — see ExamDirectory.gs) ---- */
  function adminAuthPayload() {
    const exam = getCurrent();
    const session = exam ? getSession(exam.examCode) : null;
    return {
      verifyApiUrl: exam ? exam.apiUrl : '',
      token: session ? session.token : ''
    };
  }

  async function createExam(fields) {
    return directoryCall('createExam', { ...fields, ...adminAuthPayload() });
  }
  async function updateExam(fields) {
    return directoryCall('updateExam', { ...fields, ...adminAuthPayload() });
  }
  async function setDefaultExam(examCode) {
    return directoryCall('setDefaultExam', { examCode, ...adminAuthPayload() });
  }
  async function setExamActive(examCode, active) {
    return directoryCall('setExamActive', { examCode, active, ...adminAuthPayload() });
  }
  async function listExamsAll() {
    return directoryCall('listExamsAll', adminAuthPayload());
  }

  return {
    loadExams, getExams, getDefaultExam,
    getCurrent, setCurrent, clearCurrent,
    getSession, saveSession, clearSession, clearAllSessions, hasSession,
    createExam, updateExam, setDefaultExam, setExamActive, listExamsAll
  };
})();
