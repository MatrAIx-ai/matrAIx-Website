"""CLI entrypoint: python -m agent.run --url http://127.0.0.1:8000/"""

from __future__ import annotations

import argparse

from .agent import run
from .config import Config


def main() -> None:
    ap = argparse.ArgumentParser(description="matrAIx persona-with-a-goal CUA (P1).")
    ap.add_argument("--url", default=Config.target_url, help="target start URL")
    ap.add_argument("--goal", default=Config.goal)
    ap.add_argument("--max-steps", type=int, default=Config.max_steps)
    ap.add_argument("--submit-mode", choices=["stop_before_submit", "submit"],
                    default=Config.submit_mode)
    ap.add_argument("--persona-seed", type=int, default=None)
    ap.add_argument("--no-headless", action="store_true", help="show the browser window")
    ap.add_argument("--no-judge", action="store_true", help="skip the end-of-run judge")
    ap.add_argument("--model", default=Config.model_decide, help="decision-loop model id")
    args = ap.parse_args()

    cfg = Config(
        target_url=args.url,
        goal=args.goal,
        max_steps=args.max_steps,
        submit_mode=args.submit_mode,
        persona_seed=args.persona_seed,
        headless=not args.no_headless,
        judge=not args.no_judge,
        model_decide=args.model,
    )
    run(cfg)


if __name__ == "__main__":
    main()
