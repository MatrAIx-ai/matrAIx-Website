/* ============================================================
   matrAIx.ai — Let's Play! (Try Me!)
   A fun, 8-question personality quiz. Each answer maps to a real
   matrAIx persona dimension value; after 8 answers we synthesize
   the player's persona, name their archetype, and predict how
   they'd actually behave inside a product flow.
   Self-contained — no schema file required.
   ============================================================ */

(() => {
  /* ---------- 8 fun questions; each option carries a real dimension value ---------- */
  const QUESTIONS = [
    {
      dim: 'dominant_trait', label: 'Dominant trait', emoji: '🎉',
      q: "It's Friday night. The realistic plan?",
      o: [
        { t: 'Out with the crowd — the more the merrier', v: 'High extraversion' },
        { t: "Something I've never tried before",         v: 'High openness' },
        { t: 'Cozy night with my favorite people',        v: 'High agreeableness' },
        { t: "Tidy my list so next week's smooth",        v: 'High conscientiousness' },
      ],
    },
    {
      dim: 'risk_tolerance', label: 'Risk tolerance', emoji: '🚪',
      q: "There's an unmarked door. You…",
      o: [
        { t: "I'm already on the other side", v: 'Risk-seeking' },
        { t: 'Open it — curiosity wins',      v: 'Risk-tolerant' },
        { t: 'Knock and peek first',          v: 'Cautious' },
        { t: 'Hard pass, keep walking',       v: 'Risk-averse' },
      ],
    },
    {
      dim: 'decision_style', label: 'Decision style', emoji: '🤔',
      q: 'Big decision looming. Your move?',
      o: [
        { t: 'Spreadsheet, pros & cons, all of it', v: 'Analytical' },
        { t: 'My gut already knows',                v: 'Intuitive' },
        { t: 'Poll the group chat',                 v: 'Consensus-driven' },
        { t: 'Sleep on it, decide later',           v: 'Deliberative' },
      ],
    },
    {
      dim: 'values_priority', label: 'Core value', emoji: '🌅',
      q: 'What actually gets you out of bed?',
      o: [
        { t: 'Winning. Leveling up.',          v: 'Achievement' },
        { t: 'Freedom to do it my way',        v: 'Autonomy' },
        { t: 'My people',                      v: 'Community' },
        { t: "Whatever's new and exciting",    v: 'Novelty' },
      ],
    },
    {
      dim: 'tone_expected', label: 'Preferred tone', emoji: '💬',
      q: 'Your ideal AI talks to you like…',
      o: [
        { t: 'Just give me the answer', v: 'Concise' },
        { t: 'A supportive friend',     v: 'Warm / empathetic' },
        { t: 'A witty sidekick',        v: 'Playful' },
        { t: 'A no-nonsense coach',     v: 'Blunt' },
      ],
    },
    {
      dim: 'learning_style', label: 'Learning style', emoji: '🛠️',
      q: 'New gadget arrives. First thing?',
      o: [
        { t: 'Press every button',            v: 'Kinesthetic' },
        { t: 'Watch a quick video',           v: 'Visual' },
        { t: 'Read the manual (yes, really)', v: 'Reading / writing' },
        { t: 'Ask someone to walk me through it', v: 'Auditory' },
      ],
    },
    {
      dim: 'media_diet', label: 'Media diet', emoji: '📱',
      q: 'Your most-used app is basically…',
      o: [
        { t: 'The endless scroll',        v: 'Social-media-heavy' },
        { t: 'Videos, all day',           v: 'Video-first' },
        { t: 'Articles, books, podcasts', v: 'Long-form' },
        { t: 'I barely touch my phone',   v: 'Minimal' },
      ],
    },
    {
      dim: 'economic_motivation', label: 'Spending posture', emoji: '🛒',
      q: 'You want something. How do you buy?',
      o: [
        { t: 'Hunt down the best deal',          v: 'Cost-sensitive' },
        { t: 'Find the worth-it sweet spot',     v: 'Value-driven' },
        { t: 'Buy the best once, no regrets',    v: 'Premium-seeking' },
        { t: 'Just grab it, who cares',          v: 'Indifferent' },
      ],
    },
  ];

  /* ---------- archetype + flavor maps ---------- */
  const TRAIT_ADJ = {
    'High openness': 'Curious', 'High conscientiousness': 'Methodical',
    'High extraversion': 'Magnetic', 'High agreeableness': 'Warmhearted',
    'High neuroticism': 'Intense', 'Balanced': 'Grounded',
  };
  const VALUE_NOUN = {
    'Achievement': ['Achiever', '🏆'], 'Autonomy': ['Maverick', '🦅'],
    'Community': ['Connector', '🤝'], 'Novelty': ['Explorer', '🚀'],
    'Security': ['Guardian', '🛡️'], 'Tradition': ['Keeper', '🏛️'],
  };
  const RISK_PHRASE = {
    'Risk-seeking': 'dives in headfirst', 'Risk-tolerant': 'happily takes the leap',
    'Cautious': 'looks before leaping', 'Risk-averse': 'keeps both feet on solid ground',
  };
  const DECISION_PHRASE = {
    'Analytical': 'weighs the evidence', 'Intuitive': 'trusts the gut',
    'Consensus-driven': 'reads the room', 'Deliberative': 'takes time to decide',
  };
  const LEARN_PHRASE = {
    'Kinesthetic': 'by doing', 'Visual': 'by watching',
    'Reading / writing': 'by reading', 'Auditory': 'by listening',
  };
  const TONE_PHRASE = {
    'Concise': 'short and straight', 'Warm / empathetic': 'warm and supportive',
    'Playful': 'witty and playful', 'Blunt': 'blunt and direct',
  };

  /* ---------- behavior prediction (the matrAIx tie-in) ---------- */
  const DECISION_BEHAVIOR = {
    'Analytical': 'read every label and compare before you click',
    'Intuitive': 'commit to the first option that feels right',
    'Consensus-driven': 'hunt for reviews and social proof before committing',
    'Deliberative': 'park the cart and come back to it later',
  };
  const RISK_BEHAVIOR = {
    'Risk-seeking': 'jump on the new feature the moment it appears',
    'Risk-tolerant': 'try the new feature without much hesitation',
    'Cautious': 'stick to the familiar path until the new one proves itself',
    'Risk-averse': 'avoid anything unfamiliar mid-flow',
  };
  const ECON_BEHAVIOR = {
    'Cost-sensitive': 'bail at an unexpected fee and go find the coupon field',
    'Value-driven': 'pause to check it is genuinely worth it before paying',
    'Premium-seeking': 'pick the top tier without blinking',
    'Indifferent': 'breeze through checkout without reading the fine print',
  };

  /* ---------- agent-facing personalization rules (exported into Persona.md) ---------- */
  const TONE_RULE = {
    'Concise': 'Keep replies short and to the point.',
    'Warm / empathetic': 'Use a warm, supportive tone.',
    'Playful': 'Be witty and playful.',
    'Blunt': 'Be blunt and direct — skip the hedging.',
  };
  const LEARN_RULE = {
    'Kinesthetic': 'Lead with hands-on steps I can try.',
    'Visual': 'Lead with diagrams, visuals, or short demos.',
    'Reading / writing': 'Give me written detail and references.',
    'Auditory': 'Explain it conversationally, like a walkthrough.',
  };
  const DECISION_RULE = {
    'Analytical': 'When I decide, give me the data and trade-offs.',
    'Intuitive': 'When I decide, give me one clear recommendation.',
    'Consensus-driven': 'When I decide, show me what others chose.',
    'Deliberative': "When I decide, don't rush me — let me revisit.",
  };
  const RISK_RULE = {
    'Risk-seeking': 'Surface new and experimental options early.',
    'Risk-tolerant': 'Offer new options, with a quick risk note.',
    'Cautious': 'Flag risks and prefer proven paths.',
    'Risk-averse': 'Stick to safe, well-established options.',
  };
  const ECON_RULE = {
    'Cost-sensitive': 'Always highlight price and ways to save.',
    'Value-driven': 'Justify why something is worth it.',
    'Premium-seeking': 'Lead with the best option, not the cheapest.',
    'Indifferent': 'Keep purchase steps minimal.',
  };

  /* ---------- helpers ---------- */
  const stripTags = s => s.replace(/<[^>]+>/g, '');
  const pad6 = n => String(n).padStart(6, '0');
  function hashId(persona) {                       // deterministic 6-digit id from the answers
    const s = Object.keys(persona).sort().map(k => persona[k]).join('|');
    let h = 0; for (let i = 0; i < s.length; i += 1) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return 'mx-' + pad6(h % 1000000);
  }
  function today() { return new Date().toISOString().slice(0, 10); }

  function buildPersonaMd(p, title, emoji, summaryText, predictionText, rules, mxid) {
    const dims = Object.keys(p).map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(p[k])}`).join(',\n');
    return [
      '---',
      `name: ${title}`,
      `id: ${mxid}`,
      'source: matrAIx (matraix.ai)',
      `generated: ${today()}`,
      '---',
      '',
      `# Persona — ${title} ${emoji}`,
      '',
      '## Summary',
      summaryText,
      '',
      '## Predicted behavior',
      predictionText,
      '',
      '## Personalization rules (for your agent)',
      rules.map(r => `- ${r}`).join('\n'),
      '',
      '## matrAIx dimensions',
      '```json',
      '{',
      dims,
      '}',
      '```',
      '',
    ].join('\n');
  }

  function downloadMd(md) {
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Persona.md';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function countUp(el, to, ms) {
    const start = performance.now();
    (function step(now) {
      const t = Math.min(1, (now - start) / ms);
      el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3))).toLocaleString();
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }

  /* ---------- DOM ---------- */
  const quiz = document.getElementById('quiz');
  const statusEl = document.getElementById('status');
  const resultEl = document.getElementById('result');

  function renderQuiz() {
    quiz.innerHTML = QUESTIONS.map((item, i) => `
      <div class="play-q">
        <div class="q-head"><span class="q-emoji">${item.emoji}</span>
          <span class="q-n">Q${i + 1}</span> ${item.q}</div>
        <div class="q-opts">
          ${item.o.map((opt, j) => `
            <label class="q-opt">
              <input type="radio" name="q${i}" value="${j}">
              <span>${opt.t}</span>
            </label>`).join('')}
        </div>
      </div>`).join('');
    statusEl.textContent = '';
    resultEl.hidden = true;
    resultEl.innerHTML = '';
  }

  function getAnswers() {
    const out = [];
    for (let i = 0; i < QUESTIONS.length; i += 1) {
      const chosen = document.querySelector(`input[name="q${i}"]:checked`);
      if (!chosen) return null;
      out.push(Number(chosen.value));
    }
    return out;
  }

  function reveal() {
    const ans = getAnswers();
    if (!ans) {
      const done = QUESTIONS.filter((_, i) => document.querySelector(`input[name="q${i}"]:checked`)).length;
      statusEl.textContent = `Answer all ${QUESTIONS.length} — ${done}/${QUESTIONS.length} so far.`;
      return;
    }

    // build the persona from chosen dimension values
    const persona = {};
    QUESTIONS.forEach((item, i) => { persona[item.dim] = item.o[ans[i]].v; });

    const adj = TRAIT_ADJ[persona.dominant_trait] || 'Singular';
    const [noun, emoji] = VALUE_NOUN[persona.values_priority] || ['Original', '✨'];
    const title = `The ${adj} ${noun}`;
    const mxid = hashId(persona);

    const summaryHtml =
      `You ${RISK_PHRASE[persona.risk_tolerance]} and ${DECISION_PHRASE[persona.decision_style]}. ` +
      `Driven by <b>${persona.values_priority.toLowerCase()}</b>, you learn best ${LEARN_PHRASE[persona.learning_style]}, ` +
      `live on <b>${persona.media_diet.toLowerCase()}</b> media, and like your answers ${TONE_PHRASE[persona.tone_expected]}.`;

    const predictionHtml =
      `Dropped into a checkout or onboarding flow, matrAIx would expect you to ` +
      `${DECISION_BEHAVIOR[persona.decision_style]}, ${RISK_BEHAVIOR[persona.risk_tolerance]}, ` +
      `and — as a <b>${persona.economic_motivation.toLowerCase()}</b> shopper — ${ECON_BEHAVIOR[persona.economic_motivation]}.`;

    const rules = [
      TONE_RULE[persona.tone_expected],
      LEARN_RULE[persona.learning_style],
      DECISION_RULE[persona.decision_style],
      RISK_RULE[persona.risk_tolerance],
      ECON_RULE[persona.economic_motivation],
    ].filter(Boolean);

    const md = buildPersonaMd(persona, title, emoji,
      stripTags(summaryHtml), stripTags(predictionHtml), rules, mxid);

    const chips = QUESTIONS.map(item => `
      <div class="trait">
        <span class="trait-k">${item.label}</span>
        <span class="trait-v">${persona[item.dim]}</span>
      </div>`).join('');

    resultEl.innerHTML = `
      <div class="pv-eyebrow"><span class="dot live"></span> YOUR PERSONA</div>
      <div class="pv-arch"><span class="pv-emoji">${emoji}</span>${title}</div>

      <div class="pv-card">
        <div class="pv-card-top">
          <span class="pv-card-tag"><span class="dot live"></span> PREDICTED PERSONA</span>
          <span class="pv-card-id">${mxid}</span>
        </div>
        <p class="pv-summary">${summaryHtml}</p>
        <div class="pv-traits">${chips}</div>
        <div class="pv-card-foot">
          <button id="dlBtn" type="button" class="btn btn-solid">⤓ Download Persona.md</button>
          <span class="pv-card-hint">drop it into your agent's context to personalize it</span>
        </div>
      </div>

      <div class="pv-predict">
        <div class="pv-predict-h">▸ How matrAIx would predict your behavior</div>
        <p>${predictionHtml}</p>
      </div>

      <div class="pv-share" id="shareBox">
        <div class="pv-share-q">Willing to share your persona so matrAIx can use it in future agent simulations?</div>
        <div class="pv-share-actions">
          <button id="shareYes" type="button" class="btn btn-solid">Yes, use my persona 🚀</button>
          <button id="shareNo" type="button" class="btn btn-ghost">No thanks</button>
        </div>
        <div id="shareOut" class="pv-share-out" hidden></div>
      </div>

      <p class="pv-note">Everything here runs in your browser — your persona isn't sent anywhere unless you choose to share it.</p>

      <div class="pv-actions">
        <button id="againBtn" type="button" class="btn btn-ghost">↻ Play again</button>
        <a class="btn btn-ghost" href="access.html">Become a contributor <span>→</span></a>
      </div>`;

    resultEl.hidden = false;
    document.getElementById('dlBtn').addEventListener('click', () => downloadMd(md));
    document.getElementById('againBtn').addEventListener('click', start);

    const shareOut = document.getElementById('shareOut');
    const shareYes = document.getElementById('shareYes');
    const shareNo = document.getElementById('shareNo');
    shareYes.addEventListener('click', () => {
      const n = 4800 + (parseInt(mxid.slice(3), 10) % 9000);   // a fun, deterministic count
      shareYes.disabled = true; shareNo.disabled = true;
      shareOut.hidden = false;
      shareOut.innerHTML =
        `<div class="pv-share-ok">✓ You're in — matrAIx is spinning up <b><span id="twinN">0</span></b> simulated twins of <b>${title}</b>…</div>
         <div class="pv-twins"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
         <div class="pv-share-fine">Demo only — nothing was actually stored.</div>`;
      countUp(document.getElementById('twinN'), n, 1300);
    });
    shareNo.addEventListener('click', () => {
      shareYes.disabled = true; shareNo.disabled = true;
      shareOut.hidden = false;
      shareOut.innerHTML = `<div class="pv-share-ok no">🔒 No problem — your persona stays on your device.</div>`;
    });

    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function start() {
    renderQuiz();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.getElementById('submitBtn').addEventListener('click', reveal);
  document.getElementById('resetBtn').addEventListener('click', start);

  renderQuiz();
})();
