"""Sample a matrAIx persona (persona-with-a-goal).

Uses a curated subset of persona-facing dimensions that mirrors the HugClaim
case study. dimensions.json (1,000+ dims) can be wired in for richer sampling
in a later phase; the built-in lists keep P0/P1 self-contained.
"""

from __future__ import annotations

import random

DIMENSIONS: dict[str, list[str]] = {
    "age_bracket": ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
    "region": ["North America", "Europe", "Latin America", "South Asia", "East Asia"],
    "primary_language": ["English", "Spanish", "Mandarin", "Hindi", "Portuguese"],
    "english_proficiency": ["Native", "Advanced (C1-C2)", "Intermediate (B1-B2)", "Basic (A1-A2)"],
    "device_context": ["Desktop", "Mobile - on the go", "Mobile - low bandwidth", "Tablet"],
    "expertise": ["Novice", "Some experience", "Expert"],
    "trust_level": ["Trusting", "Verifying", "Skeptical"],
    "emotional_state": ["Calm", "Rushed", "Frustrated", "Anxious"],
    "tech_savviness": ["Early adopter", "Mainstream", "Cautious adopter", "Reluctant"],
}


def sample_persona(seed: int | None = None) -> dict[str, str]:
    rng = random.Random(seed)
    persona = {k: rng.choice(v) for k, v in DIMENSIONS.items()}
    persona["intent"] = "File a claim"
    return persona


def describe(persona: dict[str, str]) -> str:
    order = [
        "age_bracket", "region", "primary_language", "english_proficiency",
        "device_context", "expertise", "trust_level", "emotional_state", "tech_savviness",
    ]
    return "; ".join(f"{k.replace('_', ' ')}: {persona[k]}" for k in order if k in persona)
