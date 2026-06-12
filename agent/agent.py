"""P1 — the observe -> decide (Claude tool call) -> act loop."""

from __future__ import annotations

import time
from urllib.parse import urlparse

import anthropic

from . import guardrails
from .actions import ACTION_TOOL, execute
from .browser import Browser
from .config import Config
from .logger import RunLogger
from .observe import obs_content
from .persona import sample_persona
from .prompts import system_prompt


def _blocks_to_dict(content) -> list[dict]:
    """Serialize an assistant response's content blocks for message history."""
    out = []
    for b in content:
        if b.type == "text":
            out.append({"type": "text", "text": b.text})
        elif b.type == "tool_use":
            out.append({"type": "tool_use", "id": b.id, "name": b.name, "input": b.input})
    return out


def _find_tool_use(content):
    for b in content:
        if b.type == "tool_use":
            return b
    return None


def _prune_images(messages: list[dict]) -> None:
    """Keep the screenshot only on the most recent user turn to save tokens."""
    last_user = max((i for i, m in enumerate(messages) if m["role"] == "user"), default=-1)
    for i, m in enumerate(messages):
        if m["role"] != "user" or i == last_user or not isinstance(m["content"], list):
            continue
        m["content"] = [
            {"type": "text", "text": "[screenshot omitted]"} if blk.get("type") == "image" else blk
            for blk in m["content"]
        ]


def run(cfg: Config) -> str:
    persona = sample_persona(cfg.persona_seed)
    logger = RunLogger(cfg, persona)
    sys_prompt = system_prompt(persona, cfg.goal, cfg.submit_mode)
    client = anthropic.Anthropic()
    origin = urlparse(cfg.target_url).netloc

    outcome = "incomplete"
    last_url = None
    stuck = 0

    with Browser(cfg) as br:
        br.goto(cfg.target_url)
        snap = br.snapshot(logger.shot_path(0))
        user_content: list[dict] = obs_content(snap)
        messages: list[dict] = []

        for step in range(1, cfg.max_steps + 1):
            messages.append({"role": "user", "content": user_content})
            _prune_images(messages)

            resp = client.messages.create(
                model=cfg.model_decide,
                max_tokens=1024,
                system=sys_prompt,
                tools=[ACTION_TOOL],
                tool_choice={"type": "tool", "name": "browser_action"},
                messages=messages,
            )
            messages.append({"role": "assistant", "content": _blocks_to_dict(resp.content)})

            tu = _find_tool_use(resp.content)
            if tu is None:
                outcome = "no_action"
                break
            action = dict(tu.input)

            allowed, reason, terminal = guardrails.check(action, snap, cfg.submit_mode)
            if not allowed:
                result = {"status": "blocked", "reason": reason}
                logger.log_step(step, snap, action, result)
                if terminal:
                    outcome = "reached_submit"
                    break
                # let the agent try again
                user_content = [
                    {"type": "tool_result", "tool_use_id": tu.id, "content": reason},
                    *obs_content(snap),
                ]
                continue

            result = execute(action, br, cfg)
            logger.log_step(step, snap, action, result)

            if action.get("action") == "done":
                outcome = action.get("reason") or "done"
                break

            time.sleep(cfg.min_action_delay_ms / 1000)
            snap = br.snapshot(logger.shot_path(step))

            # no-progress detection
            if snap["url"] == last_url:
                stuck += 1
                if stuck >= cfg.no_progress_limit:
                    outcome = "stuck_no_progress"
                    break
            else:
                stuck = 0
                last_url = snap["url"]

            # same-origin guard
            if cfg.same_origin_only and urlparse(snap["url"]).netloc != origin:
                outcome = "left_origin"
                break

            user_content = [
                {"type": "tool_result", "tool_use_id": tu.id, "content": _result_text(result)},
                *obs_content(snap),
            ]

    path = logger.finalize(outcome)
    print(f"\n[done] outcome={outcome} · steps={len(logger.steps)} · run={path}")
    return outcome


def _result_text(result: dict) -> str:
    if result.get("status") == "ok":
        return f"ok: {result.get('action')}"
    if result.get("status") == "error":
        return f"error: {result.get('error')}"
    return str(result)
