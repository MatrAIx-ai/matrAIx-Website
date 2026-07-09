/* ============================================================
   matrAIx — landing page (dark / phosphor)
   1. Background agent-field simulation (canvas)
   2. Hero count-up to 8.3 (Billion)
   3. Live telemetry stream
   4. A/B report viewer
   5. SFT / RL training-data sample toggle
   ============================================================ */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 1. Agent-field simulation ---------- */
(() => {
  const canvas = document.getElementById('sim');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, agents = [];
  const COLORS = ['#54f6a6', '#54f6a6', '#54f6a6', '#ffb547', '#ff5c6c'];

  function spawn() {
    return {
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      s: Math.random() * 2 + 1.2, c: COLORS[(Math.random() * COLORS.length) | 0],
      t: Math.random() * 100,
    };
  }
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    const density = Math.min(200, Math.floor((w * h) / 9000));
    agents = Array.from({ length: density }, spawn);
  }
  function frame() {
    ctx.clearRect(0, 0, w, h);

    for (const a of agents) {
      a.x += a.vx; a.y += a.vy; a.t += 0.05;
      if (a.x < 0) a.x = w; if (a.x > w) a.x = 0;
      if (a.y < 0) a.y = h; if (a.y > h) a.y = 0;
      const flick = 0.35 + 0.35 * Math.sin(a.t);
      ctx.globalAlpha = flick * 0.6;
      ctx.fillStyle = a.c;
      ctx.fillRect(a.x, a.y, a.s, a.s);
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  let raf = 0, animating = false;
  function start() { if (!animating && !reduceMotion) { animating = true; raf = requestAnimationFrame(frame); } }
  function stop() { animating = false; cancelAnimationFrame(raf); }
  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stop(); else start();
  });
  if (!reduceMotion) start();
  else { for (const a of agents) { ctx.globalAlpha = 0.5; ctx.fillStyle = a.c; ctx.fillRect(a.x, a.y, a.s, a.s); } }
})();

/* ---------- 2. Count-up to 8.3 ---------- */
(() => {
  const el = document.getElementById('count');
  if (!el) return;
  const target = 8300000000, nf = new Intl.NumberFormat('en-US');
  if (reduceMotion) { el.textContent = nf.format(target); return; }
  const dur = 1900; let start = null;
  const ease = t => 1 - Math.pow(1 - t, 3);
  function step(ts) {
    if (start === null) start = ts;
    const p = Math.min((ts - start) / dur, 1);
    el.textContent = nf.format(Math.floor(ease(p) * target));
    if (p < 1) requestAnimationFrame(step); else el.textContent = nf.format(target);
  }
  setTimeout(() => requestAnimationFrame(step), 400);
})();

/* ---------- 2b. Reports figures: count up as each scrolls into view ---------- */
(() => {
  const els = [].slice.call(document.querySelectorAll('.cu'));
  if (!els.length) return;
  const nf = new Intl.NumberFormat('en-US');
  const ease = t => 1 - Math.pow(1 - t, 3);
  const to = el => parseFloat(el.dataset.to) || 0;
  function animate(el) {
    const target = to(el), dur = 1400; let start = null;
    (function step(ts) {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      el.textContent = nf.format(Math.round(ease(p) * target));
      if (p < 1) requestAnimationFrame(step); else el.textContent = nf.format(target);
    })();
  }
  if (reduceMotion || !('IntersectionObserver' in window)) {
    els.forEach(el => { el.textContent = nf.format(to(el)); });
    return;
  }
  els.forEach(el => { el.textContent = '0'; });   // reset before reveal
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { animate(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.6 });
  els.forEach(el => io.observe(el));
})();

/* ---------- 3. Telemetry stream ---------- */
(() => {
  const cfg = {
    rate:   { base: 412880,  jitter: 18000, fmt: v => v.toLocaleString('en-US') },
    agents: { base: 2048512, jitter: 9000,  fmt: v => v.toLocaleString('en-US') },
    pass:   { base: 947,     jitter: 12,    fmt: v => (v / 10).toFixed(1) + '%' },
    worlds: { base: 16384,   jitter: 220,   fmt: v => v.toLocaleString('en-US') },
  };
  const nodes = document.querySelectorAll('[data-stream]');
  if (!nodes.length || reduceMotion) return;
  function update() {
    nodes.forEach(n => {
      const c = cfg[n.dataset.stream];
      const v = c.base + Math.round((Math.random() - 0.5) * c.jitter);
      n.textContent = c.fmt(v);
    });
    setTimeout(update, 1400);
  }
  setTimeout(update, 1600);
})();

/* ---------- 4. A/B report viewer ---------- */
(() => {
  const tabsEl = document.getElementById('reportTabs');
  const bodyEl = document.getElementById('reportBody');
  if (!tabsEl || !bodyEl) return;

  const REPORTS = [
    { tab: 'Checkout', target: 'Checkout flow · Shopify storefront', a: '3-step checkout', b: '1-page express',
      agents: 48000, metric: 'task completion', winner: 'B', lift: '+14.2%',
      segments: [
        { seg: 'New users', a: 71, b: 88 }, { seg: 'Returning users', a: 84, b: 90 },
        { seg: 'Mobile · low-bandwidth', a: 52, b: 79 }, { seg: 'Non-native English', a: 63, b: 81 },
        { seg: 'Cognitive / neurodivergent', a: 58, b: 77 },
      ],
      findings: [
        { sev: 'high', text: 'Variant A: coupon field traps 23% of mobile agents in a focus loop.' },
        { sev: 'med',  text: 'Variant A: shipping step lacks a progress indicator — 12% abandon here.' },
        { sev: 'low',  text: 'Variant B: address autofill mismatches non-Latin postal formats.' },
      ] },
    { tab: 'Onboarding', target: 'Onboarding wizard · B2B analytics app', a: 'Guided product tour', b: 'Empty-state + checklist',
      agents: 31500, metric: 'day-1 activation', winner: 'B', lift: '+9.6%',
      segments: [
        { seg: 'First-time admins', a: 66, b: 78 }, { seg: 'Technical users', a: 81, b: 80 },
        { seg: 'Non-technical', a: 54, b: 71 }, { seg: 'Time-pressured', a: 49, b: 68 },
      ],
      findings: [
        { sev: 'high', text: 'Variant A: 41% of power users skip the tour and never return to it.' },
        { sev: 'med',  text: 'Variant B: checklist drives 2.3× more next-day returns.' },
        { sev: 'med',  text: 'Both: undefined jargon blocks non-technical agents at step 2.' },
      ] },
    { tab: 'Mobile signup', target: 'Signup · fintech mobile app', a: 'Email + password', b: 'Passkey-first',
      agents: 22800, metric: 'signup completion', winner: 'B', lift: '+11.0%',
      segments: [
        { seg: 'Digital natives', a: 86, b: 95 }, { seg: 'Age 55+', a: 70, b: 61 },
        { seg: 'Accessibility · visual', a: 64, b: 77 }, { seg: 'Reluctant adopters', a: 58, b: 55 },
      ],
      findings: [
        { sev: 'high', text: 'Variant B: passkey prompt confuses 39% of 55+ agents — net negative for that segment.' },
        { sev: 'low',  text: 'Variant B: 2.1× faster completion for digital-native agents.' },
        { sev: 'med',  text: 'Recommend segment-gating: passkey-first for natives, email fallback for 55+.' },
      ] },
    { tab: 'AI assistant', target: 'In-product AI assistant · support chat', a: 'Freeform chat', b: 'Guided + freeform',
      agents: 40100, metric: 'issue resolution', winner: 'B', lift: '+18.0%',
      segments: [
        { seg: 'Troubleshooting', a: 72, b: 88 }, { seg: 'Billing questions', a: 69, b: 85 },
        { seg: 'How-to', a: 78, b: 86 }, { seg: 'Red-team (adversarial)', a: 41, b: 63 },
      ],
      findings: [
        { sev: 'high', text: 'Variant A: prompt-injection succeeds in 9% of adversarial agent sessions.' },
        { sev: 'med',  text: 'Variant A: hallucinated steps in 14% of troubleshooting flows.' },
        { sev: 'low',  text: 'Variant B: guided entry cuts mean time-to-resolution by 31%.' },
      ] },
  ];

  const fmt = new Intl.NumberFormat('en-US');

  function render(i) {
    const r = REPORTS[i];
    const winA = r.winner === 'A', winB = r.winner === 'B';
    const rows = r.segments.map(s => {
      const d = s.b - s.a;
      const dCls = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
      const sign = d > 0 ? '+' : '';
      return `<tr><td class="seg">${s.seg}</td><td class="${winA ? 'win' : ''}">${s.a}%</td>
        <td class="${winB ? 'win' : ''}">${s.b}%</td><td class="delta ${dCls}">${sign}${d} pts</td></tr>`;
    }).join('');
    const findings = r.findings.map(f =>
      `<li class="finding"><span class="sev ${f.sev}">${f.sev.toUpperCase()}</span>${f.text}</li>`).join('');
    bodyEl.innerHTML = `
      <div class="report-meta">
        <div><h3 class="report-target">${r.target}</h3>
        <p class="report-variants"><b>A</b> ${r.a} &nbsp;·&nbsp; <b>B</b> ${r.b}</p></div>
        <span class="report-agents">${fmt.format(r.agents)} agents</span>
      </div>
      <div class="verdict">
        <span class="verdict-badge">Variant ${r.winner} wins</span>
        <span class="verdict-lift">${r.lift}</span>
        <span class="verdict-metric">${r.metric}, population-weighted</span>
      </div>
      <table class="seg-table">
        <thead><tr><th>Persona segment</th><th>A</th><th>B</th><th>Δ</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="findings"><h4>What the agents found</h4><ul>${findings}</ul></div>`;
  }

  tabsEl.innerHTML = REPORTS.map((r, i) =>
    `<button class="rtab${i === 0 ? ' active' : ''}" role="tab" data-i="${i}">${r.tab}</button>`).join('');
  tabsEl.addEventListener('click', e => {
    const btn = e.target.closest('.rtab'); if (!btn) return;
    const i = +btn.dataset.i;
    [...tabsEl.children].forEach((b, k) => b.classList.toggle('active', k === i));
    bodyEl.classList.remove('flip'); void bodyEl.offsetWidth; bodyEl.classList.add('flip');
    render(i);
  });
  render(0);
})();

/* ---------- 5. SFT / RL sample toggle ---------- */
(() => {
  const toggle = document.getElementById('dataToggle');
  const out = document.getElementById('dataSample');
  if (!toggle || !out) return;

  const SAMPLES = {
    sft: {
      persona: { age_bracket: '55–64', primary_language: 'Spanish', english_proficiency: 'Basic (A1–A2)', intent: 'Get task done', domain: 'Finance & Economics' },
      task: 'Complete checkout on the express flow',
      trajectory: [
        { step: 1, observation: 'cart page', action: "tap 'Express checkout'" },
        { step: 2, observation: 'address autofill mismatch', action: 'correct postal code' },
        { step: 3, observation: 'payment sheet', action: 'confirm purchase' },
      ],
      outcome: 'success', score: 0.91,
      rubric: { task_completion: 1.0, friction: 0.2, clarity: 0.85 },
    },
    rl: {
      context: { persona: 'Non-native English · mobile · time-pressured', prompt: 'where do I put my discount code?' },
      chosen:   { response: "Tap 'Add code' just under your order summary, then enter it and press Apply.", reward: 0.93 },
      rejected: { response: 'Please consult the help documentation for details.', reward: 0.21 },
      margin: 0.72, source: 'matrAIx behavior #mx-018342',
    },
  };

  function highlight(obj) {
    return JSON.stringify(obj, null, 2)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/"([^"]+)":/g, '<span class="jk">"$1"</span>:')
      .replace(/: "([^"]*)"/g, ': <span class="js">"$1"</span>')
      .replace(/: (\d+\.?\d*)/g, ': <span class="jn">$1</span>');
  }
  function show(kind) { out.innerHTML = highlight(SAMPLES[kind]); }

  toggle.addEventListener('click', e => {
    const btn = e.target.closest('.dt-btn'); if (!btn) return;
    [...toggle.children].forEach(b => b.classList.toggle('active', b === btn));
    show(btn.dataset.kind);
  });
  show('sft');
})();

/* ---------- 6. Training-data flywheel: model improves each generation ---------- */
(() => {
  const barsEl = document.getElementById('qbars');
  const verEl = document.getElementById('fwVer'), qEl = document.getElementById('fwQ'), exEl = document.getElementById('fwEx');
  if (!barsEl || !verEl) return;
  const Q = [71, 79, 85, 89, 92, 94, 95];        // eval pass rate per model generation
  const EX = [0.4, 1.1, 2.3, 4.0, 6.2, 8.9, 12.1]; // training examples (millions), compounding
  const N = Q.length;
  const h = q => ((q - 60) / (96 - 60) * 100) + '%';
  const bars = [];
  for (let i = 0; i < N; i++) { const b = document.createElement('div'); b.className = 'qbar'; barsEl.appendChild(b); bars.push(b); }

  if (reduceMotion) {
    verEl.textContent = 'v' + N; qEl.textContent = Q[N - 1] + '%'; exEl.textContent = EX[N - 1] + 'M';
    bars.forEach((b, i) => { b.style.height = h(Q[i]); }); return;
  }
  let g = 0;
  function tick() {
    bars.forEach(b => b.classList.remove('on'));
    bars[g].style.height = h(Q[g]); bars[g].classList.add('on');
    verEl.textContent = 'v' + (g + 1);
    qEl.textContent = Q[g] + '%';
    exEl.textContent = EX[g].toFixed(1) + 'M';
    g++;
    if (g >= N) {
      setTimeout(() => { g = 0; bars.forEach(b => { b.style.height = '0%'; b.classList.remove('on'); }); verEl.textContent = 'v1'; qEl.textContent = Q[0] + '%'; exEl.textContent = '0'; }, 2400);
      setTimeout(tick, 3600);
    } else {
      setTimeout(tick, 1500);
    }
  }
  setTimeout(tick, 700);
})();

/* ---------- 7. Twin globes: 8.3B real people ≈ 8.3B matrAIx agents ---------- */
(() => {
  const globes = document.querySelectorAll('.globe');
  if (!globes.length) return;

  // shared point cloud (fibonacci sphere) — same population on both globes
  const N = 520, PTS = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), t = ga * i;
    PTS.push([Math.cos(t) * r, y, Math.sin(t) * r]);
  }

  function initGlobe(canvas) {
    const ctx = canvas.getContext('2d');
    const isAgent = canvas.dataset.kind === 'agent';
    const col = isAgent ? '84,246,166' : '138,208,255';
    let w, h, cx, cy, R, dpr, rot = Math.random() * 6, raf;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2; cy = h / 2; R = Math.min(w, h) * 0.42;
    }
    function step() {
      ctx.clearRect(0, 0, w, h);
      if (isAgent) {
        const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.15);
        g.addColorStop(0, 'rgba(84,246,166,0.12)'); g.addColorStop(1, 'rgba(84,246,166,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.15, 0, 6.283); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(' + col + ',0.16)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.stroke();
      const ca = Math.cos(rot), sa = Math.sin(rot), proj = [];
      for (let i = 0; i < N; i++) {
        const p = PTS[i], x = p[0] * ca - p[2] * sa, z = p[0] * sa + p[2] * ca;
        proj.push([cx + x * R, cy + p[1] * R, z]);
      }
      proj.sort((a, b) => a[2] - b[2]);
      for (let i = 0; i < proj.length; i++) {
        const q = proj[i], f = (q[2] + 1) / 2;
        ctx.fillStyle = 'rgba(' + col + ',' + (0.12 + f * 0.85).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(q[0], q[1], (0.7 + f * 1.5) * (isAgent ? 1.12 : 1), 0, 6.283); ctx.fill();
      }
    }
    function loop() { step(); rot += isAgent ? 0.0045 : 0.0038; raf = requestAnimationFrame(loop); }
    resize(); window.addEventListener('resize', resize);
    if (reduceMotion) step(); else loop();
  }
  globes.forEach(initGlobe);
})();

/* ---------- 8. Mobile menu toggle ---------- */
function initMenuToggle() {
  const toggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (!toggle || !navLinks) {
    console.warn('Menu toggle: elements not found');
    return;
  }

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    navLinks.classList.toggle('active');
  });

  navLinks.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (link) {
      navLinks.classList.remove('active');
    }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.nav')) {
      navLinks.classList.remove('active');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMenuToggle);
} else {
  initMenuToggle();
}

/* ---------- 9. Interactive population globe (hero) ---------- */
(() => {
  const canvas = document.getElementById('heroGlobe');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Accent color (phosphor blue) + warm highlight
  const BLUE = [74, 143, 194];
  const WARM = [217, 119, 6];

  // Build a fibonacci-sphere point cloud: each point ≈ a person/agent.
  const N = 560;
  const PTS = new Array(N);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = ga * i;
    PTS[i] = {
      x: Math.cos(t) * r, y: y, z: Math.sin(t) * r,
      warm: Math.random() < 0.06,           // a few "highlighted" agents
      tw: Math.random() * Math.PI * 2,        // twinkle phase
      tws: 0.6 + Math.random() * 1.6,         // twinkle speed
    };
  }

  // Free-floating particles drifting around the globe (cursor-reactive).
  const PARTICLES = [];
  const PN = 30;

  let w, h, cx, cy, R, dpr;
  let rot = Math.random() * 6;          // auto Y-rotation
  let tilt = 0;                          // current X-tilt
  let tiltTarget = 0;
  let spinTarget = 0;                    // extra spin from mouse X
  let spinVel = 0;
  // Mouse in canvas pixel space; -9999 = outside
  let mx = -9999, my = -9999, hasMouse = false;
  let raf = 0, time = 0, running = false;
  let inView = true, tabVisible = true;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = rect.width; h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = w / 2; cy = h / 2;
    R = Math.min(w, h) * 0.40;
    if (PARTICLES.length === 0) seedParticles();
  }

  function seedParticles() {
    for (let i = 0; i < PN; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = R * (1.05 + Math.random() * 0.55);
      PARTICLES.push({
        x: cx + Math.cos(a) * rad,
        y: cy + Math.sin(a) * rad,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        s: 0.6 + Math.random() * 1.4,
        warm: Math.random() < 0.15,
      });
    }
  }

  // --- Pointer interaction ---
  function pointerMove(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    mx = clientX - rect.left;
    my = clientY - rect.top;
    hasMouse = true;
    // Tilt/spin the globe toward the cursor for a parallax feel.
    tiltTarget = ((my - cy) / h) * 0.9;
    spinTarget = ((mx - cx) / w) * 0.9;
  }
  canvas.addEventListener('mousemove', e => pointerMove(e.clientX, e.clientY));
  canvas.addEventListener('mouseleave', () => {
    hasMouse = false; mx = my = -9999; tiltTarget = 0; spinTarget = 0;
  });
  canvas.addEventListener('touchmove', e => {
    if (e.touches[0]) pointerMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  canvas.addEventListener('touchend', () => {
    hasMouse = false; mx = my = -9999; tiltTarget = 0; spinTarget = 0;
  });

  function draw() {
    time += 0.016;
    ctx.clearRect(0, 0, w, h);

    // Ease camera toward targets.
    tilt += (tiltTarget - tilt) * 0.06;
    spinVel += (spinTarget * 0.02 - spinVel) * 0.05;
    rot += 0.0016 + spinVel;

    const ca = Math.cos(rot), sa = Math.sin(rot);
    const ct = Math.cos(tilt), st = Math.sin(tilt);

    // Faint wire halo.
    ctx.strokeStyle = `rgba(${BLUE.join(',')},0.10)`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.stroke();

    // Project points.
    const proj = new Array(N);
    for (let i = 0; i < N; i++) {
      const p = PTS[i];
      // rotate around Y
      let x = p.x * ca - p.z * sa;
      let z = p.x * sa + p.z * ca;
      let y = p.y;
      // tilt around X
      const y2 = y * ct - z * st;
      const z2 = y * st + z * ct;
      proj[i] = {
        sx: cx + x * R,
        sy: cy + y2 * R,
        z: z2,
        p,
      };
    }
    proj.sort((a, b) => a.z - b.z);

    // Constellation lines: connect near, front-facing points close on screen.
    ctx.lineWidth = 1;
    for (let i = 0; i < proj.length; i++) {
      const a = proj[i];
      if (a.z < 0.15) continue;
      for (let j = i + 1; j < Math.min(i + 7, proj.length); j++) {
        const b = proj[j];
        if (b.z < 0.15) continue;
        const dx = a.sx - b.sx, dy = a.sy - b.sy;
        const d2 = dx * dx + dy * dy;
        if (d2 < (R * 0.16) * (R * 0.16)) {
          const alpha = (1 - Math.sqrt(d2) / (R * 0.16)) * 0.16 * ((a.z + b.z) / 2);
          ctx.strokeStyle = `rgba(${BLUE.join(',')},${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }
      }
    }

    // Draw people points (back-to-front).
    for (let i = 0; i < proj.length; i++) {
      const q = proj[i];
      const p = q.p;
      const f = (q.z + 1) / 2;                 // depth 0..1
      const tw = 0.75 + 0.25 * Math.sin(time * p.tws + p.tw); // twinkle

      // Cursor proximity glow.
      let boost = 0;
      if (hasMouse) {
        const dx = q.sx - mx, dy = q.sy - my;
        const dd = Math.sqrt(dx * dx + dy * dy);
        const rad = R * 0.34;
        if (dd < rad) boost = (1 - dd / rad);
      }

      const col = p.warm ? WARM : BLUE;
      const size = (0.6 + f * 1.7) * tw + boost * 2.4;
      const alpha = Math.min(1, (0.10 + f * 0.8) * tw + boost * 0.6);

      // Cheap glow for cursor-highlighted points (a soft translucent halo
      // instead of the costly canvas shadowBlur).
      if (boost > 0.15) {
        ctx.fillStyle = `rgba(${col.join(',')},${(0.18 * boost).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(q.sx, q.sy, size + 3.5 * boost, 0, 6.283);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(${col.join(',')},${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(q.sx, q.sy, size, 0, 6.283);
      ctx.fill();
    }

    // Free-floating particles with cursor attraction/repulsion.
    for (let i = 0; i < PARTICLES.length; i++) {
      const pt = PARTICLES[i];
      if (hasMouse) {
        const dx = mx - pt.x, dy = my - pt.y;
        const dd = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dd < R * 0.9) {
          // gentle swirl: attract + tangential push
          const pull = (1 - dd / (R * 0.9)) * 0.06;
          pt.vx += (dx / dd) * pull - (dy / dd) * pull * 0.8;
          pt.vy += (dy / dd) * pull + (dx / dd) * pull * 0.8;
        }
      }
      pt.x += pt.vx; pt.y += pt.vy;
      pt.vx *= 0.96; pt.vy *= 0.96;

      // Drift back toward an orbit band around the globe.
      const ox = pt.x - cx, oy = pt.y - cy;
      const orad = Math.sqrt(ox * ox + oy * oy) || 1;
      const want = R * 1.28;
      const k = (want - orad) * 0.0009;
      pt.vx += (ox / orad) * k;
      pt.vy += (oy / orad) * k;

      const col = pt.warm ? WARM : BLUE;
      ctx.fillStyle = `rgba(${col.join(',')},0.55)`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.s, 0, 6.283);
      ctx.fill();
    }

    // Cursor focus ring.
    if (hasMouse) {
      ctx.strokeStyle = `rgba(${BLUE.join(',')},0.28)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(mx, my, R * 0.18, 0, 6.283); ctx.stroke();
    }
  }

  function loop() {
    if (!running) return;
    draw();
    raf = requestAnimationFrame(loop);
  }

  function updateActive() {
    const shouldRun = inView && tabVisible && !reduceMotion;
    if (shouldRun && !running) {
      running = true;
      raf = requestAnimationFrame(loop);
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }

  resize();
  window.addEventListener('resize', resize);

  // Pause the animation whenever the globe is scrolled out of view.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      updateActive();
    }, { threshold: 0.01 });
    io.observe(canvas);
  }
  // Pause when the tab is hidden.
  document.addEventListener('visibilitychange', () => {
    tabVisible = document.visibilityState !== 'hidden';
    updateActive();
  });

  if (reduceMotion) {
    draw();
  } else {
    updateActive();
  }

  // Animate the live count in the tag (only while visible).
  const countEl = document.getElementById('hgCount');
  if (countEl && !reduceMotion) {
    let base = 8300000000;
    setInterval(() => {
      if (!inView || !tabVisible) return;
      const jitter = Math.floor((Math.random() - 0.3) * 900);
      base += jitter;
      countEl.textContent = base.toLocaleString('en-US');
    }, 1200);
  }
})();

