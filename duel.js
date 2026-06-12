/* ============================================================
   matrAIx.ai — Alignment Duel
   Human vs. agent: matrAIx samples a synthetic persona from the
   1000-dimension space and "simulates" how it behaves. You predict
   the same behaviors. The agent predicts them from the persona
   profile. We score you, the agent, and your human↔agent alignment.

   Ground truth for each behavior is derived deterministically from
   the persona's dimension values (same vocabulary as the eval
   portal in benchmark.js). The matrAIx agent is a strong simulator,
   so it reads the persona correctly far more often than not — that
   gap is the product: behaviors you can simulate before you ship.
   ============================================================ */

(() => {
  const DIM = (window.MATRAIX_DIMENSIONS && window.MATRAIX_DIMENSIONS.dimensions) || [];
  const byId = Object.fromEntries(DIM.map(d => [d.id, d]));
  const pick = a => a[(Math.random() * a.length) | 0];
  const pad = (n, w) => String(n).padStart(w, '0');

  if (!DIM.length) {
    document.getElementById('quiz').innerHTML =
      '<p class="duel-empty">Could not load dimensions.js — open this page from the served site.</p>';
    return;
  }

  /* ---------- persona sampling (the behavioral key dimensions) ---------- */
  const KEY = ['age_bracket', 'region', 'primary_language', 'english_proficiency',
    'intent', 'query_complexity', 'safety_sensitivity', 'trust_level',
    'expertise_gap', 'emotional_state', 'device_context', 'prior_context'];

  function samplePersona() {
    const p = {};
    KEY.forEach(k => { if (byId[k]) p[k] = pick(byId[k].values); });
    return p;
  }

  /* ---------- behavioral rules: which dimension values bend behavior ---------- */
  const HARD = {
    query_complexity:   ['Adversarial', 'Ambiguous / underspecified', 'Open-ended creative', 'Multi-step'],
    safety_sensitivity: ['Potentially harmful', 'Dual-use', 'High-stakes (medical/legal/financial)', 'Sensitive personal'],
    trust:              ['Hostile', 'Skeptical'],
    lowEnglish:         ['None', 'Basic (A1–A2)', 'Intermediate (B1–B2)'],
    emotion:            ['Frustrated', 'Anxious', 'Urgent'],
    constrained:        ['Low-bandwidth', 'Mobile, on-the-go', 'Accessibility tool'],
  };
  const has = (arr, v) => arr.indexOf(v) !== -1;

  /* ---------- question bank — each maps to one displayed dimension ----------
     truth(p) returns the index of the behaviorally-correct option.
     skill is the agent's per-question accuracy (it is a strong simulator). */
  const QUESTIONS = [
    {
      dim: 'trust_level',
      q: 'A mid-flow modal pitches a premium upgrade. This user…',
      o: ['Reads it and considers accepting', 'Dismisses it instantly — distrusts the prompt'],
      truth: p => has(HARD.trust, p.trust_level) ? 1 : 0,
      skill: 0.90,
    },
    {
      dim: 'query_complexity',
      q: 'How does this user move through the core task flow?',
      o: ['Sticks to the intended happy path', 'Goes off-script — edge inputs, probing, ambiguity'],
      truth: p => has(HARD.query_complexity, p.query_complexity) ? 1 : 0,
      skill: 0.88,
    },
    {
      dim: 'safety_sensitivity',
      q: 'The request touches this area. The agent should…',
      o: ['Proceed normally — low risk', 'Engage extra guardrails / handle with care'],
      truth: p => has(HARD.safety_sensitivity, p.safety_sensitivity) ? 1 : 0,
      skill: 0.92,
    },
    {
      dim: 'english_proficiency',
      q: 'Facing dense English microcopy, this user…',
      o: ['Reads it fluently — no friction', 'May misread instructions — language friction'],
      truth: p => has(HARD.lowEnglish, p.english_proficiency) ? 1 : 0,
      skill: 0.91,
    },
    {
      dim: 'emotional_state',
      q: 'The page stalls for a few seconds. This user…',
      o: ['Waits it out calmly', 'Retries or abandons — low patience'],
      truth: p => has(HARD.emotion, p.emotional_state) ? 1 : 0,
      skill: 0.86,
    },
    {
      dim: 'device_context',
      q: "This user's environment is…",
      o: ['Desktop-class and stable', 'Constrained — mobile / low-bandwidth / assistive'],
      truth: p => has(HARD.constrained, p.device_context) ? 1 : 0,
      skill: 0.89,
    },
    {
      dim: 'expertise_gap',
      q: "This user's stance toward the system is…",
      o: ['A learner who needs guidance', 'An expert stress-testing it'],
      truth: p => /Expert/.test(p.expertise_gap) ? 1 : 0,
      skill: 0.87,
    },
    {
      dim: 'intent',
      q: 'What is this user ultimately here to do?',
      o: ['Browse / explore or seek support', 'Drive a concrete decision or task to done'],
      truth: p => (p.intent === 'Decide' || p.intent === 'Get task done') ? 1 : 0,
      skill: 0.85,
    },
  ];

  /* ---------- DOM ---------- */
  const quiz = document.getElementById('quiz');
  const statusEl = document.getElementById('status');
  const resultEl = document.getElementById('result');
  const nameEl = document.getElementById('personaName');
  const lineEl = document.getElementById('personaLine');
  const traitBox = document.getElementById('personaTraits');
  const idEl = document.getElementById('personaId');

  let persona = {};
  let agentAnswers = [];   // fixed for the round once sampled

  function renderPersona() {
    persona = samplePersona();
    // agent predicts truth, missing only on its per-question skill roll
    agentAnswers = QUESTIONS.map(item => {
      const t = item.truth(persona);
      return Math.random() < item.skill ? t : (1 - t);
    });

    idEl.textContent = 'mx-' + pad((Math.random() * 1e6) | 0, 6);
    nameEl.textContent = `${persona.age_bracket} · ${persona.region}`;
    lineEl.textContent =
      `Speaks ${persona.primary_language} (${persona.english_proficiency} English). ` +
      `Here to ${persona.intent.toLowerCase()} — ${persona.query_complexity.toLowerCase()} request, ` +
      `${persona.trust_level.toLowerCase()} trust, ${persona.emotional_state.toLowerCase()}. ` +
      `On ${persona.device_context.toLowerCase()}.`;

    traitBox.innerHTML = KEY.map(k => byId[k] ? `
      <div class="trait">
        <span class="trait-k">${byId[k].label}</span>
        <span class="trait-v">${persona[k]}</span>
      </div>` : '').join('');
  }

  function renderQuiz() {
    quiz.innerHTML = QUESTIONS.map((item, i) => `
      <div class="duel-q">
        <div class="q-head"><span class="q-n">Q${i + 1}</span> ${item.q}
          <span class="q-dim">▸ ${byId[item.dim] ? byId[item.dim].label : item.dim}</span></div>
        <div class="q-opts">
          <label class="q-opt"><input type="radio" name="q${i}" value="0"><span>${item.o[0]}</span></label>
          <label class="q-opt"><input type="radio" name="q${i}" value="1"><span>${item.o[1]}</span></label>
        </div>
      </div>`).join('');
    statusEl.textContent = '';
    resultEl.hidden = true;
    resultEl.innerHTML = '';
  }

  function getUserAnswers() {
    const out = [];
    for (let i = 0; i < QUESTIONS.length; i += 1) {
      const chosen = document.querySelector(`input[name="q${i}"]:checked`);
      if (!chosen) return null;
      out.push(Number(chosen.value));
    }
    return out;
  }

  function duel() {
    const user = getUserAnswers();
    if (!user) {
      statusEl.textContent = `Answer all ${QUESTIONS.length} predictions before submitting.`;
      return;
    }

    const N = QUESTIONS.length;
    let userScore = 0, agentScore = 0, alignment = 0;
    const rows = QUESTIONS.map((item, i) => {
      const t = item.truth(persona);
      const uOk = user[i] === t, aOk = agentAnswers[i] === t;
      if (uOk) userScore += 1;
      if (aOk) agentScore += 1;
      if (user[i] === agentAnswers[i]) alignment += 1;
      return `
        <div class="rv-row">
          <div class="rv-q"><b>Q${i + 1}</b> · ${persona[item.dim]}</div>
          <div class="rv-cells">
            <span class="rv-cell ${uOk ? 'ok' : 'no'}">YOU ${uOk ? '✓' : '✗'} <em>${item.o[user[i]]}</em></span>
            <span class="rv-cell ${aOk ? 'ok' : 'no'}">matrAIx ${aOk ? '✓' : '✗'} <em>${item.o[agentAnswers[i]]}</em></span>
          </div>
          <div class="rv-truth">↳ actual behavior: <b>${item.o[t]}</b></div>
        </div>`;
    }).join('');

    let verdict, vcls;
    if (agentScore > userScore) { verdict = 'matrAIx read the persona better'; vcls = 'lose'; }
    else if (userScore > agentScore) { verdict = 'You out-read the simulation'; vcls = 'win'; }
    else { verdict = 'Dead heat with the simulation'; vcls = 'tie'; }

    const alignPct = Math.round(alignment / N * 100);

    resultEl.innerHTML = `
      <div class="rv-headline ${vcls}">${verdict}</div>
      <div class="rv-board">
        <div class="rv-box"><span class="k">Your score</span><span class="v">${userScore}/${N}</span></div>
        <div class="rv-box"><span class="k">matrAIx agent</span><span class="v">${agentScore}/${N}</span></div>
        <div class="rv-box hi"><span class="k">Human ↔ agent alignment</span><span class="v">${alignment}/${N} · ${alignPct}%</span></div>
      </div>
      <p class="rv-note">Alignment is the headline metric: it's how often you and your simulated self chose the same behavior.
      The behaviors matrAIx called that you missed are exactly what it can surface across millions of personas — before you ship.</p>
      <div class="rv-detail">${rows}</div>`;
    resultEl.hidden = false;
    statusEl.textContent = '';
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function newRound() {
    renderPersona();
    renderQuiz();
  }

  document.getElementById('submitBtn').addEventListener('click', duel);
  document.getElementById('resetBtn').addEventListener('click', newRound);
  const topBtn = document.getElementById('newPersona');
  if (topBtn) topBtn.addEventListener('click', e => { e.preventDefault(); newRound(); });

  newRound();
})();
