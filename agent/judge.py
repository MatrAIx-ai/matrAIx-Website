"""P3 — end-of-run judge.

One Opus pass over the recorded trajectory that (a) scores each step's progress
toward the goal (per-step reward) and (b) surfaces concrete, segment-aware UX /
error findings. Forced to structured output via the `eval_report` tool.

Fails soft: on any API error it returns None and the run is still written
without rewards/findings.
"""

from __future__ import annotations

import anthropic

from .config import Config
from .persona import describe

EVAL_TOOL = {
    "name": "eval_report",
    "description": "Score each step and report the real UX/errors found in the run.",
    "input_schema": {
        "type": "object",
        "properties": {
            "score": {"type": "number", "description": "Overall trajectory score 0-1 (goal progress + experience quality)."},
            "summary": {"type": "string", "description": "One-sentence verdict on the run."},
            "rewards": {
                "type": "array",
                "description": "Exactly one entry per step.",
                "items": {
                    "type": "object",
                    "properties": {
                        "step": {"type": "integer"},
                        "reward": {"type": "number", "description": "0=stuck/error/regression, 1=clear progress."},
                        "why": {"type": "string"},
                    },
                    "required": ["step", "reward"],
                },
            },
            "findings": {
                "type": "array",
                "description": "Concrete errors / UX friction grounded in the trajectory. Note who is hurt and why.",
                "items": {
                    "type": "object",
                    "properties": {
                        "sev": {"type": "string", "enum": ["high", "med", "low"]},
                        "text": {"type": "string"},
                    },
                    "required": ["sev", "text"],
                },
            },
        },
        "required": ["score", "summary", "rewards", "findings"],
    },
}

SYSTEM = (
    "You are a meticulous UX & QA evaluator for agent simulations. Given a persona, a goal, "
    "and the recorded step-by-step trajectory of an agent attempting that goal on a web app, "
    "score each step's progress and surface the REAL errors and UX friction. Be concrete and "
    "segment-aware: say which kind of user is hurt and why. Only report findings that are "
    "grounded in the trajectory (console/network errors, stalls, retries, dead ends, confusing "
    "or unlabeled controls, blocked progress). Do not invent issues."
)


def _traj_text(steps: list[dict]) -> str:
    lines = []
    for s in steps:
        a = s.get("action", {}) or {}
        tgt = a.get("target") or a.get("text") or a.get("id")
        res = (s.get("result") or {}).get("status")
        line = (f'step {s["step"]} [{s.get("t")}] dwell={s.get("dwell_s")}s '
                f'{a.get("action")} {tgt!r} -> {res}; page: {s.get("observation")}')
        if s.get("thought"):
            line += f'; thought: {s["thought"]}'
        fr = s.get("friction")
        if fr:
            line += f'; FRICTION({fr.get("sev")}): {fr.get("text")}'
        lines.append(line)
    return "\n".join(lines)


def judge_run(cfg: Config, persona: dict, steps: list[dict], outcome: str) -> dict | None:
    if not steps:
        return None
    client = anthropic.Anthropic()
    user = (
        f"PERSONA: {describe(persona)}\n"
        f"GOAL: {cfg.goal}\n"
        f"FINAL OUTCOME: {outcome}\n\n"
        f"TRAJECTORY ({len(steps)} steps):\n{_traj_text(steps)}"
    )
    try:
        resp = client.messages.create(
            model=cfg.model_judge,
            max_tokens=1600,
            system=SYSTEM,
            tools=[EVAL_TOOL],
            tool_choice={"type": "tool", "name": "eval_report"},
            messages=[{"role": "user", "content": user}],
        )
    except Exception as exc:  # noqa: BLE001 — judging is best-effort
        print(f"[judge] skipped: {exc}")
        return None
    for b in resp.content:
        if b.type == "tool_use":
            return b.input
    return None
