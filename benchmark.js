/* ============================================================
   matrAIx OS — evaluation portal
   - Hundreds of simulated agents evaluate the selected app
   - A few "in-focus" agents step through the flow slowly so you
     can actually follow a trajectory
   - Background agents complete continuously to drive the reports
   - Neural Eval Core brain pulses the region each behavior stresses
   ============================================================ */

(() => {
  const DIM = (window.MATRAIX_DIMENSIONS && window.MATRAIX_DIMENSIONS.dimensions) || [];
  const byId = Object.fromEntries(DIM.map(d => [d.id, d]));
  const fmt = new Intl.NumberFormat('en-US');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = s => document.querySelector(s);
  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  const pick = a => a[(Math.random() * a.length) | 0];
  const pad = (n, w) => String(n).padStart(w, '0');

  /* ---------- persona sampling (subset of the 1000-dim space) ---------- */
  const KEY = ['age_bracket', 'region', 'primary_language', 'english_proficiency', 'intent',
    'device_context', 'expertise_gap', 'safety_sensitivity', 'trust_level', 'query_complexity',
    'emotional_state', 'prior_context'];
  const PENALTY = {
    query_complexity:   { 'Adversarial': 0.40, 'Ambiguous / underspecified': 0.18, 'Open-ended creative': 0.09, 'Multi-step': 0.04 },
    safety_sensitivity: { 'Potentially harmful': 0.45, 'Dual-use': 0.28, 'High-stakes (medical/legal/financial)': 0.14, 'Sensitive personal': 0.06 },
    trust_level:        { 'Hostile': 0.24, 'Skeptical': 0.08 },
    english_proficiency:{ 'None': 0.26, 'Basic (A1–A2)': 0.12, 'Intermediate (B1–B2)': 0.04 },
    expertise_gap:      { 'Expert testing the system': 0.10, 'Teaching the model': 0.03 },
    emotional_state:    { 'Frustrated': 0.06, 'Anxious': 0.04, 'Urgent': 0.05 },
    device_context:     { 'Low-bandwidth': 0.10, 'Mobile, on-the-go': 0.05, 'Accessibility tool': 0.06 },
  };
  function samplePersona() {
    const p = {};
    KEY.forEach(k => { if (byId[k]) p[k] = pick(byId[k].values); });
    return p;
  }
  function personaPenalty(p) {
    const hits = [];
    for (const k in PENALTY) if (PENALTY[k][p[k]]) hits.push(PENALTY[k][p[k]]);
    if (!hits.length) return 0;
    const mx = Math.max(...hits);
    return mx + 0.18 * (hits.reduce((a, b) => a + b, 0) - mx);
  }
  const personaLabel = p => `${p.age_bracket} · ${p.region} · ${p.primary_language} · ${p.intent}`;
  function regionFor(p) {
    if (PENALTY.safety_sensitivity[p.safety_sensitivity]) return 'Safety';
    if (PENALTY.query_complexity[p.query_complexity]) return 'Reasoning';
    if (p.intent === 'Decide' || p.intent === 'Get task done') return 'Planning';
    if (PENALTY.english_proficiency[p.english_proficiency]) return 'Language';
    if (p.prior_context === 'Long ongoing project' || p.prior_context === 'Returning user') return 'Memory';
    return 'Perception';
  }
  const ACTIONS = ['scan UI', 'tap target', 'type input', 'wait for load', 'read prompt', 'retry', 'confirm', 'scroll', 'select option', 'submit'];

  /* ---------- targets (apps/websites under evaluation) ---------- */
  const TARGETS = [
    { id: 'checkout', url: 'shopify-checkout.myshopify.com', label: 'Checkout flow',
      steps: ['load cart', 'tap “Checkout”', 'enter shipping', 'apply discount code', 'enter payment', 'confirm order'],
      report: { a: '3-step checkout', b: '1-page express', winner: 'B', lift: '+14.2%', metric: 'task completion', agents: 48000,
        segments: [['New users', 71, 88], ['Returning', 84, 90], ['Mobile · low-bw', 52, 79], ['Non-native English', 63, 81], ['Neurodivergent', 58, 77]],
        findings: [['high', 'Coupon field traps 23% of mobile agents in a focus loop.'], ['med', 'Shipping step lacks a progress indicator — 12% abandon.'], ['low', 'Autofill mismatches non-Latin postal formats.']] } },
    { id: 'onboarding', url: 'app.analytics.io/onboarding', label: 'SaaS onboarding',
      steps: ['sign up', 'verify email', 'connect data source', 'create first chart', 'invite teammate'],
      report: { a: 'Guided tour', b: 'Empty-state + checklist', winner: 'B', lift: '+9.6%', metric: 'day-1 activation', agents: 31500,
        segments: [['First-time admins', 66, 78], ['Technical', 81, 80], ['Non-technical', 54, 71], ['Time-pressured', 49, 68]],
        findings: [['high', '41% of power users skip the tour and never return.'], ['med', 'Checklist drives 2.3× more next-day returns.'], ['med', 'Undefined jargon blocks non-technical agents at step 2.']] } },
    { id: 'signup', url: 'neobank.app/signup', label: 'Fintech signup',
      steps: ['enter phone', 'OTP verify', 'KYC photo', 'set passkey', 'fund account'],
      report: { a: 'Email + password', b: 'Passkey-first', winner: 'B', lift: '+11.0%', metric: 'signup completion', agents: 22800,
        segments: [['Digital natives', 86, 95], ['Age 55+', 70, 61], ['Accessibility · visual', 64, 77], ['Reluctant', 58, 55]],
        findings: [['high', 'Passkey prompt confuses 39% of 55+ agents — net negative.'], ['low', '2.1× faster for digital-native agents.'], ['med', 'Recommend segment-gating passkey vs email fallback.']] } },
    { id: 'assistant', url: 'help.acme.com/assistant', label: 'AI support assistant',
      steps: ['open chat', 'describe issue', 'follow suggested steps', 'confirm resolved'],
      report: { a: 'Freeform chat', b: 'Guided + freeform', winner: 'B', lift: '+18.0%', metric: 'issue resolution', agents: 40100,
        segments: [['Troubleshooting', 72, 88], ['Billing', 69, 85], ['How-to', 78, 86], ['Red-team', 41, 63]],
        findings: [['high', 'Prompt-injection succeeds in 9% of adversarial sessions.'], ['med', 'Hallucinated steps in 14% of troubleshooting flows.'], ['low', 'Guided entry cuts time-to-resolution by 31%.']] } },
    { id: 'search', url: 'store.acme.com/search', label: 'Search & discovery',
      steps: ['enter query', 'scan results', 'refine filter', 'open product', 'add to cart'],
      report: { a: 'Keyword search', b: 'Semantic + filters', winner: 'B', lift: '+12.4%', metric: 'find-rate', agents: 27300,
        segments: [['Broad queries', 64, 83], ['Long-tail', 47, 74], ['Misspelled', 39, 71], ['Non-native English', 55, 76]],
        findings: [['high', '31% zero-result rate on long-tail queries in Variant A.'], ['med', 'Filters ignored by 58% of mobile agents.'], ['low', 'Semantic match recovers 4 of 5 misspellings.']] } },
  ];

  /* ============================================================
     NEURAL EVAL CORE — skill flow chart
     Each scored behavior flows through the skill it stressed.
     Same public interface as before: { pulse(region, verdict) }.
     ============================================================ */
  const Brain = (() => {
    const wrap = $('#flowNodes');
    // Logical cognitive pipeline order, top → bottom.
    const FLOW = ['Perception', 'Language', 'Memory', 'Reasoning', 'Planning', 'Safety'];
    const DESC = {
      Perception: 'reads the screen',
      Language:   'understands the ask',
      Memory:     'recalls the context',
      Reasoning:  'works out the answer',
      Planning:   'sequences the steps',
      Safety:     'stays within bounds',
    };
    const node = {};
    FLOW.forEach(r => {
      const el = document.createElement('div');
      el.className = 'fnode'; el.dataset.r = r;
      el.innerHTML =
        '<div class="fn-top"><span class="fn-name">' + r + '</span>' +
        '<span class="fn-n"><b>0</b> scored</span></div>' +
        '<div class="fn-sub">' + DESC[r] + '</div>' +
        '<i class="fn-bar"><b></b></i>';
      wrap.appendChild(el);
      node[r] = { el, bar: el.querySelector('.fn-bar b'), n: el.querySelector('.fn-n b'), total: 0, pass: 0, t: null };
    });

    function pulse(region, verdict) {
      const nd = node[region] || node.Reasoning;
      if (!nd) return;
      nd.total++; if (verdict === 'pass') nd.pass++;
      nd.n.textContent = nd.total > 999 ? (nd.total / 1000).toFixed(1) + 'k' : nd.total;
      nd.bar.style.width = Math.round(nd.pass / nd.total * 100) + '%';
      nd.el.classList.remove('watch', 'fail');
      if (verdict === 'fail') nd.el.classList.add('fail');
      else if (verdict === 'watch') nd.el.classList.add('watch');
      nd.el.classList.add('hot');
      clearTimeout(nd.t);
      nd.t = setTimeout(() => nd.el.classList.remove('hot'), 520);
    }

    return { pulse };
  })();

  /* ============================================================
     SIMULATION
     ============================================================ */
  let target = TARGETS[0];
  let running = true;
  let nextId = 1021;
  let activeCount = 600;
  let currentReport = 'ab';
  const store = [];
  const agg = { n: 0, pass: 0, rewardSum: 0, hist: new Array(10).fill(0), finishes: [] };
  const sparks = { ag: [], tp: [], rw: [], ps: [] };

  const popEl = $('#pop'), focusListEl = $('#focusList'), conFeed = $('#conFeed'), intelBody = $('#intelBody'), explainEl = $('#explain');

  /* ---- population grid (visual swarm) ---- */
  const POP_N = 168;
  const popCells = [];
  for (let i = 0; i < POP_N; i++) { const c = document.createElement('i'); popEl.appendChild(c); popCells.push(c); }
  const POP_STATES = ['spawn', 'sim', 'sim', 'sim', 'pass', 'pass', 'fail', ''];
  function popTick() {
    if (!running) return;
    const flips = 10 + ((Math.random() * 14) | 0);
    for (let k = 0; k < flips; k++) popCells[(Math.random() * POP_N) | 0].className = POP_STATES[(Math.random() * POP_STATES.length) | 0];
  }

  /* ---- behaviour factory + finalize ---- */
  const MICRO = ['scans the page', 're-reads the prompt', 'scrolls to find it', 'hesitates', 'checks the field', 'waits for load', 'compares options', 'taps the wrong button'];
  function newBehavior() {
    const persona = samplePersona(), pen = personaPenalty(persona), base = target.steps, rewards = [], traj = [];
    let n = 1;
    for (let i = 0; i < base.length; i++) {
      if (Math.random() < 0.45) {                                   // optional pre-action — varies per agent
        const rr = clamp01(0.9 - pen * 0.4 + (Math.random() - 0.5) * 0.12);
        traj.push({ step: n++, observation: base[i], action: pick(MICRO), reward: +rr.toFixed(3) }); rewards.push(rr);
      }
      const r = clamp01(0.88 - pen * (0.7 + Math.random() * 0.5) + (Math.random() - 0.5) * 0.14);
      traj.push({ step: n++, observation: base[i], action: pick(ACTIONS), reward: +r.toFixed(3) }); rewards.push(r);
      if (Math.random() < 0.12 + pen * 0.7) {                       // friction retry — more likely for hard personas
        const rr = clamp01(0.5 - pen * 0.5 + (Math.random() - 0.5) * 0.16);
        traj.push({ step: n++, observation: base[i] + ' — error, retry', action: 'retry', reward: +rr.toFixed(3) }); rewards.push(rr);
      }
    }
    const score = rewards.reduce((a, b) => a + b, 0) / rewards.length;
    const verdict = score >= 0.7 ? 'pass' : score >= 0.5 ? 'watch' : 'fail';
    return { persona, pen, region: regionFor(persona), rewards, traj, score, verdict };
  }
  function finalize(b, id) {
    agg.n++; agg.rewardSum += b.score; if (b.verdict === 'pass') agg.pass++;
    agg.hist[Math.min(9, (b.score * 10) | 0)]++;
    agg.finishes.push(performance.now());
    if (agg.finishes.length > 300) agg.finishes = agg.finishes.filter(t => performance.now() - t < 8000);
    Brain.pulse(b.region, b.verdict);
    store.push({ id: `mx-${pad(id, 6)}`, target: target.id, persona: b.persona, trajectory: b.traj, score: +b.score.toFixed(4), verdict: b.verdict });
    if (store.length > 5000) store.shift();
    if (currentReport === 'score' || currentReport === 'heat') renderReport();
  }

  /* ---- console ---- */
  function nowStr() { const d = new Date(); return `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`; }
  function conLine(html, cls) {
    const div = document.createElement('div');
    div.className = 'con-line' + (cls ? ' ' + cls : '');
    div.innerHTML = html;
    conFeed.prepend(div);
    while (conFeed.childElementCount > 90) conFeed.lastElementChild.remove();
  }

  /* ---- background swarm: many agents finishing continuously ---- */
  let bgScored = 0, lastBatch = 0;
  function bgTick() {
    if (!running) return;
    const batch = 2 + ((Math.random() * 4) | 0);
    for (let i = 0; i < batch; i++) finalize(newBehavior(), nextId++);
    bgScored += batch;
    const now = performance.now();
    if (now - lastBatch > 2200) {
      lastBatch = now;
      conLine(`<span class="t">[${nowStr()}]</span> <span class="sum">· background: ${bgScored} agents scored · ${(agg.n ? agg.pass / agg.n * 100 : 0).toFixed(0)}% pass cumulative</span>`, 'dim');
      bgScored = 0;
    }
  }

  /* ---- in-focus agents: slow, readable trajectories ---- */
  const FOCUS_N = 3;
  let focus = [];
  function spawnFocus() { return { id: nextId++, b: newBehavior(), step: 0 }; }
  function renderFocusCards() {
    focusListEl.innerHTML = focus.map(f => {
      if (!f) return '';
      const b = f.b, total = b.traj.length, done = f.step >= total;
      const cur = done ? null : b.traj[f.step];
      const lastR = f.step > 0 ? b.traj[f.step - 1].reward : null;
      const prog = Math.round(Math.min(f.step, total) / total * 100);
      return `<div class="focus">
        <div class="f-top"><span class="f-id"><span class="foc">◉</span>AGENT#${pad(f.id, 4)}</span><span class="f-step">step ${Math.min(f.step + (done ? 0 : 1), total)}/${total}</span></div>
        <div class="f-persona">${personaLabel(b.persona)}</div>
        <div class="f-now">▸ <b>${done ? 'complete' : cur.observation}</b>${cur ? ` · ${cur.action}` : ''}${lastR != null ? ` · r=${lastR.toFixed(2)}` : ''}</div>
        <div class="f-bar"><i style="width:${prog}%"></i></div>
      </div>`;
    }).join('');
  }
  function focusTick() {
    if (!running) return;
    for (let idx = 0; idx < FOCUS_N; idx++) {
      let f = focus[idx];
      if (!f) { focus[idx] = spawnFocus(); continue; }
      const b = f.b;
      if (f.step < b.traj.length) {
        const it = b.traj[f.step], r = it.reward;
        const rc = r >= 0.7 ? 'ok' : r >= 0.5 ? 'mid' : 'bad';
        conLine(`<span class="t">[${nowStr()}]</span> <span class="foc">◉</span> <span class="ag">AGENT#${pad(f.id, 4)}</span> <span class="st">step ${f.step + 1}/${b.traj.length}</span> <span class="obs">obs:"${it.observation}"</span> → <span class="act">${it.action}</span> <span class="rw ${rc}">r=${r.toFixed(2)}</span>`);
        f.step++;
      } else {
        finalize(b, f.id);
        const vc = b.verdict === 'pass' ? 'done' : b.verdict === 'watch' ? 'rw mid' : 'rw bad';
        conLine(`<span class="t">[${nowStr()}]</span> <span class="foc">◉</span> <span class="ag">AGENT#${pad(f.id, 4)}</span> <span class="${vc}">⮑ ${b.verdict.toUpperCase()}</span> score=${b.score.toFixed(2)} · ${b.traj.length} steps · region:${b.region}`);
        focus[idx] = spawnFocus();
      }
    }
    renderFocusCards();
  }

  /* ---- vitals + active count ---- */
  function setV(k, v) { const el = document.querySelector(`[data-v="${k}"]`); if (el) el.textContent = v; }
  function pushSpark(key, v, max) {
    const arr = sparks[key]; arr.push(v); if (arr.length > 18) arr.shift();
    const el = document.querySelector(`.spark[data-s="${key}"]`);
    if (el) el.innerHTML = arr.map(x => `<i style="height:${Math.max(8, Math.round(clamp01(x / max) * 100))}%"></i>`).join('');
  }
  function vitals() {
    activeCount = 590 + ((Math.random() * 60) | 0);
    const recent = agg.finishes.filter(t => performance.now() - t < 4000).length;
    const tp = recent / 4, rw = agg.n ? agg.rewardSum / agg.n : 0, ps = agg.n ? agg.pass / agg.n * 100 : 0;
    setV('ag', fmt.format(activeCount)); setV('tp', tp.toFixed(1) + '/s'); setV('rw', rw.toFixed(3)); setV('ps', ps.toFixed(1) + '%');
    pushSpark('ag', activeCount, 700); pushSpark('tp', tp + 0.3, 22); pushSpark('rw', rw, 1); pushSpark('ps', ps / 100, 1);
    $('#swarmCount').textContent = fmt.format(activeCount) + ' active';
  }

  function setExplain() {
    explainEl.innerHTML = `▸ <b>${fmt.format(activeCount)}</b> simulated users are completing <em>“${target.label}”</em> on <em>${target.url}</em> — each agent runs the flow step-by-step, and every finished run is scored and rolled into the reports →`;
  }

  function resetSession() {
    store.length = 0; agg.n = 0; agg.pass = 0; agg.rewardSum = 0; agg.hist.fill(0); agg.finishes = [];
    focus = Array.from({ length: FOCUS_N }, spawnFocus); renderFocusCards();
    conFeed.innerHTML = ''; bgScored = 0;
    activeCount = 590 + ((Math.random() * 60) | 0);
    setExplain(); renderReport();
    conLine(`<span class="t">▸ session reset · target = ${target.url}</span>`, 'dim');
  }

  /* ---- target select ---- */
  const sel = $('#target');
  sel.innerHTML = TARGETS.map(t => `<option value="${t.id}">${t.label} · ${t.url}</option>`).join('');
  sel.addEventListener('change', () => { target = TARGETS.find(t => t.id === sel.value) || TARGETS[0]; resetSession(); });

  /* ---- run / halt ---- */
  const runBtn = $('#run');
  runBtn.addEventListener('click', () => {
    running = !running;
    runBtn.textContent = running ? '■ HALT' : '▶ RUN';
    runBtn.classList.toggle('run', running);
    $('#scanTag').textContent = running ? '● LIVE' : '⏸ HALTED';
    $('#scanTag').style.color = running ? '' : 'var(--ink-dim)';
    document.querySelectorAll('.led').forEach(l => l.classList.toggle('on', running));
  });

  /* ============================================================
     REPORTS
     ============================================================ */
  $('#reportTabs').addEventListener('click', e => {
    const b = e.target.closest('.rtab'); if (!b) return;
    currentReport = b.dataset.r;
    [...e.currentTarget.children].forEach(c => c.classList.toggle('active', c === b));
    renderReport();
  });

  const HM_ABBR = {
    'Simple factual': 'Simple', 'Multi-step': 'Multi-step', 'Ambiguous / underspecified': 'Ambiguous',
    'Adversarial': 'Adversarial', 'Open-ended creative': 'Creative', 'Benign': 'Benign',
    'Sensitive personal': 'Sensitive', 'High-stakes (medical/legal/financial)': 'High-stakes',
    'Potentially harmful': 'Harmful', 'Dual-use': 'Dual-use',
  };
  const hmAbbr = v => HM_ABBR[v] || v;
  function hmColor(rate) {
    const stops = [[255, 92, 108], [255, 181, 71], [84, 246, 166]];
    const t = clamp01(rate) * 2, i = t < 1 ? 0 : 1, f = t < 1 ? t : t - 1;
    const a = stops[i], b = stops[i + 1], c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function renderHeat() {
    const QC = (byId['query_complexity'] || { values: [] }).values;
    const SS = (byId['safety_sensitivity'] || { values: [] }).values;
    const cell = {};
    for (const b of store) {
      const x = b.persona.query_complexity, y = b.persona.safety_sensitivity;
      if (!x || !y) continue;
      const k = x + '|' + y; (cell[k] = cell[k] || { n: 0, p: 0 });
      cell[k].n++; if (b.verdict === 'pass') cell[k].p++;
    }
    let h = `<div class="hm-cap">Pass rate by persona aspect · <b>${fmt.format(agg.n)}</b> behaviors this session</div>`;
    h += `<div class="hm-axis">Query complexity →</div>`;
    h += `<div class="hm-grid" style="grid-template-columns:74px repeat(${QC.length},1fr)">`;
    h += `<div class="hm-corner">Safety ↓</div>` + QC.map(x => `<div class="hm-xl">${hmAbbr(x)}</div>`).join('');
    for (const y of SS) {
      h += `<div class="hm-yl">${hmAbbr(y)}</div>`;
      for (const x of QC) {
        const c = cell[x + '|' + y];
        if (!c || !c.n) { h += `<div class="hm-cell empty" title="${x} × ${y} — no samples yet">·</div>`; continue; }
        const rate = c.p / c.n;
        h += `<div class="hm-cell" style="background:${hmColor(rate)}" title="${x} × ${y} — ${(rate * 100).toFixed(0)}% pass · n=${c.n}">${Math.round(rate * 100)}</div>`;
      }
    }
    h += `</div><div class="hm-legend"><span>0%</span><div class="hm-grad"></div><span>100%</span></div>`;
    return h;
  }

  function renderReport() {
    const r = target.report;
    const tgt = document.getElementById('rptTarget'); if (tgt) tgt.textContent = target.url;
    if (currentReport === 'ab') {
      intelBody.innerHTML = `<div class="verdict">
        <div class="target">${target.label}</div>
        <div class="vrow"><span class="badge">Variant ${r.winner} wins</span><span class="lift">${r.lift}</span></div>
        <div class="metric">${r.metric}, population-weighted · ${fmt.format(r.agents)} agents</div>
        <div class="variants"><b>A</b> ${r.a} &nbsp;·&nbsp; <b>B</b> ${r.b}</div></div>
        <p style="font-size:.76rem;color:var(--ink-dim);line-height:1.5">Live session: <b style="color:var(--phos)">${fmt.format(agg.n)}</b> behaviors scored, ${(agg.n ? agg.pass / agg.n * 100 : 0).toFixed(1)}% pass.</p>`;
    } else if (currentReport === 'seg') {
      const rows = r.segments.map(([s, a, b]) => {
        const d = b - a, cls = d > 0 ? 'up' : 'down';
        return `<tr><td class="seg">${s}</td><td>${a}%</td><td class="win">${b}%</td><td class="${cls}">${d > 0 ? '+' : ''}${d}</td></tr>`;
      }).join('');
      intelBody.innerHTML = `<table class="seg-table"><thead><tr><th>Persona segment</th><th>A</th><th>B</th><th>Δ</th></tr></thead><tbody>${rows}</tbody></table>`;
    } else if (currentReport === 'score') {
      const max = Math.max(1, ...agg.hist);
      const bars = agg.hist.map((v, i) => `<i class="${i < 5 ? 'lo' : i < 7 ? 'mid' : ''}" style="height:${v / max * 100}%"></i>`).join('');
      intelBody.innerHTML = `<div class="histo">${bars}</div><div class="histo-axis"><span>0.0</span><span>0.5</span><span>1.0</span></div>
        <p style="font-size:.76rem;color:var(--ink-dim);margin-top:10px">Live score distribution · ${fmt.format(agg.n)} behaviors this session.</p>`;
    } else if (currentReport === 'heat') {
      intelBody.innerHTML = renderHeat();
    } else {
      intelBody.innerHTML = `<ul class="findings">${r.findings.map(([sev, t]) => `<li class="finding"><span class="sev ${sev}">${sev.toUpperCase()}</span>${t}</li>`).join('')}</ul>`;
    }
  }

  /* ---- export ---- */
  $('#export').addEventListener('click', () => {
    if (!store.length) return;
    const blob = new Blob([store.map(b => JSON.stringify(b)).join('\n') + '\n'], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `matraix-trajectories-${target.id}-${store.length}.jsonl`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  /* ---- clock ---- */
  function clock() { $('#clock').textContent = nowStr(); }

  /* ============================================================
     INIT
     ============================================================ */
  focus = Array.from({ length: FOCUS_N }, spawnFocus);
  renderFocusCards();
  vitals(); setExplain(); renderReport(); clock();
  setInterval(popTick, 240);
  setInterval(bgTick, 300);
  setInterval(focusTick, 1300);   // slow & readable
  setInterval(vitals, 900);
  setInterval(clock, 1000);
})();
