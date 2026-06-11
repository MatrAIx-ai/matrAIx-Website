# matrAIx

**Agent Simulation for Eval — 8.3-Billion-Behavior.**

matrAIx spins up populations of autonomous agents, runs them across adversarial
worlds, and scores every decision — so capability, alignment, and failure modes
can be evaluated *before* they ship. This repository holds the marketing site and
the persona **dimension schema** that defines the space those agents are sampled from.

## Live pages

| Page | File | What it is |
|------|------|------------|
| Landing | [`index.html`](index.html) | Hero with the 8.3-billion-behavior headline and a live agent-field simulation (canvas), telemetry strip, and eval methodology. |
| Dimension Explorer | [`explorer.html`](explorer.html) | Browse the flat persona schema: filter by category, search, expand value pools, and sample a full synthetic persona. |

No build step — open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Persona dimension schema

[`dimensions.json`](dimensions.json) is the **source of truth**.
[`dimensions.js`](dimensions.js) is an identical browser-loadable mirror
(`window.MATRAIX_DIMENSIONS = …`) so the explorer works without a server.

The schema is a **flat, unified set**: every sampled persona is assigned exactly
**one value per dimension**. The `category` field is for UI grouping/filtering
only — it does not nest the schema.

Current shape: **47 dimensions · 312 values · ~1.57 × 10³⁷ reachable personas**.
The 8.3B headline is the corpus of behaviors already simulated within that space;
`targetDimensions` is set to `1000` as the schema's growth target.

### Dimension entry

```json
{
  "id": "primary_language",
  "label": "Primary language",
  "category": "Linguistic",
  "description": "First / dominant language.",
  "values": ["English", "Mandarin", "Spanish", "Hindi", "Arabic", "..."]
}
```

### Categories

| Category | Covers |
|----------|--------|
| **Demographic** | age, region, gender, urbanicity, socioeconomic band |
| **Linguistic** | primary language, English proficiency, multilingualism, register |
| **Domain** | field, subject specialty, stance toward the field |
| **Academic** | highest education, field, institution tier, research output |
| **Professional** | seniority, company size, role function, experience, LinkedIn activity |
| **Life Experience** | life stage, major life events, cultural background, tech savviness |
| **Psychographic** | traits, risk tolerance, decision style, values, politics, religiosity, neurotype, learning style, media diet, economic motivation |
| **Interaction** | intent, query complexity, expertise gap, tone, trust, safety sensitivity, time pressure, device, modality, accessibility |

## Sampling a persona

The explorer's **Sample persona** action draws one value per dimension, renders a
readable LinkedIn-style summary, and offers the result as JSON:

```json
{
  "age_bracket": "35–44",
  "region": "East Asia",
  "primary_language": "Mandarin",
  "domain": "Healthcare & Medicine",
  "seniority": "Senior",
  "intent": "Verify a claim"
  // … one value for every dimension
}
```

## Files

```
index.html        Landing page markup
styles.css        Shared simulation-console styling (CSS variables, base look)
script.js         Background agent simulation, count-up, telemetry, behavior grid
explorer.html     Dimension explorer markup
explorer.css      Explorer-specific styling
explorer.js       Schema loading, filtering, search, persona sampler
dimensions.json   Canonical flat dimension schema (source of truth)
dimensions.js     Browser-loadable mirror of dimensions.json
```
