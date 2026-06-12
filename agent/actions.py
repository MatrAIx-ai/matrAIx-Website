"""The browser_action tool schema and its executor."""

from __future__ import annotations

import time
from typing import Any

from .browser import Browser
from .config import Config

# Anthropic tool definition — Claude must return exactly one of these per step.
ACTION_TOOL = {
    "name": "browser_action",
    "description": (
        "Perform ONE action on the current web page to make progress toward the goal. "
        "Reference elements by the [id] shown in the observation."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "thought": {
                "type": "string",
                "description": "Brief first-person reasoning as this persona (what you see, what you'll do).",
            },
            "action": {
                "type": "string",
                "enum": ["click", "type", "select", "scroll", "go_back", "wait", "note", "done"],
            },
            "id": {"type": "integer", "description": "Target element id (for click/type/select)."},
            "text": {"type": "string", "description": "Text to type (for type/note)."},
            "option": {"type": "string", "description": "Option label/value (for select)."},
            "direction": {"type": "string", "enum": ["up", "down"], "description": "Scroll direction."},
            "ms": {"type": "integer", "description": "Milliseconds to wait (for wait)."},
            "reason": {"type": "string", "description": "Why you're finishing (for done)."},
        },
        "required": ["thought", "action"],
    },
}


def execute(action: dict[str, Any], br: Browser, cfg: Config) -> dict[str, Any]:
    """Run one validated action against the page. Never raises."""
    a = action.get("action")
    page = br.page
    try:
        if a == "click":
            loc = br.by_id(action["id"])
            loc.scroll_into_view_if_needed(timeout=3000)
            loc.click(timeout=5000)
            br.settle()
            return {"status": "ok", "action": "click", "id": action.get("id")}

        if a == "type":
            loc = br.by_id(action["id"])
            loc.scroll_into_view_if_needed(timeout=3000)
            loc.click(timeout=5000)
            loc.fill(action.get("text", ""), timeout=5000)
            return {"status": "ok", "action": "type", "id": action.get("id")}

        if a == "select":
            loc = br.by_id(action["id"])
            opt = action.get("option", "")
            try:
                loc.select_option(label=opt, timeout=4000)
            except Exception:
                loc.select_option(value=opt, timeout=4000)
            return {"status": "ok", "action": "select", "id": action.get("id")}

        if a == "scroll":
            dy = 600 if action.get("direction", "down") == "down" else -600
            page.mouse.wheel(0, dy)
            time.sleep(0.3)
            return {"status": "ok", "action": "scroll"}

        if a == "go_back":
            page.go_back(timeout=8000)
            br.settle()
            return {"status": "ok", "action": "go_back"}

        if a == "wait":
            ms = min(int(action.get("ms", 1000)), 5000)
            page.wait_for_timeout(ms)
            return {"status": "ok", "action": "wait", "ms": ms}

        if a == "note":
            return {"status": "ok", "action": "note", "text": action.get("text", "")}

        if a == "done":
            return {"status": "done", "reason": action.get("reason", "")}

        return {"status": "error", "error": f"unknown action: {a}"}
    except Exception as exc:  # noqa: BLE001 — executor must never crash the loop
        return {"status": "error", "error": str(exc)[:300]}
