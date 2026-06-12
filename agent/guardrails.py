"""Guardrails for running against a live target.

- stop-before-submit: reach the final submit/pay control and halt (terminal),
  so no real claim is ever filed.
- destructive-action blocklist: refuse irreversible clicks (delete, logout),
  non-terminal so the agent can try another path.
- synthetic profile: fake-but-consistent data the agent uses for any form.
"""

from __future__ import annotations

import re
from typing import Any

# Clicking an element whose label matches this ends the run as "reached_submit".
SUBMIT_RE = re.compile(
    r"(?i)\b(submit\s*(claim|now)?|file\s*claim|confirm\s*(and\s*)?(pay|submit)|"
    r"pay\s*now|place\s*order|checkout|purchase|finalize)\b"
)
# Irreversible side-actions — blocked but not terminal.
DESTRUCTIVE_RE = re.compile(r"(?i)\b(delete\s*account|close\s*account|log\s*out|sign\s*out)\b")

# Synthetic profile — no real PII. Used for any form the agent fills.
SYNTHETIC = {
    "full_name": "Alex Tester",
    "email": "alex.tester@example.com",
    "phone": "+1-555-0100",
    "policy_number": "TEST-POLICY-000",
    "vehicle": "2019 Toyota Corolla (TEST VIN 0000)",
    "date_of_birth": "1986-04-12",
    "address": "1 Test Street, Demo City, CA 90000",
    "incident": "Low-speed rear-end collision at a stop light; minor bumper damage; no injuries.",
}


def _name_for(action: dict[str, Any], snap: dict[str, Any]) -> str:
    if "id" not in action:
        return ""
    for e in snap.get("elements", []):
        if e["id"] == action["id"]:
            return e.get("name", "")
    return ""


def check(action: dict[str, Any], snap: dict[str, Any], submit_mode: str) -> tuple[bool, str, bool]:
    """Return (allowed, reason, terminal)."""
    if action.get("action") != "click":
        return True, "", False

    name = _name_for(action, snap)

    if DESTRUCTIVE_RE.search(name):
        return False, f"blocked destructive action: '{name}'", False

    if submit_mode == "stop_before_submit" and SUBMIT_RE.search(name):
        return False, f"reached_submit: stopped before clicking '{name}'", True

    return True, "", False
