/* ============================================================
   matrAIx.ai — Dimension Explorer logic
   Loads the flat persona dimension schema and drives:
     - summary stats (count, total values, reachable space)
     - category chips + search filtering
     - expandable dimension cards
     - persona sampling drawer (one value per dimension)
   ============================================================ */

(() => {
  const DATA = window.MATRAIX_DIMENSIONS;
  if (!DATA) {
    document.getElementById('grid').innerHTML =
      '<p class="ex-empty">Could not load dimensions.js</p>';
    return;
  }
  const dims = DATA.dimensions;
  const fmtInt = new Intl.NumberFormat('en-US');

  /* ---------- Stats ---------- */
  const totalValues = dims.reduce((s, d) => s + d.values.length, 0);
  // reachable space = product of value counts. With 1000+ dims this overflows
  // float range, so accumulate the base-10 logarithm and format from that.
  let log10space = 0;
  dims.forEach(d => { log10space += Math.log10(d.values.length); });

  function supScript(exp) {
    const map = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
    return String(exp).split('').map(c => map[c] || c).join('');
  }
  function sciFromLog(L) {
    const e = Math.floor(L);
    const m = Math.pow(10, L - e).toFixed(2);
    return `${m} × 10${supScript(e)}`;
  }

  const setStat = (k, v) => {
    const el = document.querySelector(`[data-stat="${k}"]`);
    if (el) el.textContent = v;
  };
  setStat('dims', dims.length);
  setStat('vals', fmtInt.format(totalValues));
  setStat('space', sciFromLog(log10space));
  setStat('target', fmtInt.format(DATA.targetDimensions));
  document.getElementById('verTag').textContent = 'v' + DATA.schemaVersion;
  document.getElementById('footMeta').textContent =
    `SCHEMA v${DATA.schemaVersion} · ${dims.length} DIMS · FLAT UNIFIED · © 2026`;

  /* ---------- Categories / chips ---------- */
  const cats = [...new Set(dims.map(d => d.category))];
  const counts = cats.reduce((m, c) => (m[c] = dims.filter(d => d.category === c).length, m), {});
  const chipBox = document.getElementById('chips');
  let activeCat = 'All';
  let query = '';

  function buildChips() {
    const all = ['All', ...cats];
    chipBox.innerHTML = all.map(c => {
      const n = c === 'All' ? dims.length : counts[c];
      return `<button class="chip${c === activeCat ? ' active' : ''}" data-cat="${c}" role="tab">
        ${c}<span class="chip-n">${n}</span></button>`;
    }).join('');
  }
  buildChips();
  chipBox.addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    activeCat = btn.dataset.cat;
    buildChips();
    render();
  });

  /* ---------- Dimension cards ---------- */
  const grid = document.getElementById('grid');
  const emptyMsg = document.getElementById('emptyMsg');

  // Extract dataset name from dimension ID
  function getSourceName(dimId) {
    const sources = {
      'nemotron_': 'Nemotron',
      'personahub_': 'PersonaHub',
      'oasis_': 'OASIS',
      'apple_': 'Apple PRIMEX',
      'pandora_': 'PANDORA',
      'synthetic_': 'Synthetic Chat',
      'personachat_': 'PersonaChat',
      'wildchat_': 'WildChat',
      'horizonbench_': 'HorizonBench'
    };
    for (const [prefix, name] of Object.entries(sources)) {
      if (dimId.toLowerCase().startsWith(prefix)) return name;
    }
    return null;
  }

  // Clean label by removing dataset prefix
  function getCleanLabel(label, dimId) {
    const prefixes = ['Nemotron_', 'PersonaHub_', 'OASIS_', 'ApplePRIMEX_', 'PANDORA_',
                     'SyntheticPersonaChat_', 'PersonaChat_', 'WildChat_', 'HorizonBench_'];
    for (const prefix of prefixes) {
      if (label.startsWith(prefix)) {
        return label.slice(prefix.length);
      }
    }
    return label;
  }

  function render() {
    const list = dims.filter(d => {
      const catOk = activeCat === 'All' || d.category === activeCat;
      const q = query.trim().toLowerCase();
      const qOk = !q ||
        d.label.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.values.some(v => v.toLowerCase().includes(q));
      return catOk && qOk;
    });

    emptyMsg.hidden = list.length > 0;
    grid.innerHTML = list.map((d, i) => {
      const source = getSourceName(d.id);
      const cleanLabel = getCleanLabel(d.label, d.id);
      return `
      <article class="dim-card" data-id="${d.id}" style="animation-delay:${Math.min(i * 20, 300)}ms">
        <div class="dim-top">
          <span class="dim-cat">${d.category}</span>
          <span class="dim-count">${d.values.length} values</span>
        </div>
        <h3 class="dim-label">${cleanLabel}</h3>
        <p class="dim-desc">${d.description}</p>
        ${source ? `<p class="dim-source">Source: ${source}</p>` : ''}
        <div class="dim-values">
          ${d.values.map(v => `<span class="val-chip">${v}</span>`).join('')}
        </div>
        <p class="dim-hint">▸ click to ${'expand'}</p>
      </article>
    `;
    }).join('');
  }

  grid.addEventListener('click', e => {
    const card = e.target.closest('.dim-card');
    if (!card) return;
    const open = card.classList.toggle('open');
    card.querySelector('.dim-hint').textContent = open ? '▾ click to collapse' : '▸ click to expand';
  });

  let searchTimer;
  document.getElementById('search').addEventListener('input', e => {
    query = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 120);   // debounce: 1000+ cards re-render
  });

  render();

  /* ---------- Persona sampler ---------- */
  const drawer = document.getElementById('drawer');
  const scrim = document.getElementById('scrim');
  const traitBox = document.getElementById('personaTraits');
  const nameEl = document.getElementById('personaName');
  const lineEl = document.getElementById('personaLine');
  let current = {};

  const pick = arr => arr[(Math.random() * arr.length) | 0];

  function sample() {
    current = {};
    dims.forEach(d => { current[d.id] = pick(d.values); });

    // human-readable headline assembled from key dimensions
    const g = current.gender_identity;
    const pronounNoun = g === 'Woman' ? 'professional' : g === 'Man' ? 'professional' : 'individual';
    nameEl.textContent = `${current.age_bracket} · ${current.role_function}`;
    lineEl.textContent =
      `${current.seniority}-level ${pronounNoun} in ${current.domain} (${current.subject_specialty}), ` +
      `based in ${current.region}. ${current.highest_education}, ${current.years_experience} yrs exp. ` +
      `Speaks ${current.primary_language} (${current.english_proficiency} English). ` +
      `Right now: ${current.emotional_state.toLowerCase()}, wants to ${current.intent.toLowerCase()}.`;

    traitBox.innerHTML = dims.map((d, i) => `
      <div class="trait-row" style="animation-delay:${Math.min(i * 10, 240)}ms">
        <span class="trait-key">${d.label}</span>
        <span class="trait-val">${current[d.id]}</span>
      </div>
    `).join('');
  }

  function openDrawer() {
    sample();
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    scrim.hidden = false;
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    scrim.hidden = true;
  }

  document.getElementById('sampleTop').addEventListener('click', e => { e.preventDefault(); openDrawer(); });
  document.getElementById('regen').addEventListener('click', sample);
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);
  scrim.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  document.getElementById('copyJson').addEventListener('click', async e => {
    const btn = e.currentTarget;
    const payload = JSON.stringify(current, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      const t = btn.textContent;
      btn.textContent = '✓ Copied';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = t; btn.classList.remove('copied'); }, 1400);
    } catch {
      btn.textContent = '⚠ blocked';
      setTimeout(() => { btn.textContent = '⧉ Copy JSON'; }, 1400);
    }
  });
})();
