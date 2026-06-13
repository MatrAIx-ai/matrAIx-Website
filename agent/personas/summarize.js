/* ============================================================
   matrAIx — synthetic agent cohort summary
   Reads agent_*.json in this folder and computes diversity
   distributions + summary statistics. Writes:
     - summary.json  (machine-readable)
     - SUMMARY.md     (human-readable, with bars)
   Run:  node agent/personas/summarize.js
   ============================================================ */

const fs = require('fs');
const path = require('path');

const OUT = __dirname;
const ROOT = path.join(OUT, '..', '..');
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'dimensions.json'), 'utf8'));
const labelOf = Object.fromEntries(schema.dimensions.map(d => [d.id, d.label]));
const valuesOf = Object.fromEntries(schema.dimensions.map(d => [d.id, d.values]));

const files = fs.readdirSync(OUT).filter(f => /^agent_\d+\.json$/.test(f)).sort();
const agents = files.map(f => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')));
const N = agents.length;

/* ---- single-dimension distribution ---- */
function dist(id) {
  const c = {};
  for (const a of agents) { const v = a.dimensions[id]; c[v] = (c[v] || 0) + 1; }
  // keep schema value order where possible
  const order = valuesOf[id] || Object.keys(c);
  const rows = order.filter(v => c[v]).map(v => ({ value: v, count: c[v], pct: +(c[v] / N * 100).toFixed(1) }));
  for (const v of Object.keys(c)) if (!order.includes(v)) rows.push({ value: v, count: c[v], pct: +(c[v] / N * 100).toFixed(1) });
  return rows;
}

/* ---- pooled distribution across a family of dims (prefix) ---- */
function pooled(prefix, scale) {
  const c = {};
  let total = 0, fam = 0;
  for (const d of schema.dimensions) {
    if (!d.id.startsWith(prefix)) continue;
    fam++;
    for (const a of agents) { const v = a.dimensions[d.id]; c[v] = (c[v] || 0) + 1; total++; }
  }
  const order = scale || [...new Set(Object.keys(c))];
  return {
    dims: fam,
    rows: order.filter(v => c[v]).map(v => ({ value: v, count: c[v], pct: +(c[v] / total * 100).toFixed(1) })),
  };
}

/* ---- normalized Shannon entropy (0 = skewed, 1 = perfectly balanced) ---- */
function balance(rows) {
  const k = rows.length; if (k <= 1) return 1;
  let h = 0; for (const r of rows) { const p = r.count / N; if (p > 0) h -= p * Math.log(p); }
  return +(h / Math.log(k)).toFixed(3);
}

/* ---- curated single dims to report ---- */
const SINGLE = [
  ['gender_identity', 'Gender identity'],
  ['demo_ethnicity_broad', 'Ethnic background'],
  ['age_bracket', 'Age bracket'],
  ['demo_generation', 'Generational cohort'],
  ['region', 'Region'],
  ['urbanicity', 'Urbanicity'],
  ['socioeconomic_band', 'Socioeconomic band'],
  ['highest_education', 'Highest education'],
  ['academic_field', 'Academic field'],
  ['seniority', 'Seniority'],
  ['role_function', 'Role function'],
  ['demo_employment_status', 'Employment status'],
  ['primary_language', 'Primary language'],
  ['demo_religion_affiliation', 'Religious affiliation'],
  ['demo_marital_status', 'Marital status'],
  ['mbti_type', 'Myers–Briggs type'],
];

const FAMILIES = [
  ['skill_', 'Skills', ['Master', 'Advanced', 'Intermediate', 'Beginner', 'None']],
  ['fam_', 'Expertise / familiarity', ['Expert', 'Proficient', 'Familiar', 'Aware', 'None']],
  ['prog_', 'Programming languages', ['Expert', 'Proficient', 'Familiar', 'None']],
  ['lang_', 'Spoken languages', ['Native', 'Fluent', 'Conversational', 'Basic', 'None']],
  ['big5_', 'Big Five facets', ['Very high', 'High', 'Average', 'Low', 'Very low']],
];

/* ---- coverage: how much of the value space the cohort touches ---- */
let totalVals = 0, seenVals = 0;
for (const d of schema.dimensions) {
  totalVals += d.values.length;
  const seen = new Set(agents.map(a => a.dimensions[d.id]));
  seenVals += d.values.filter(v => seen.has(v)).length;
}
const uniqueAgents = new Set(agents.map(a => JSON.stringify(a.dimensions))).size;

/* ---- assemble summary.json ---- */
const summary = {
  cohort: 'matrAIx synthetic agents',
  generatedFrom: 'dimensions.json',
  schemaVersion: schema.schemaVersion,
  agents: N,
  dimensionsPerAgent: schema.dimensions.length,
  uniqueAgents,
  valueSpaceCoverage: +(seenVals / totalVals * 100).toFixed(1),
  distributions: {},
  families: {},
};
for (const [id, name] of SINGLE) {
  if (!labelOf[id]) continue;
  const rows = dist(id);
  summary.distributions[id] = { label: name, balance: balance(rows), rows };
}
for (const [pre, name] of FAMILIES) summary.families[pre] = { label: name, ...pooled(pre, FAMILIES.find(f => f[0] === pre)[2]) };
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');

/* ---- render SUMMARY.md ---- */
const BARW = 22;
const bar = pct => '█'.repeat(Math.round(pct / 100 * BARW)).padEnd(BARW, '·');
const lines = [];
lines.push(`# matrAIx synthetic agents — cohort summary\n`);
lines.push(`Diversity and statistics for the **${N} generated agents** in this folder, each drawn from **${schema.dimensions.length} dimensions** in [\`dimensions.json\`](../../dimensions.json).\n`);
lines.push(`> Regenerate with \`node agent/personas/summarize.js\`. Machine-readable form: [\`summary.json\`](summary.json).\n`);
lines.push(`## At a glance\n`);
lines.push(`| Metric | Value |`);
lines.push(`|--------|-------|`);
lines.push(`| Agents | ${N} |`);
lines.push(`| Dimensions per agent | ${schema.dimensions.length} |`);
lines.push(`| Unique agents | ${uniqueAgents} / ${N} (${(uniqueAgents / N * 100).toFixed(1)}%) |`);
lines.push(`| Value-space coverage | ${summary.valueSpaceCoverage}% of all ${totalVals.toLocaleString()} possible values appear |`);
lines.push(``);
lines.push(`*Balance* below is normalized entropy: **1.00 = perfectly even**, lower = more skewed.\n`);

for (const [id, name] of SINGLE) {
  if (!labelOf[id]) continue;
  const rows = dist(id);
  lines.push(`## ${name}  \n\`balance ${balance(rows)}\`\n`);
  lines.push('```');
  for (const r of rows) lines.push(`${String(r.value).padEnd(26)} ${bar(r.pct)} ${String(r.pct).padStart(4)}%  (${r.count})`);
  lines.push('```\n');
}

lines.push(`## Family aggregates\n`);
lines.push(`Pooled across every dimension in each family (e.g. all skill dimensions together).\n`);
for (const [pre, name, scale] of FAMILIES) {
  const p = pooled(pre, scale);
  lines.push(`### ${name}  \n\`${p.dims} dimensions pooled\`\n`);
  lines.push('```');
  for (const r of p.rows) lines.push(`${String(r.value).padEnd(16)} ${bar(r.pct)} ${String(r.pct).padStart(4)}%`);
  lines.push('```\n');
}

fs.writeFileSync(path.join(OUT, 'SUMMARY.md'), lines.join('\n'));
console.log(`summarized ${N} agents → summary.json + SUMMARY.md`);
