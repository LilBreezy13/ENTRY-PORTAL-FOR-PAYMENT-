
const PortalCache = (() => {

  const PREFIX = 'pcp_cache_v2_';

  function scopedKey(key) {
    const exam = (typeof Exams !== 'undefined') ? Exams.getCurrent() : null;
    // Namespacing by exam code means switching exams never shows a stale
    // dashboard/ledger/history from whichever exam was viewed previously.
    return exam ? (exam.examCode + '::' + key) : key;
  }

  function read(key) {
    try {
      const raw = localStorage.getItem(PREFIX + scopedKey(key));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(PREFIX + scopedKey(key), JSON.stringify(value));
    } catch (e) { /* storage full or unavailable — safe to ignore, just skip caching */ }
  }

  function clear(key) {
    try { localStorage.removeItem(PREFIX + scopedKey(key)); } catch (e) { /* ignore */ }
  }


  function fetchWithCache(key, fetcher, onUpdate) {
    const cached = read(key);
    if (cached) onUpdate(cached, /* fromCache */ true);

    fetcher().then((res) => {
      if (res && res.ok) {
        write(key, res);
        onUpdate(res, /* fromCache */ false);
      }
    }).catch(() => {
      // Network hiccup — if we already showed cached data, fail silently.
      // If there was no cache either, the caller's own catch/error UI handles it.
    });
  }

  return { read, write, clear, fetchWithCache };
})();
