/* matrAIx — landing: count the hero stat up to 8.3 (billion). */
(() => {
  const el = document.getElementById('count');
  if (!el) return;
  const target = 8.3;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = target.toFixed(1);
    return;
  }

  const dur = 1600;
  let start = null;
  const ease = t => 1 - Math.pow(1 - t, 3); // ease-out cubic

  function step(ts) {
    if (start === null) start = ts;
    const p = Math.min((ts - start) / dur, 1);
    el.textContent = (ease(p) * target).toFixed(1);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target.toFixed(1);
  }
  setTimeout(() => requestAnimationFrame(step), 300);
})();
