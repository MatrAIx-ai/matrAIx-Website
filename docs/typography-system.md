# Modern Typography System for matrAIx.ai

## Current Issues
- Inconsistent font sizes across pages (ranging from 0.6rem to 4rem without clear hierarchy)
- No standardized vertical rhythm
- Mix of serif and monospace fonts without clear usage patterns
- Scattered weight assignments (200-800)
- Mobile responsiveness uses `clamp()` inconsistently

## Proposed Modern System

### Font Scale (Modular 1.25 ratio)
- xs: 0.64rem (10px)
- sm: 0.8rem (12px)
- base: 1rem (16px)
- lg: 1.25rem (20px)
- xl: 1.56rem (25px)
- 2xl: 1.95rem (31px)
- 3xl: 2.44rem (39px)
- 4xl: 3.05rem (49px)
- 5xl: 3.81rem (61px)

### Font Weights
- Light: 200 (rare, use sparingly)
- Regular: 400 (body text)
- Medium: 500 (secondary headings)
- SemiBold: 600 (primary headings, UI elements)
- Bold: 700 (emphasis, strong)

### Typography Rules

#### Display/Serif (Neuton)
- Page Titles (h1): 3.05rem / 49px, weight 700, line-height 1.1
- Section Titles (h2): 2.44rem / 39px, weight 600, line-height 1.2
- Subsection Titles (h3): 1.95rem / 31px, weight 600, line-height 1.2
- Small Titles (h4): 1.56rem / 25px, weight 600, line-height 1.3
- Labels (h5/h6): 1.25rem / 20px, weight 600, line-height 1.4

#### Body/Serif (Neuton)
- Body text: 1rem / 16px, weight 400, line-height 1.6
- Body emphasized: 1rem / 16px, weight 600, line-height 1.6
- Captions: 0.875rem / 14px, weight 400, line-height 1.5
- Small text: 0.8rem / 12px, weight 400, line-height 1.5

#### Monospace (JetBrains Mono)
- Code blocks: 0.9rem / 14px, weight 400
- Terminal: 0.8rem / 12px, weight 400
- Inline code: 0.85rem / 13px, weight 500
- Metadata/Labels: 0.75rem / 12px, weight 500, letter-spacing 0.1em

### Responsive Scaling
Use `clamp(minSize, calcSize, maxSize)` for key elements:
- H1: `clamp(2rem, 5vw, 3.81rem)`
- H2: `clamp(1.5rem, 4vw, 2.44rem)`
- Body: `clamp(0.95rem, 2vw, 1.1rem)`

### Line Heights
- Tight (headings): 1.1 - 1.2
- Normal (body): 1.6 - 1.8
- Loose (list items): 1.8 - 2

### Letter Spacing
- Headlines: -0.02em
- Subheadings: -0.01em
- Body: 0
- Labels: 0.05em - 0.12em
- All caps: 0.08em - 0.12em
