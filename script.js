/* ============================================================
   matrAIx.ai — interactive layers
   1. Background agent-field simulation (canvas)
   2. Hero count-up to 8.3B
   3. Live behavior grid
   4. Streaming telemetry numbers
   ============================================================ */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 1. Agent-field simulation ---------- */
(() => {
  const canvas = document.getElementById('sim');
  const ctx = canvas.getContext('2d');
  let w, h, agents = [], sweep = 0;
  const COLORS = ['#54f6a6', '#54f6a6', '#54f6a6', '#ffb547', '#ff5c6c'];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    const density = Math.min(220, Math.floor((w * h) / 9000));
    agents = Array.from({ length: density }, () => spawn());
  }

  function spawn() {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      s: Math.random() * 2 + 1.2,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      t: Math.random() * 100,           // flicker phase
    };
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);

    // evaluation sweep line — a vertical scan that brightens agents it passes
    sweep += 1.4;
    if (sweep > w + 120) sweep = -120;
    const grad = ctx.createLinearGradient(sweep - 80, 0, sweep + 80, 0);
    grad.addColorStop(0, 'rgba(84,246,166,0)');
    grad.addColorStop(0.5, 'rgba(84,246,166,0.06)');
    grad.addColorStop(1, 'rgba(84,246,166,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sweep - 80, 0, 160, h);

    for (const a of agents) {
      a.x += a.vx; a.y += a.vy; a.t += 0.05;
      if (a.x < 0) a.x = w; if (a.x > w) a.x = 0;
      if (a.y < 0) a.y = h; if (a.y > h) a.y = 0;

      const near = Math.abs(a.x - sweep) < 70;
      const flick = 0.35 + 0.35 * Math.sin(a.t);
      ctx.globalAlpha = near ? Math.min(1, flick + 0.5) : flick * 0.6;

      ctx.fillStyle = a.c;
      ctx.shadowBlur = near ? 12 : 0;
      ctx.shadowColor = a.c;
      ctx.fillRect(a.x, a.y, a.s, a.s);

      // faint connection lines to evaluated neighbours
      if (near) {
        for (const b of agents) {
          if (b === a) continue;
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 5200) {
            ctx.globalAlpha = (1 - d2 / 5200) * 0.18;
            ctx.strokeStyle = '#54f6a6';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  if (!reduceMotion) frame();
  else {
    // static single frame
    for (const a of agents) {
      ctx.globalAlpha = 0.5; ctx.fillStyle = a.c;
      ctx.fillRect(a.x, a.y, a.s, a.s);
    }
  }
})();

/* ---------- 2. Hero count-up to 8.3B ---------- */
(() => {
  const el = document.getElementById('count');
  const target = parseInt(el.dataset.target, 10);
  const fmt = new Intl.NumberFormat('en-US');

  if (reduceMotion) { el.textContent = fmt.format(target); return; }

  const dur = 2600;
  let start = null;
  // ease-out cubic
  const ease = t => 1 - Math.pow(1 - t, 3);

  function step(ts) {
    if (start === null) start = ts;
    const p = Math.min((ts - start) / dur, 1);
    const val = Math.floor(ease(p) * target);
    el.textContent = fmt.format(val);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = fmt.format(target);
  }
  // kick off slightly after load so it reads as a "boot" sequence
  setTimeout(() => requestAnimationFrame(step), 400);
})();

/* ---------- 3. Live behavior grid ---------- */
(() => {
  const grid = document.getElementById('behaviorGrid');
  if (!grid) return;
  const COUNT = 240;
  const cells = [];
  for (let i = 0; i < COUNT; i++) {
    const c = document.createElement('div');
    c.className = 'cell';
    grid.appendChild(c);
    cells.push(c);
  }

  if (reduceMotion) {
    // seed a calm static distribution
    cells.forEach((c, i) => {
      if (i % 9 === 0) c.classList.add('watch');
      else if (i % 17 === 0) c.classList.add('fail');
      else if (i % 3 === 0) c.classList.add('pass');
    });
    return;
  }

  const states = ['pass', 'watch', 'fail'];
  function tick() {
    const n = 4 + ((Math.random() * 6) | 0);
    for (let k = 0; k < n; k++) {
      const c = cells[(Math.random() * COUNT) | 0];
      c.classList.remove('pass', 'watch', 'fail');
      const r = Math.random();
      // weighted: mostly pass, some watch, few fail
      const s = r < 0.7 ? 'pass' : r < 0.92 ? 'watch' : 'fail';
      c.classList.add(s);
      // some cells fade back to sampling
      if (Math.random() < 0.4) {
        setTimeout(() => c.classList.remove(s), 900 + Math.random() * 1600);
      }
    }
    setTimeout(tick, 180);
  }
  tick();
})();

/* ---------- 4. Streaming telemetry ---------- */
(() => {
  const cfg = {
    rate:   { base: 412880,  jitter: 18000, fmt: v => v.toLocaleString('en-US') },
    agents: { base: 2048512, jitter: 9000,  fmt: v => v.toLocaleString('en-US') },
    pass:   { base: 947,     jitter: 12,    fmt: v => (v / 10).toFixed(1) + '%' },
    worlds: { base: 16384,   jitter: 220,   fmt: v => v.toLocaleString('en-US') },
  };
  const nodes = document.querySelectorAll('[data-stream]');
  if (reduceMotion) return;

  function update() {
    nodes.forEach(n => {
      const k = n.dataset.stream;
      const c = cfg[k];
      const v = c.base + Math.round((Math.random() - 0.5) * c.jitter);
      n.textContent = c.fmt(v);
    });
    setTimeout(update, 1400);
  }
  setTimeout(update, 1600);
})();
