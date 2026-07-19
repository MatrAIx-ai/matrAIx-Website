# Design Tokens — matrAIx.ai

**Single source of truth for all design decisions.**

All design tokens are defined in `css/light-theme.css` as CSS custom properties (variables). Change values there and they propagate site-wide.

---

## Colors

Update in `css/light-theme.css` lines 10-22.

### Backgrounds
```css
--bg:        #ffffff;      /* Primary background (white) */
--bg-2:      #f8f9fa;      /* Secondary background (light grey) */
--bg-3:      #f3f4f6;      /* Tertiary background (lighter grey) */
```

### Text / Ink
```css
--ink:       #1a1a1a;      /* Primary text (dark) */
--ink-dim:   #404040;      /* Muted/secondary text (charcoal) */
```

### Accent Colors
```css
--phos:      #003d7a;      /* Primary accent (dark navy blue) */
--phos-deep: #001a4d;      /* Darker accent variant */
--cyan:      #0052a3;      /* Cyan accent (blue spectrum) */
--amber:     #d97706;      /* Warning color (orange) */
--rose:      #dc2626;      /* Error/fail color (red) */
```

### Borders & Effects
```css
--line:      rgba(0, 61, 122, 0.12);    /* Default border (subtle navy) */
--line-soft: rgba(0, 61, 122, 0.06);    /* Soft border (very subtle) */
--glow:      0 0 22px rgba(0, 61, 122, 0.25);  /* Accent glow effect */
```

---

## Typography

Update in `css/light-theme.css` lines 24-29.

### Font Families
```css
--disp:      "Neuton", Georgia, serif;  /* Display/heading font (serif) */
--mono:      "JetBrains Mono", ui-monospace, monospace;  /* Code/monospace */
```

**Note:** Use `--disp` for all user-facing text (headings, labels, body). Use `--mono` only for code/terminal output.

---

## Font Sizes

Update in `css/light-theme.css` lines 31-40.

Follows 1.25 modular ratio for harmonious scaling:

```css
--text-xs:   0.64rem;   /* Extra small (10px) — tiny labels, badges */
--text-sm:   0.8rem;    /* Small (12px) — secondary text, captions */
--text-base: 1rem;      /* Base (16px) — body text, default */
--text-lg:   1.25rem;   /* Large (20px) — section labels, prominence */
--text-xl:   1.56rem;   /* Extra large (25px) — small headings */
--text-2xl:  1.95rem;   /* 2x large (31px) — medium headings */
--text-3xl:  2.44rem;   /* 3x large (39px) — large headings */
--text-4xl:  3.05rem;   /* 4x large (49px) — prominent displays */
--text-5xl:  3.81rem;   /* 5x large (61px) — hero/maximum */
```

---

## Font Weights

Not variables—use these literal values in CSS:

```
200 — Light (seldom used)
300 — Regular light (seldom used)
400 — Regular (body text default)
500 — Medium (subtle emphasis)
600 — Semibold (table headers, toggles)
700 — Bold (headings, primary accents) ← PRIMARY for emphasis
```

**Guideline:** Use `font-weight: 700` for all headings and primary emphasis. Body text defaults to 400.

---

## Line Heights

Update in `css/light-theme.css` lines 42-46.

```css
--leading-tight:  1.1;    /* Tight spacing (headlines) */
--leading-snug:   1.2;    /* Snug spacing (subheadings) */
--leading-normal: 1.6;    /* Normal spacing (body text) */
--leading-loose:  1.8;    /* Loose spacing (emphasis, accessibility) */
```

**Guideline:** Use `--leading-normal` for body text. Use `--leading-snug` for headings.

---

## Letter Spacing

Update in `css/light-theme.css` lines 48-54.

```css
--tracking-tight:   -0.02em;  /* Negative spacing (tight headlines) */
--tracking-snug:    -0.01em;  /* Slight negative (headings) */
--tracking-normal:  0;        /* No extra spacing */
--tracking-wide:    0.05em;   /* Readable spacing (labels) */
--tracking-wider:   0.1em;    /* Wide spacing (small caps) */
--tracking-widest:  0.15em;   /* Very wide spacing (all-caps) */
```

**Guideline:** Use `--tracking-snug` for headings. Use `--tracking-wide` or `--tracking-wider` for small uppercase labels.

---

## Spacing (Not Yet Formalized)

These don't have variables yet but should be consistent:

- **Padding/Margins:** Use `clamp()` for responsive spacing
- **Gap:** Use 8px, 12px, 16px, 20px, 24px multiples
- **Border radius:** 4px (small), 8px (medium), 12px (cards), 100px (pills)

---

## How to Use

### Example: Update brand color across entire site

1. Open `css/light-theme.css`
2. Change `--phos: #003d7a;` to your new color
3. **Done.** All buttons, accents, highlights, and glows update instantly

### Example: Make all body text smaller

1. Open `css/light-theme.css`
2. Change `--text-base: 1rem;` to `0.9rem;`
3. **Done.** All base text scales proportionally

### Example: Change font to sans-serif

1. Open `css/light-theme.css`
2. Change `--disp: "Neuton", Georgia, serif;` to `"Inter", sans-serif;`
3. Make sure the font is imported at top of file
4. **Done.** All display text switches immediately

---

## Where Tokens Are Used

- **css/light-theme.css** — Token definitions (single source of truth)
- **css/home.css** — Homepage styles (uses tokens)
- **css/styles.css** — Global styles (uses tokens)
- **css/explorer.css** — Persona explorer (uses tokens)
- **css/benchmark.css** — Demo benchmark (uses tokens)
- **css/play.css** — Quiz page (uses tokens)

All CSS files **import and reference** these tokens—they don't override or duplicate them.

---

## Best Practices

✅ **DO:**
- Use CSS variables from css/light-theme.css
- Use `clamp()` for responsive font sizes
- Keep all color, font, and size decisions in css/light-theme.css
- Document any new tokens you add

❌ **DON'T:**
- Hardcode colors (`#ffffff`, `#1a1a1a`) in component files
- Hardcode font sizes (`16px`, `1.5rem`) in component files
- Duplicate token values across files
- Change values locally — always edit css/light-theme.css

---

## Future Enhancements

- [ ] Add spacing scale (margins, padding, gaps)
- [ ] Add shadow/elevation system
- [ ] Add animation/transition duration variables
- [ ] Add responsive breakpoint variables
- [ ] Document exact component usage for each token
