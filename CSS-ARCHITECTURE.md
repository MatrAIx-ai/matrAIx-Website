# CSS Architecture — matrAIx.ai

Clear dependency structure for maintainability.

---

## Load Order (As Defined in HTML Files)

All HTML files load stylesheets in this order:

```
1. light-theme.css        ← TOKENS (single source of truth)
   └─ Defines all CSS custom properties (colors, fonts, sizes, spacing, line-heights)
   └─ Sets theme-specific styles (nav background, buttons, etc.)

2. page-specific.css      ← PAGE STYLES (if needed)
   ├─ home.css            (index.html, blog pages)
   ├─ explorer.css        (persona.html)
   ├─ benchmark.css       (demo.html)
   ├─ play.css            (play.html)
   └─ styles.css          (imported by explorer.css)

3. light-theme.css        ← THEME OVERRIDES
   └─ Reapplied to override any local color/background rules
```

**Key principle:** `light-theme.css` loads **last** so token definitions and theme overrides always win.

---

## CSS File Purpose

### light-theme.css (TOKENS & THEME)
**Location:** `light-theme.css`  
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

### home.css (HOMEPAGE & SHARED)
**Location:** `home.css`  
**Contains:**
- Homepage hero section layout
- Telemetry panels
- Report viewer tabs
- Training flywheel animation
- Mobile responsive breakpoints
- Shared navigation styles (used by index.html, blog pages)

**Uses tokens from:** light-theme.css

**To change:**
- Homepage layout? Edit here.
- Navigation styling? Edit here.
- Report viewer appearance? Edit here.

---

### styles.css (GLOBAL BASE)
**Location:** `styles.css`  
**Contains:**
- Base element styles (buttons, cards, footer)
- Generic component classes
- Typography defaults
- Button variants (.btn-solid, .btn-ghost)

**Uses tokens from:** light-theme.css

**To change:**
- Global button appearance? Edit here.
- Card styling? Edit here.
- Footer layout? Edit here.

---

### explorer.css (PERSONA EXPLORER)
**Location:** `explorer.css`  
**Contains:**
- Dimension card layout and styles
- Dimension grid system
- Persona drawer panel
- Explorer header and search
- Control panels

**Uses tokens from:** light-theme.css

**Imports:** styles.css (for base button/card styles)

**To change:**
- Dimension card appearance? Edit here.
- Drawer panel styling? Edit here.
- Search/filter appearance? Edit here.

---

### benchmark.css (DEMO & BENCHMARK)
**Location:** `benchmark.css`  
**Contains:**
- Runway simulation visuals
- Agent state visualization
- Heatmap styling
- Benchmark report display
- Verdict panels

**Uses tokens from:** light-theme.css

**To change:**
- Demo runway appearance? Edit here.
- Benchmark report layout? Edit here.
- Agent state badges? Edit here.

---

### play.css (QUIZ PAGE)
**Location:** `play.css`  
**Contains:**
- Quiz question cards
- Answer options
- Progress bar styling
- Result persona display
- Share/export interface

**Uses tokens from:** light-theme.css

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
| **Breakpoints** | Mobile: `820px`, Desktop: explicit | light-theme.css, home.css |

---

## Common Edits & Where to Make Them

| Change | File | Location |
|--------|------|----------|
| Brand color (buttons, accents, glows) | `light-theme.css` | Line 15: `--phos` |
| Text color (dark/light) | `light-theme.css` | Line 13: `--ink` |
| Background colors | `light-theme.css` | Lines 10-12: `--bg`, `--bg-2`, `--bg-3` |
| Display/heading font | `light-theme.css` | Line 27: `--disp` |
| Code/monospace font | `light-theme.css` | Line 28: `--mono` |
| All font sizes | `light-theme.css` | Lines 32-40: `--text-*` |
| Line spacing | `light-theme.css` | Lines 43-46: `--leading-*` |
| Letter spacing | `light-theme.css` | Lines 49-54: `--tracking-*` |
| — | — | — |
| Homepage layout | `home.css` | — |
| Persona explorer | `explorer.css` | — |
| Demo benchmark | `benchmark.css` | — |
| Quiz page | `play.css` | — |
| Global buttons/cards | `styles.css` | — |
| Navigation | `home.css` | — |

---

## Adding a New Token

1. **Define** in `light-theme.css` `:root` block
2. **Document** in `DESIGN-TOKENS.md`
3. **Use** across files: `var(--your-new-token)`

Example:
```css
/* In light-theme.css :root */
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.08);

/* In any CSS file */
.card {
  box-shadow: var(--shadow-sm);
}
```

---

## Debugging Token Issues

**Problem:** Color not updating when I change `light-theme.css`  
**Check:**
1. Is `light-theme.css` loading **last** in your HTML `<head>`?
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
