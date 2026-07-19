# Font Customization Guide

This document explains how to easily customize fonts across the matrAIx.ai website.

## Current Font Setup

- **Serif Font**: Neuton (display, headings, body text)
- **Monospace Font**: JetBrains Mono (code, terminal-style elements)

## Font Variables

All fonts are defined using CSS custom properties (variables) for easy customization. The main font variable file is `css/light-theme.css`:

```css
:root {
  --font-serif: "Neuton", Georgia, serif;
  --font-mono:  "JetBrains Mono", ui-monospace, monospace;
  --font-disp:  "Neuton", Georgia, serif;
}
```

Fallback fonts are included for better browser compatibility:
- Serif: Falls back to Georgia, then generic serif
- Monospace: Falls back to system monospace

## Changing Fonts Globally

To change all fonts on the site, edit the following files:

### 1. `css/light-theme.css` (Primary - applies to all pages)
Update the `:root` variables at the top:

```css
:root {
  --font-serif: "Your New Serif Font", Georgia, serif;
  --font-mono:  "Your New Mono Font", ui-monospace, monospace;
  --font-disp:  "Your New Serif Font", Georgia, serif;
}
```

### 2. Individual CSS files (for specific sections)
- `css/home.css` - Landing page
- `css/styles.css` - Main shared styles
- `css/benchmark.css` - Demo portal
- `css/explorer.css` - Persona explorer
- `css/play.css` - Quiz page

Update the `--disp` variable in each file's `:root` block.

### 3. Blog HTML files
- `blog/index.html`
- `blog/missing-human-layer.html`
- `blog/application-colm.html`
- `blog/env-colm.html`

Update the inline `--disp` variable in each file's `<style>` block.

## Font Import

All pages import Neuton from Google Fonts. To change the font:

1. Replace the Google Fonts URL in HTML files:
   ```html
   <link href="https://fonts.googleapis.com/css2?family=YOUR_FONT:wght@200;300;400;700&display=swap" rel="stylesheet" />
   ```

2. Or import from a different font service (e.g., Adobe Fonts, Typekit)

## Font Weight Usage

Neuton is imported with these weights: 200 (light), 300 (normal), 400 (regular), 700 (bold).

Currently used in CSS:
- `font-weight: 600` - Headlines, subheadings
- `font-weight: 500` - Body text, labels
- `font-weight: 400` - Regular text

## Keeping Brand Logo Unchanged

The brand logo (`.brand-mark`) is explicitly excluded from font changes:

```css
.brand-mark {
  font-family: inherit;
}
```

This ensures the logo maintains its original styling.

## Quick Customization Examples

### Change to a sans-serif font (e.g., Inter):
```css
:root {
  --font-serif: "Inter", sans-serif;
  --font-disp:  "Inter", sans-serif;
}
```

### Change only headings:
```css
h1, h2, h3, h4, h5, h6 {
  font-family: "Your Heading Font", serif;
}
```

### Use different fonts for different sections:
```css
/* Home page headings */
.headline {
  font-family: "Your Display Font", serif;
}

/* Blog text */
.blog-body {
  font-family: "Your Body Font", serif;
}
```

## Testing Font Changes

1. Update the font variable in `css/light-theme.css`
2. Ensure the font is properly imported (via Google Fonts or other service)
3. Test across all pages:
   - Home (`index.html`)
   - Persona explorer (`persona.html`)
   - Quiz (`play.html`)
   - Demo portal (`demo.html`)
   - Blog pages (`blog/`)

## Browser Support

The fallback font hierarchy ensures compatibility:
- Primary font (e.g., Neuton)
- Fallback serif/monospace font (Georgia, ui-monospace)
- Generic font family (serif, monospace)

This guarantees the site displays correctly even if the primary font fails to load.
