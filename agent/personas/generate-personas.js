/* ============================================================
   matrAIx — synthetic persona (agent) generator
   Draws agents from the flat persona dimension space in
   ../../dimensions.json by assigning ONE value per dimension.

   Each agent → agent_XXXX.json (a flat {dimension_id: value} map
   plus a small header), mirroring the explorer's "Copy JSON".
   Deterministic: agent N always reuses seed N, so re-running is
   idempotent. A scaled-down sample of the 8.3B-agent space.

   Run:  node agent/personas/generate-personas.js [count]
         (default count = 830 — 8.3B at 1 : 10,000,000)
   ============================================================ */

const fs = require('fs');
const path = require('path');

const COUNT = parseInt(process.argv[2], 10) || 830;
const ROOT = path.join(__dirname, '..', '..');
const OUT = __dirname;

const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'dimensions.json'), 'utf8'));
const dims = schema.dimensions;

/* deterministic PRNG so agent N is reproducible across runs */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n, w = 4) => String(n).padStart(w, '0');

/* headline assembled from key dims — mirrors person.html's explorer */
function headline(d) {
  const g = d.gender_identity;
  const noun = (g === 'Woman' || g === 'Man') ? 'professional' : 'individual';
  const name = `${d.age_bracket} · ${d.role_function}`;
  const line =
    `${d.seniority}-level ${noun} in ${d.domain} (${d.subject_specialty}), ` +
    `based in ${d.region}. ${d.highest_education}, ${d.years_experience} yrs exp. ` +
    `Speaks ${d.primary_language} (${d.english_proficiency} English). ` +
    `Right now: ${String(d.emotional_state).toLowerCase()}, wants to ${String(d.intent).toLowerCase()}.`;
  return { name, line };
}

const index = [];
for (let i = 1; i <= COUNT; i++) {
  const rng = mulberry32(i);
  const values = {};
  for (const dim of dims) {
    values[dim.id] = dim.values[Math.floor(rng() * dim.values.length)];
  }
  const id = `agent_${pad(i)}`;
  const { name, line } = headline(values);
  const agent = {
    id,
    seed: i,
    schemaVersion: schema.schemaVersion,
    dimensionCount: dims.length,
    name,
    line,
    dimensions: values,
  };
  fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify(agent, null, 2) + '\n');
  index.push({ id, seed: i, name, line, file: id + '.json' });
}

fs.writeFileSync(
  path.join(OUT, 'index.json'),
  JSON.stringify({
    name: 'matrAIx synthetic agents',
    note: `Scaled sample of the 8.3B-agent space — ${COUNT} agents drawn from ${dims.length} dimensions.`,
    schemaVersion: schema.schemaVersion,
    dimensionCount: dims.length,
    count: COUNT,
    agents: index,
  }, null, 2) + '\n'
);

console.log(`generated ${COUNT} agents · ${dims.length} dimensions each → ${OUT}`);
