const Theme = (() => {
  const KEY = 'pcp_theme';

  function apply(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.classList.toggle('dark', mode === 'dark');
    localStorage.setItem(KEY, mode);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = mode === 'dark' ? '☀️' : '🌙';
  }

  function init() {
    const saved = localStorage.getItem(KEY);
    const preferred = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    apply(preferred);
  }

  function toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    apply(current === 'dark' ? 'light' : 'dark');
  }

  return { init, toggle, apply };
})();

Theme.init();
