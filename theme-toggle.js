// Theme management for matrAIx.ai

(function() {
  const THEME_STORAGE_KEY = 'matrAIx-theme';
  const DARK_THEME = 'dark';
  const LIGHT_THEME = 'light';

  // Detect user's preferred theme
  function getPreferredTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) return stored;

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return LIGHT_THEME;
    }
    return DARK_THEME;
  }

  // Apply theme to document
  function applyTheme(theme) {
    if (theme === LIGHT_THEME) {
      document.documentElement.setAttribute('data-theme', LIGHT_THEME);
      localStorage.setItem(THEME_STORAGE_KEY, LIGHT_THEME);
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem(THEME_STORAGE_KEY, DARK_THEME);
    }
    updateToggleButton(theme);
  }

  // Update toggle button appearance and accessibility
  function updateToggleButton(theme) {
    const btn = document.querySelector('.theme-toggle');
    if (!btn) return;

    if (theme === LIGHT_THEME) {
      btn.textContent = '🌙';
      btn.setAttribute('aria-label', 'Switch to dark theme');
      btn.setAttribute('title', 'Dark mode');
    } else {
      btn.textContent = '☀️';
      btn.setAttribute('aria-label', 'Switch to light theme');
      btn.setAttribute('title', 'Light mode');
    }
  }

  // Initialize theme on page load
  function init() {
    const theme = getPreferredTheme();
    applyTheme(theme);

    // Setup toggle button listener
    const toggleBtn = document.querySelector('.theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || DARK_THEME;
        const next = current === DARK_THEME ? LIGHT_THEME : DARK_THEME;
        applyTheme(next);
      });
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Listen for system theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (!stored) {
        applyTheme(e.matches ? LIGHT_THEME : DARK_THEME);
      }
    });
  }
})();
