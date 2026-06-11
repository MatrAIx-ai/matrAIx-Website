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
  let w, h, agents = [], sweep = 0;
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
    sweep += 1.4;
    if (sweep > w + 120) sweep = -120;
    const grad = ctx.createLinearGradient(sweep - 80, 0, sweep + 80, 0);
    grad.addColorStop(0, 'rgba(84,246,166,0)');
    grad.addColorStop(0.5, 'rgba(84,246,166,0.06)');
    grad.addColorStop(1, 'rgba(84,246,166,0)');
    ctx.fillStyle = grad; ctx.fillRect(sweep - 80, 0, 160, h);

    for (const a of agents) {
      a.x += a.vx; a.y += a.vy; a.t += 0.05;
      if (a.x < 0) a.x = w; if (a.x > w) a.x = 0;
      if (a.y < 0) a.y = h; if (a.y > h) a.y = 0;
      const near = Math.abs(a.x - sweep) < 70;
      const flick = 0.35 + 0.35 * Math.sin(a.t);
      ctx.globalAlpha = near ? Math.min(1, flick + 0.5) : flick * 0.6;
      ctx.fillStyle = a.c; ctx.shadowBlur = near ? 12 : 0; ctx.shadowColor = a.c;
      ctx.fillRect(a.x, a.y, a.s, a.s);
      if (near) {
        for (const b of agents) {
          if (b === a) continue;
          const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < 5200) {
            ctx.globalAlpha = (1 - d2 / 5200) * 0.18;
            ctx.strokeStyle = '#54f6a6'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    requestAnimationFrame(frame);
  }
  resize();
  window.addEventListener('resize', resize);
  if (!reduceMotion) frame();
  else { for (const a of agents) { ctx.globalAlpha = 0.5; ctx.fillStyle = a.c; ctx.fillRect(a.x, a.y, a.s, a.s); } }
})();

/* ---------- 2. Count-up to 8.3 ---------- */
(() => {
  const el = document.getElementById('count');
  if (!el) return;
  const target = 8.3;
  if (reduceMotion) { el.textContent = target.toFixed(1); return; }
  const dur = 1700; let start = null;
  const ease = t => 1 - Math.pow(1 - t, 3);
  function step(ts) {
    if (start === null) start = ts;
    const p = Math.min((ts - start) / dur, 1);
    el.textContent = (ease(p) * target).toFixed(1);
    if (p < 1) requestAnimationFrame(step); else el.textContent = target.toFixed(1);
  }
  setTimeout(() => requestAnimationFrame(step), 400);
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
