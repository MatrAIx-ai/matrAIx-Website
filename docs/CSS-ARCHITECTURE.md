# CSS Architecture — matrAIx.ai

Clear dependency structure for maintainability.

---

## Load Order (As Defined in HTML Files)

All HTML files load stylesheets in this order:

```
1. css/light-theme.css        ← TOKENS (single source of truth)
   └─ Defines all CSS custom properties (colors, fonts, sizes, spacing, line-heights)
   └─ Sets theme-specific styles (nav background, buttons, etc.)

2. page-specific.css      ← PAGE STYLES (if needed)
   ├─ css/home.css            (index.html, blog pages)
   ├─ css/explorer.css        (persona.html)
   ├─ css/benchmark.css       (demo.html)
   ├─ css/play.css            (play.html)
   └─ css/styles.css          (imported by css/explorer.css)

3. css/light-theme.css        ← THEME OVERRIDES
   └─ Reapplied to override any local color/background rules
```

**Key principle:** `css/light-theme.css` loads **last** so token definitions and theme overrides always win.

---

## CSS File Purpose

### css/light-theme.css (TOKENS & THEME)
**Location:** `css/light-theme.css`
**Contains:**
- ✅ All CSS custom properties (tokens)
- ✅ Theme-specific colors (light backgrounds, dark text)
- ✅ Base element styles (body, nav, buttons)
- ✅ Media query breakpoints for theme

**Does NOT contain:**
- ❌ Page-specific layouts (home hero, explorer grid, etc.)
- ❌ Component margins/padding details
- ❌ Animation keyframes

**To change:**
- Brand color? Edit `--phos` here.
- Font? Edit `--disp` or `--mono` here.
- Text size? Edit `--text-*` variables here.

---

### css/home.css (HOMEPAGE & SHARED)
**Location:** `css/home.css`
**Contains:**
- Homepage hero section layout
- Telemetry panels
- Report viewer tabs
- Training flywheel animation
- Mobile responsive breakpoints
- Shared navigation styles (used by index.html, blog pages)

**Uses tokens from:** css/light-theme.css

**To change:**
- Homepage layout? Edit here.
- Navigation styling? Edit here.
- Report viewer appearance? Edit here.

---

### css/styles.css (GLOBAL BASE)
**Location:** `css/styles.css`
**Contains:**
- Base element styles (buttons, cards, footer)
- Generic component classes
- Typography defaults
- Button variants (.btn-solid, .btn-ghost)

**Uses tokens from:** css/light-theme.css

**To change:**
- Global button appearance? Edit here.
- Card styling? Edit here.
- Footer layout? Edit here.

---

### css/explorer.css (PERSONA EXPLORER)
**Location:** `css/explorer.css`
**Contains:**
- Dimension card layout and styles
- Dimension grid system
- Persona drawer panel
- Explorer header and search
- Control panels

**Uses tokens from:** css/light-theme.css

**Imports:** css/styles.css (for base button/card styles)

**To change:**
- Dimension card appearance? Edit here.
- Drawer panel styling? Edit here.
- Search/filter appearance? Edit here.

---

### css/benchmark.css (DEMO & BENCHMARK)
**Location:** `css/benchmark.css`
**Contains:**
- Runway simulation visuals
- Agent state visualization
- Heatmap styling
- Benchmark report display
- Verdict panels

**Uses tokens from:** css/light-theme.css

**To change:**
- Demo runway appearance? Edit here.
- Benchmark report layout? Edit here.
- Agent state badges? Edit here.

---

### css/play.css (QUIZ PAGE)
**Location:** `css/play.css`
**Contains:**
- Quiz question cards
- Answer options
- Progress bar styling
- Result persona display
- Share/export interface

**Uses tokens from:** css/light-theme.css

**To change:**
- Quiz styling? Edit here.
- Result card appearance? Edit here.
- Progress indicator? Edit here.

---

## Token Usage by Component

| Component | Tokens Used | File |
|-----------|------------|------|
| **Colors** | `--bg`, `--bg-2`, `--ink`, `--phos`, `--amber`, `--rose`, `--line`, `--glow` | All CSS files |
| **Fonts** | `--disp`, `--mono` | All CSS files |
| **Font Sizes** | `--text-xs` through `--text-5xl` | All CSS files |
| **Line Heights** | `--leading-tight`, `--leading-snug`, `--leading-normal`, `--leading-loose` | All CSS files |
| **Letter Spacing** | `--tracking-tight` through `--tracking-widest` | All CSS files |
| **Breakpoints** | Mobile: `820px`, Desktop: explicit | css/light-theme.css, css/home.css |

---

## Common Edits & Where to Make Them

| Change | File | Location |
|--------|------|----------|
| Brand color (buttons, accents, glows) | `css/light-theme.css` | Line 15: `--phos` |
| Text color (dark/light) | `css/light-theme.css` | Line 13: `--ink` |
| Background colors | `css/light-theme.css` | Lines 10-12: `--bg`, `--bg-2`, `--bg-3` |
| Display/heading font | `css/light-theme.css` | Line 27: `--disp` |
| Code/monospace font | `css/light-theme.css` | Line 28: `--mono` |
| All font sizes | `css/light-theme.css` | Lines 32-40: `--text-*` |
| Line spacing | `css/light-theme.css` | Lines 43-46: `--leading-*` |
| Letter spacing | `css/light-theme.css` | Lines 49-54: `--tracking-*` |
| — | — | — |
| Homepage layout | `css/home.css` | — |
| Persona explorer | `css/explorer.css` | — |
| Demo benchmark | `css/benchmark.css` | — |
| Quiz page | `css/play.css` | — |
| Global buttons/cards | `css/styles.css` | — |
| Navigation | `css/home.css` | — |

---

## Adding a New Token

1. **Define** in `css/light-theme.css` `:root` block
2. **Document** in `DESIGN-TOKENS.md`
3. **Use** across files: `var(--your-new-token)`

Example:
```css
/* In css/light-theme.css :root */
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.08);

/* In any CSS file */
.card {
  box-shadow: var(--shadow-sm);
}
```

---

## Debugging Token Issues

**Problem:** Color not updating when I change `css/light-theme.css`
**Check:**
1. Is `css/light-theme.css` loading **last** in your HTML `<head>`?
2. Are you using `var(--color-name)` or hardcoded values?
3. Is there a more specific CSS rule overriding it?

**Problem:** Font not applying to all text
**Check:**
1. Is element using `font-family: var(--disp)` or hardcoded font?
2. Is there a parent element forcing a different font?
3. Check CSS specificity — more specific rules win.

**Problem:** Inconsistent spacing/sizing
**Check:**
1. Are hardcoded `px` values being used instead of variables?
2. Should this use `var(--text-*)` or `clamp()` for responsive scaling?
3. Is padding/margin using consistent multiples (8, 12, 16, 20)?

---

## Next Steps

- [ ] Formalize spacing scale (gaps, padding, margins)
- [ ] Add shadow/elevation system
- [ ] Add animation/transition durations
- [ ] Add responsive breakpoint variables
- [ ] Create component storybook/examples
