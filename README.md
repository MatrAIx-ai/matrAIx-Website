# MatrAIx

**Agent Simulation for Eval — 8.3-Billion-Behavior.**

MatrAIx spins up populations of autonomous agents, runs them across adversarial
worlds, and scores every decision — so capability, alignment, and failure modes
can be evaluated *before* they ship. This repository holds the marketing site and
the persona **dimension schema** that defines the space those agents are sampled from.

## Live pages

| Page | File | What it is |
|------|------|------------|
| Landing | [`index.html`](index.html) | Hero with the 8.3-billion-behavior headline, "Open-Source Community" badge, and a live agent-field simulation (canvas), telemetry strip, and eval methodology. |
| Blog | [`blog/`](blog/) | Blog index page with 3 research papers in a single-column layout. Gateway to research insights on persona grounding, evaluation frameworks, and agent simulation. |
| Persona Explorer | [`person.html`](person.html) | Browse the flat persona schema: filter by category, search, expand value pools, and sample a full synthetic persona. |
| DAG Studio | [`synthesis.html`](synthesis.html) | Verified client-side Persona Full DAG browser with hop-bounded inspection, reproducible pin/prior/edge/category recipes, Worker sampling, baseline comparisons, and selected-persona overlays. |
| Demo Portal (matrAIx OS) | [`demo.html`](demo.html) | A mission-control interface: a live "Neural Eval Core" brain visualization, an agent swarm simulating the selected app/website, streaming trajectory telemetry, switchable reports (A/B, segments, score distribution, heatmap, findings), and JSONL trajectory export. |
| Case Study | [`case_study.html`](case_study.html) | A recorded sample trajectory: a matrAIx computer-using agent (10-dimension persona) files an auto-insurance claim on hugclaim.com, with per-step screenshots, observations, actions, rewards, friction findings, and a JSONL export. |
| Let's Play! | [`play.html`](play.html) | A fun 8-question personality quiz. Each answer maps to a real persona dimension value (`dominant_trait`, `risk_tolerance`, `decision_style`, `values_priority`, `tone_expected`, `learning_style`, `media_diet`, `economic_motivation`); after answering, matrAIx synthesizes the player's **persona**, names their archetype, and **predicts how they'd behave** inside a product flow — the simulation-fidelity thesis, made playable. Self-contained (no schema file needed). |

No build step — open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

### Synthesis Studio data

The Studio's source, data, generator, golden, and immutable runtime contracts are
documented in [`synthesis/README.md`](synthesis/README.md). Its phase-2 data must
be regenerated with the content-addressed generator named by
`synthesis/data/manifest.v2.json`, never a mutable build entry point:

```bash
export NODE18=/absolute/path/to/node-v18.19.1
test "$("$NODE18" --version)" = "v18.19.1"
V2_GENERATOR=$("$NODE18" -e \
  "const m=require('./synthesis/data/manifest.v2.json');process.stdout.write(m.generator.path)")
"$NODE18" "$V2_GENERATOR" \
  --graph /path/to/pinned-MatrAIx/persona/synthesis/graph/full_dag.json \
  --source-commit 4dfa4e066b706c6a2d33a10fd41b976efd3f524e \
  --dimensions data/dimensions.json --out-dir synthesis/data --phase 2
```

Generate defaults to adjusted marginals only. Selecting **Compare with baseline**
opts into a second sample from the default, unadjusted sampler with the same seed
and sample count. When enabled, baseline semantics and output are unchanged: the
sample does not reuse adjusted gamma or recipe settings, and the site retains
only requested baseline marginals, not a second set of persona objects.

## Persona dimension schema

The canonical source of truth is
[`persona/schema/dimensions.json`](https://github.com/MatrAIx-ai/MatrAIx/blob/main/persona/schema/dimensions.json)
in the MatrAIx research repository. This website keeps a synchronized
[`dimensions.json`](data/dimensions.json) copy and an identical browser-loadable
[`dimensions.js`](js/dimensions.js) bundle (`window.MATRAIX_DIMENSIONS = …`).

The schema is a **flat, unified set**: every sampled persona is assigned exactly
**one value per dimension**. The `category` field is for UI grouping/filtering
only — it does not nest the schema.

Current synchronized shape: **1,290 dimensions · 6,347 values · ~1.24 × 10⁸⁸⁵
reachable combinations**, spanning 43 categories. The 8.3B headline refers to the
internal persona corpus produced across synthetic generation and human-evidence
extraction pipelines; it is not a direct public download. A curated 1M-persona
Hugging Face release is planned.

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

## Benchmark portal (matrAIx OS)

The [Demo Portal](demo.html) is a mission-control interface. Pick a **target**
(app/website), and an **agent swarm** of personas drawn from the dimension space runs its
flow step by step. Each step emits **trajectory telemetry** (`observation → action → reward`)
to the live console, the **Neural Eval Core** brain pulses the activated region, and the
verdict feeds the **reports** panel (A/B, segments, score distribution, findings).

Scores are **synthetic but structured**: a behavior's difficulty is driven mainly by its single
hardest persona aspect (e.g. `query_complexity = Adversarial`, `safety_sensitivity = Potentially
harmful`, `trust_level = Hostile`, `english_proficiency = None`).

**Export** writes one JSON object per line (JSONL) — a public, reproducible slice of trajectories:

```json
{"id":"mx-001042","target":"checkout","persona":{ "...key dimensions..." },
 "trajectory":[{"step":1,"observation":"load cart","action":"scan UI","reward":0.86}],
 "score":0.81,"verdict":"pass"}
```

> Scores are simulated for demonstration; no model is actually called.

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
index.html                      Landing page markup; public HTML routes remain at the repository root

css/                            Page and theme stylesheets
js/                             Browser runtime scripts
data/                           JSON schemas, dimensions, and metrics
Assets/icons/                   Favicons and installable-app icons
docs/                           Design, typography, and theme documentation
scripts/                        Build and generation utilities
archive/                        Non-served historical artifacts

blog/
├── index.html                  Blog index page (links to research papers)
├── position-colm.html          Research: AI Personas Need Receipts
├── application-colm.html       Research: A Dress Rehearsal for App Testing
└── env-colm.html               Research: What Happens When an AI Watches Itself Act?

persona.html                    Persona explorer markup
explorer.html                   Redirect stub -> persona.html
css/explorer.css                Persona-explorer styling
js/explorer.js                  Schema loading, filtering, search, persona sampler

demo.html                       Demo / benchmark console markup (runway hero + OS portal)
benchmark.html                  Redirect stub -> demo.html
css/benchmark.css               Benchmark-specific styling
js/benchmark.js                 Sampling, structured scoring, live stream, heatmap, JSONL export

deck.html                       (Local only — not tracked in git) Self-contained investor pitch deck (15 slides)

scripts/generate-dimensions.js  Legacy local schema-generation utility
data/dimensions.json            Synchronized copy of the canonical research schema
js/dimensions.js                Browser-loadable mirror of dimensions.json
CNAME                           Custom domain for GitHub Pages (matraix.ai)
```
