# matrAIx CUA — computer-using agent (P0 + P1)

A **persona-with-a-goal** agent that drives a real browser through the HugClaim
web app, observes via a **DOM / accessibility-tree hybrid**, and decides with
Claude. It produces a step-by-step trajectory + screenshots + a `run.json` in
the matrAIx report schema.

> **Target = the local HugClaim app.** `hugclaim.com` is served by the
> `HugInsure` FastAPI app, so we point at `http://127.0.0.1:8000/` by default.
> No real claim is filed: the default `submit_mode=stop_before_submit` halts at
> the final submit button, and all form data is synthetic.

## What's built

| Phase | Module | Does |
|------|--------|------|
| **P0** | `browser.py` | Launch Chromium, extract actionable elements (set-of-marks), annotated screenshot, drain console/network errors |
| **P1** | `agent.py` | observe → decide (Claude `browser_action` tool) → act loop, guardrails, trajectory + `run.json` logging |
| **P3** | `judge.py` | One Opus pass scores each step (per-step reward) and surfaces concrete, segment-aware UX/error findings → merged into `run.json` |
| **P4** | `report.py` | Publish a run into the site: copy `run.json` → `Assets/runs/<id>.json` and update `Assets/runs/index.json`; the report UI renders it |

The report UI consumes published runs:
- **`case_study.html?run=<id>`** — full trajectory + persona + eval findings (falls back to the hand-authored fixture when no `?run`).
- **`demo.html`** — "From the simulator" lists every published run, linking to its case-study view.

## Run it (on your own machine — not the shared box)

Playwright + Chromium is a large download and a long-running browser process,
so run this locally, not on a shared server.

```bash
# 1. install
python3 -m venv .venv && source .venv/bin/activate
pip install -r agent/requirements.txt
playwright install chromium
export ANTHROPIC_API_KEY=sk-ant-...

# 2. serve the HugClaim app locally (separate terminal)
cd ../HugInsure && ./run.sh           # → http://127.0.0.1:8000

# 3a. P0 — dump one observation of the landing page
python -m agent.browser --url http://127.0.0.1:8000/

# 3b. P1+P3 — run the loop, then judge it (per-step reward + findings)
python -m agent.run --url http://127.0.0.1:8000/ --no-headless

# 4. P4 — publish the run into the site, then open it in the report UI
python -m agent.report agent/runs/<run-id>
#   -> Assets/runs/<run-id>.json + manifest; view at case_study.html?run=<run-id>
```

Output lands in `agent/runs/<run-id>/`: `trajectory.jsonl`, `NN.png`
screenshots, and `run.json` (with `reward` per step + `findings` + `score`).
Publishing copies `run.json` into the committed `Assets/runs/` so GitHub Pages
serves it. Add `--no-judge` to skip the Opus judging pass.

## Key flags

- `--goal "..."` — the task (default: file an auto-insurance claim)
- `--submit-mode stop_before_submit | submit` — **keep the default** unless you
  intend real submissions
- `--persona-seed N` — reproducible persona
- `--no-headless` — watch the browser
- `--model claude-sonnet-4-6` — decision-loop model (Opus reserved for the P3 judge)

## Safety defaults

- `stop_before_submit`: reaches but never clicks final submit/pay (enforced in
  `guardrails.py`, independent of the prompt).
- Synthetic profile only (`guardrails.SYNTHETIC`) — no real PII.
- Same-origin only; human-like throttle; no-progress abort.

To later target production, pass `--url https://hugclaim.com/` — and only switch
to `--submit-mode submit` with explicit intent.
