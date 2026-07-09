/* Theme Toggle System
   - Auto-detects system preference (prefers-color-scheme)
   - Saves user preference to localStorage
   - Modern toggle with smooth transitions
   - Dispatch custom events for theme changes
*/

(function() {
  const THEME_KEY = 'matraix-theme';
  const DARK = 'dark';
  const LIGHT = 'light';

  // Get system preference
  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK : LIGHT;
  }

  // Get current theme (saved preference or system default)
  function getCurrentTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return getSystemTheme();
  }

  // Apply theme to document and dispatch event
  function setTheme(theme) {
    const isDark = theme === DARK;

    // Update DOM
    if (isDark) {
      document.documentElement.setAttribute('data-theme', DARK);
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.style.colorScheme = 'light';
    }

    // Save preference
    localStorage.setItem(THEME_KEY, theme);

    // Update button
    updateToggleButton(isDark);

    // Dispatch custom event
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme, isDark } }));

    // Add transition class for smooth effect
    document.documentElement.classList.add('theme-transitioning');
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 300);
  }

  // Update toggle button icon
  function updateToggleButton(isDark) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    btn.innerHTML = isDark ? '☀️' : '🌙';
    btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.setAttribute('title', isDark ? 'Light mode' : 'Dark mode');
  }

  // Initialize on page load
  function init() {
    const theme = getCurrentTheme();
    setTheme(theme);

    // Listen for system preference changes (only if user hasn't set preference)
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      if (!localStorage.getItem(THEME_KEY)) {
        setTheme(e.matches ? DARK : LIGHT);
      }
    });

    // Setup toggle button click handler
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const newTheme = getCurrentTheme() === DARK ? LIGHT : DARK;
        setTheme(newTheme);
      });
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API
  window.matrAIxTheme = {
    set: setTheme,
    get: getCurrentTheme,
    isDark: () => getCurrentTheme() === DARK,
    toggle: () => setTheme(getCurrentTheme() === DARK ? LIGHT : DARK)
  };
})();
