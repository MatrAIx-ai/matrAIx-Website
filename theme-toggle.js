/* Theme Toggle System
   - Detects system preference (prefers-color-scheme)
   - Saves user preference to localStorage
   - Provides icon button in header to switch themes
*/

(function() {
  const THEME_KEY = 'matraix-theme';
  const DARK = 'dark';
  const LIGHT = 'light';

  // Detect system preference
  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK : LIGHT;
  }

  // Get user's saved preference or system default
  function getSavedTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return getSystemTheme();
  }

  // Apply theme to document
  function setTheme(theme) {
    if (theme === DARK) {
      document.documentElement.setAttribute('data-theme', DARK);
      localStorage.setItem(THEME_KEY, DARK);
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem(THEME_KEY, LIGHT);
    }
    updateToggleIcon(theme);
  }

  // Update icon to reflect current theme
  function updateToggleIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    if (theme === DARK) {
      btn.innerHTML = '☀️'; // Sun icon for light mode
      btn.setAttribute('aria-label', 'Switch to light mode');
    } else {
      btn.innerHTML = '🌙'; // Moon icon for dark mode
      btn.setAttribute('aria-label', 'Switch to dark mode');
    }
  }

  // Initialize theme on page load
  function init() {
    const currentTheme = getSavedTheme();
    setTheme(currentTheme);

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(THEME_KEY)) {
        setTheme(e.matches ? DARK : LIGHT);
      }
    });

    // Setup toggle button click handler
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        const newTheme = currentTheme === DARK ? LIGHT : DARK;
        setTheme(newTheme);
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for manual control if needed
  window.matrAIxTheme = {
    set: setTheme,
    get: getSavedTheme,
    isDark: () => getSavedTheme() === DARK
  };
})();
