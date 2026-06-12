"""matrAIx computer-using agent (CUA).

A persona-with-a-goal agent that drives a real browser through a web app
(default target: a locally-served HugClaim instance) using a DOM /
accessibility-tree hybrid observation and Claude for decisions.

Phases shipped here:
  P0 — browser.py: launch Chromium, extract the interactive-element list +
       annotated screenshot, drain console/network errors.
  P1 — agent.py:   observe -> decide (Claude tool call) -> act loop, with
       guardrails (stop-before-submit, synthetic data) and trajectory logging.

P2-P4 (per-step reward, end-of-run findings judge, and the case_study.html /
demo.html report wiring) are stubbed for follow-up.
"""

__version__ = "0.1.0"
