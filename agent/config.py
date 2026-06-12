"""Run configuration for the matrAIx CUA."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

# matrAIx.ai/ — used to locate dimensions.json and default output dir.
REPO_ROOT = Path(__file__).resolve().parents[1]
AGENT_DIR = Path(__file__).resolve().parent


@dataclass
class Config:
    # --- target ---
    target_url: str = "http://127.0.0.1:8000/"
    goal: str = "File an auto-insurance claim for a rear-end collision."
    same_origin_only: bool = True

    # --- loop ---
    max_steps: int = 25
    no_progress_limit: int = 5          # abort after N steps with no URL/DOM change
    min_action_delay_ms: int = 800      # human-like throttle between actions

    # --- safety (prod-grade defaults) ---
    # "stop_before_submit": reach the final submit/pay button and halt (no real
    # claim is filed). "submit": actually click it — only with explicit intent.
    submit_mode: str = "stop_before_submit"

    # --- models ---
    model_decide: str = "claude-sonnet-4-6"   # per-step decision loop (cheap, fast)
    model_judge: str = "claude-opus-4-8"       # P3+ end-of-run findings/judge

    # --- browser ---
    headless: bool = True
    viewport_w: int = 1280
    viewport_h: int = 800
    annotate: bool = True               # draw numbered set-of-marks boxes for the screenshot

    # --- persona ---
    persona_seed: int | None = None
    dimensions_path: Path = field(default_factory=lambda: REPO_ROOT / "dimensions.json")

    # --- output ---
    out_dir: Path = field(default_factory=lambda: AGENT_DIR / "runs")
