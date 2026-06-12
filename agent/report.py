"""P4 — publish a run into the matrAIx site so the report UI can render it.

Copies a run's run.json to <site>/Assets/runs/<id>.json and updates the
manifest <site>/Assets/runs/index.json. The site then serves it statically:
  - case_study.html?run=<id>   renders the full trajectory + findings
  - demo.html                  lists published runs from the manifest

Usage:
  python -m agent.report agent/runs/<run-id>        # publish into this repo
  python -m agent.report agent/runs/<run-id> --site /path/to/matrAIx.ai
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from .config import REPO_ROOT

PERSONA_KEYS = ["age_bracket", "primary_language", "device_context", "emotional_state"]


def _persona_summary(persona: dict) -> str:
    return " · ".join(str(persona[k]) for k in PERSONA_KEYS if persona.get(k))


def publish(run_path: str | Path, site_dir: str | Path = REPO_ROOT) -> Path:
    run_path = Path(run_path)
    if run_path.is_dir():
        run_path = run_path / "run.json"
    if not run_path.exists():
        raise FileNotFoundError(f"run.json not found: {run_path}")

    data = json.loads(run_path.read_text(encoding="utf-8"))
    runs_dir = Path(site_dir) / "Assets" / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)

    dest = runs_dir / f"{data['id']}.json"
    shutil.copyfile(run_path, dest)

    manifest = runs_dir / "index.json"
    items: list[dict] = []
    if manifest.exists():
        try:
            items = json.loads(manifest.read_text(encoding="utf-8")).get("runs", [])
        except Exception:
            items = []
    entry = {
        "id": data["id"],
        "target": data.get("target"),
        "goal": data.get("goal"),
        "outcome": data.get("outcome"),
        "score": data.get("score"),
        "steps": data.get("steps"),
        "started": data.get("started"),
        "persona": _persona_summary(data.get("persona", {})),
    }
    items = [x for x in items if x.get("id") != data["id"]]
    items.insert(0, entry)
    manifest.write_text(json.dumps({"runs": items}, indent=2), encoding="utf-8")

    print(f"[publish] {dest}\n[publish] manifest now lists {len(items)} run(s)")
    print(f"[publish] view: case_study.html?run={data['id']}")
    return dest


def main() -> None:
    ap = argparse.ArgumentParser(description="Publish a CUA run into the matrAIx site.")
    ap.add_argument("run", help="path to a run dir or its run.json")
    ap.add_argument("--site", default=str(REPO_ROOT), help="matrAIx site root (has Assets/)")
    args = ap.parse_args()
    publish(args.run, args.site)


if __name__ == "__main__":
    main()
