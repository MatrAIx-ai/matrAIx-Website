"""Format a browser snapshot into the compact text menu the LLM reads."""

from __future__ import annotations

from typing import Any


def format_observation(snap: dict[str, Any]) -> str:
    lines = [
        f"URL: {snap['url']}",
        f"Title: {snap['title']}",
    ]
    errs = snap.get("console_errors") or []
    fails = snap.get("failed_requests") or []
    if errs:
        lines.append(f"Console errors ({len(errs)}): " + " | ".join(errs[:3]))
    if fails:
        summ = ", ".join(str(f.get("status", f.get("failure", "?"))) for f in fails[:3])
        lines.append(f"Failed requests ({len(fails)}): {summ}")

    lines.append("\nActionable elements (use the [id] in browser_action):")
    if not snap["elements"]:
        lines.append("  (none visible — try scrolling)")
    for e in snap["elements"]:
        kind = e["role"] or e["tag"]
        extra = []
        if e["type"]:
            extra.append(e["type"])
        if e["value"]:
            extra.append(f'value="{e["value"]}"')
        tail = f" ({', '.join(extra)})" if extra else ""
        name = e["name"] or "<no label>"
        lines.append(f'  [{e["id"]}] {kind}: "{name}"{tail}')
    return "\n".join(lines)


def obs_content(snap: dict[str, Any]) -> list[dict]:
    """Build an Anthropic user-turn content list: text menu + screenshot image."""
    return [
        {"type": "text", "text": format_observation(snap)},
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": snap["screenshot_b64"],
            },
        },
    ]


def page_summary(snap: dict[str, Any]) -> str:
    """Short text used in the trajectory log."""
    return f'{snap["title"]} — {len(snap["elements"])} elements @ {snap["url"]}'
