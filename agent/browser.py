"""P0 — Playwright browser wrapper: DOM/AX-tree hybrid observation.

Extracts the actionable-element list (set-of-marks: each element tagged with a
stable `data-cua-id`), captures an annotated screenshot, and drains console /
network errors collected since the previous snapshot.
"""

from __future__ import annotations

import base64
from typing import Any

from playwright.sync_api import sync_playwright

from .config import Config

# --- JS: collect visible, actionable elements and tag each with data-cua-id ---
EXTRACT_JS = r"""
() => {
  document.querySelectorAll('[data-cua-id]').forEach(e => e.removeAttribute('data-cua-id'));
  const sel = 'a[href], button, input:not([type=hidden]), select, textarea,' +
    '[role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox],' +
    '[role=radio], [onclick], [tabindex]:not([tabindex="-1"]), [contenteditable=true]';
  const out = []; let i = 0;
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) continue;
    if (el.disabled) continue;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue; // on-screen only
    const labelFor = (el.id ? (document.querySelector('label[for="' + CSS.escape(el.id) + '"]') || {}).innerText : '') || '';
    const name = (el.getAttribute('aria-label') || labelFor || el.innerText || el.value ||
      el.getAttribute('placeholder') || el.getAttribute('alt') || el.getAttribute('title') ||
      el.name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    el.setAttribute('data-cua-id', i);
    out.push({
      id: i, tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || '',
      role: el.getAttribute('role') || '', name,
      value: String(el.value || '').slice(0, 80),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    });
    i++;
  }
  return out;
}
"""

ANNOTATE_JS = r"""
() => {
  const c = document.createElement('div');
  c.id = '__cua_overlay';
  c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  document.querySelectorAll('[data-cua-id]').forEach(el => {
    const r = el.getBoundingClientRect();
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;left:' + r.x + 'px;top:' + r.y + 'px;width:' +
      r.width + 'px;height:' + r.height + 'px;outline:1px solid rgba(84,246,166,.7)';
    const tag = document.createElement('div');
    tag.textContent = el.getAttribute('data-cua-id');
    tag.style.cssText = 'position:absolute;left:' + r.x + 'px;top:' + Math.max(0, r.y - 14) +
      'px;background:#54f6a6;color:#04140c;font:700 11px monospace;padding:0 3px;border-radius:3px';
    c.appendChild(box); c.appendChild(tag);
  });
  document.body.appendChild(c);
}
"""

DEANNOTATE_JS = "() => { const o = document.getElementById('__cua_overlay'); if (o) o.remove(); }"


class Browser:
    """Thin sync-Playwright wrapper. Use as a context manager."""

    def __init__(self, cfg: Config):
        self.cfg = cfg
        self._pw = None
        self.browser = None
        self.context = None
        self.page = None
        self._console: list[str] = []
        self._netfail: list[dict] = []

    def __enter__(self) -> "Browser":
        self.start()
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def start(self) -> None:
        self._pw = sync_playwright().start()
        self.browser = self._pw.chromium.launch(headless=self.cfg.headless)
        self.context = self.browser.new_context(
            viewport={"width": self.cfg.viewport_w, "height": self.cfg.viewport_h},
        )
        self.page = self.context.new_page()
        self.page.on("console", self._on_console)
        self.page.on("requestfailed", self._on_requestfailed)
        self.page.on("response", self._on_response)

    def _on_console(self, msg) -> None:
        if msg.type == "error":
            self._console.append(msg.text[:300])

    def _on_requestfailed(self, req) -> None:
        self._netfail.append({"url": req.url[:200], "failure": (req.failure or "")[:120]})

    def _on_response(self, resp) -> None:
        if resp.status >= 400:
            self._netfail.append({"url": resp.url[:200], "status": resp.status})

    # --- navigation / actions ---
    def goto(self, url: str) -> None:
        self.page.goto(url, wait_until="domcontentloaded", timeout=20000)
        self.settle()

    def settle(self) -> None:
        try:
            self.page.wait_for_load_state("networkidle", timeout=5000)
        except Exception:
            pass

    def by_id(self, cua_id: int):
        return self.page.locator(f'[data-cua-id="{cua_id}"]').first

    # --- observation ---
    def snapshot(self, shot_path: str | None = None) -> dict[str, Any]:
        elements = self.page.evaluate(EXTRACT_JS)
        if self.cfg.annotate:
            self.page.evaluate(ANNOTATE_JS)
        png = self.page.screenshot(path=shot_path, full_page=False)
        if self.cfg.annotate:
            self.page.evaluate(DEANNOTATE_JS)
        return {
            "url": self.page.url,
            "title": self.page.title(),
            "elements": elements,
            "screenshot_b64": base64.b64encode(png).decode(),
            "screenshot_path": shot_path,
            "console_errors": self._drain(self._console),
            "failed_requests": self._drain(self._netfail),
        }

    @staticmethod
    def _drain(buf: list) -> list:
        out = buf[:]
        buf.clear()
        return out

    def close(self) -> None:
        try:
            if self.context:
                self.context.close()
            if self.browser:
                self.browser.close()
        finally:
            if self._pw:
                self._pw.stop()


# --- P0 standalone: dump one observation as JSON ---
if __name__ == "__main__":
    import argparse
    import json

    ap = argparse.ArgumentParser(description="P0: dump a single observation of a page.")
    ap.add_argument("--url", default=Config.target_url)
    ap.add_argument("--no-headless", action="store_true")
    args = ap.parse_args()

    cfg = Config(target_url=args.url, headless=not args.no_headless)
    with Browser(cfg) as br:
        br.goto(cfg.target_url)
        snap = br.snapshot()
    snap.pop("screenshot_b64", None)  # too large to print
    print(json.dumps(snap, indent=2)[:6000])
    print(f"\n[{len(snap['elements'])} actionable elements · "
          f"{len(snap['console_errors'])} console errors · "
          f"{len(snap['failed_requests'])} failed requests]")
