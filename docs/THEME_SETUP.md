# Theme System Setup

The matrAIx.ai site now supports both dark and light themes with persistent user preference storage.

## Files Added

### 1. **css/light-theme.css**
Contains all light theme color overrides and styling. Uses CSS custom properties (variables) to override the dark theme defaults:
- White background (`--bg: #ffffff`)
- Dark text (`--ink: #1a1a1a`)
- Blue accent color (`--phos: #0066cc`)
- Adjusted opacity for visual elements (grain, scanlines, vignette)
- Light theme-specific adjustments for buttons, cards, panels, and UI components

### 2. **theme-toggle.js**
JavaScript module that handles:
- Theme detection (user preference, system preference, or default to dark)
- Persistent storage in localStorage (`matrAIx-theme`)
- DOM attribute management (`data-theme="light"` on `<html>`)
- Toggle button updates and event listeners
- System theme preference listener (respects OS dark/light mode changes)

## Implementation Details

### HTML Changes
Each HTML file includes:
1. Light theme CSS link: `<link rel="stylesheet" href="css/light-theme.css" />`
2. Theme toggle button: `<button class="theme-toggle">☀️</button>`
3. Theme script: `<script src="theme-toggle.js"></script>`

Updated files:
- `index.html` (home page)
- `persona.html`
- `play.html`
- `demo.html`
- `demo_harbor.html`

### CSS Architecture
- **Dark theme (default)**: Uses `:root` color variables in original CSS files
- **Light theme**: Uses `html[data-theme="light"]` selector to override variables
- Both themes maintain the same visual hierarchy and design intent

### User Experience
- Click the 🌙/☀️ button (fixed position, top-right) to toggle themes
- Preference is saved automatically to browser localStorage
- On first visit, uses system preference if available, otherwise defaults to dark
- Theme persists across page reloads and sessions

## Color Reference

### Dark Theme (Default)
```css
--bg:        #060807
--ink:       #d6e6d8
--phos:      #3ba9ff (cyan/blue)
--amber:     #ffb547
--rose:      #ff5c6c
```

### Light Theme
```css
--bg:        #ffffff
--ink:       #1a1a1a
--phos:      #0066cc (darker blue)
--amber:     #d97706
--rose:      #dc2626
```

## Customization

To adjust light theme colors, edit `css/light-theme.css` in the `html[data-theme="light"]` rules. The light theme CSS fully overrides dark theme variables for any element.
