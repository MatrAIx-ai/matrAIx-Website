"""Trajectory + run.json logger.

Writes, per run:
  runs/<id>/NN.png            annotated screenshot per step
  runs/<id>/trajectory.jsonl  one line per step
  runs/<id>/run.json          full run record in the matrAIx report schema

run.json matches what case_study.html / demo.html will load in P3-P4
(fields: id, target, goal, persona, outcome, score, trajectory, findings,
telemetry). reward/findings are left null/empty until the P3 judge lands.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from .config import Config
from .observe import page_summary


def _mmss(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 60:02d}:{s % 60:02d}"


class RunLogger:
    def __init__(self, cfg: Config, persona: dict[str, str]):
        self.cfg = cfg
        self.persona = persona
        ts = time.strftime("%Y%m%d-%H%M%S")
        self.run_id = f"mx-hugclaim-{ts}"
        self.dir = Path(cfg.out_dir) / self.run_id
        self.dir.mkdir(parents=True, exist_ok=True)
        self.t0 = time.time()
        self.steps: list[dict[str, Any]] = []
        self.console_total = 0
        self.fail_total = 0
        self._jsonl = (self.dir / "trajectory.jsonl").open("w", encoding="utf-8")

    def shot_path(self, step: int) -> str:
        return str(self.dir / f"{step:02d}.png")

    def log_step(self, step: int, snap: dict, action: dict, result: dict) -> None:
        now = time.time()
        dwell = round(now - (self.steps[-1]["_t"] if self.steps else self.t0), 2)
        self.console_total += len(snap.get("console_errors", []))
        self.fail_total += len(snap.get("failed_requests", []))
        friction = None
        errs = snap.get("console_errors") or []
        fails = snap.get("failed_requests") or []
        if result.get("status") == "error":
            friction = {"sev": "med", "text": f"action error: {result.get('error')}"}
        elif errs or fails:
            friction = {"sev": "low", "text": f"{len(errs)} console errors, {len(fails)} failed requests"}

        rec = {
            "step": step,
            "t": _mmss(now - self.t0),
            "dwell_s": dwell,
            "url": snap.get("url"),
            "observation": page_summary(snap),
            "thought": action.get("thought", ""),
            "action": {k: v for k, v in action.items() if k != "thought"},
            "result": result,
            "reward": None,         # filled by P3 judge
            "friction": friction,
            "screenshot": Path(snap.get("screenshot_path") or "").name or None,
            "_t": now,
        }
        self.steps.append(rec)
        public = {k: v for k, v in rec.items() if k != "_t"}
        self._jsonl.write(json.dumps(public) + "\n")
        self._jsonl.flush()

    def finalize(self, outcome: str, judge: dict | None = None) -> Path:
        self._jsonl.close()
        trajectory = [{k: v for k, v in s.items() if k != "_t"} for s in self.steps]
        score = None
        summary = None
        findings: list = []
        if judge:
            score = judge.get("score")
            summary = judge.get("summary")
            findings = judge.get("findings", [])
            rewards = {r.get("step"): r.get("reward") for r in judge.get("rewards", [])}
            for t in trajectory:
                if t["step"] in rewards:
                    t["reward"] = rewards[t["step"]]
        run = {
            "id": self.run_id,
            "target": self.cfg.target_url,
            "goal": self.cfg.goal,
            "submit_mode": self.cfg.submit_mode,
            "persona": self.persona,
            "outcome": outcome,
            "score": score,
            "summary": summary,
            "steps": len(self.steps),
            "trajectory": trajectory,
            "findings": findings,
            "telemetry": {
                "console_errors_total": self.console_total,
                "failed_requests_total": self.fail_total,
                "duration_s": round(time.time() - self.t0, 1),
            },
            "started": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(self.t0)),
        }
        path = self.dir / "run.json"
        path.write_text(json.dumps(run, indent=2), encoding="utf-8")
        return path
