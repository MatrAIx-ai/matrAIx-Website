/* ============================================================
   matrAIx — evaluation-metric catalog generator
   Builds a 900+ catalog of evaluation metrics (curated core +
   meaningful families) that the demo's metric picker offers for
   selection. Users can still type any custom metric.
   Writes:  metrics.json  (categorized)  +  metrics.js  (names array)
   Run:     node generate-metrics.js
   ============================================================ */

const fs = require('fs');
const path = require('path');

const out = [];
const seen = new Set();
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function add(name, category) {
  name = String(name).replace(/\s+/g, ' ').trim();
  const k = name.toLowerCase();
  if (!k || seen.has(k)) return;
  seen.add(k); out.push({ name, category });
}

/* ---------- curated core ---------- */
const CORE = {
  Quality: ['Output quality', 'Response accuracy', 'Factual accuracy', 'Hallucination rate', 'Relevance',
    'Coherence', 'Completeness', 'Correctness', 'Groundedness', 'Faithfulness', 'Citation accuracy',
    'Source attribution', 'Format adherence', 'Instruction-following', 'Helpfulness', 'Harmlessness',
    'Honesty', 'Conciseness', 'Verbosity', 'Readability', 'Fluency', 'Grammaticality', 'Tone appropriateness',
    'Style consistency', 'Answer relevance', 'Context relevance', 'Context precision', 'Context recall',
    'Semantic similarity', 'BLEU score', 'ROUGE score', 'Exact-match rate', 'F1 score', 'Precision', 'Recall',
    'Specificity', 'Calibration error', 'Confidence calibration', 'Overconfidence rate', 'Abstention rate'],
  Safety: ['Safety', 'Toxicity rate', 'Hate-speech rate', 'Harassment rate', 'Violence-content rate',
    'Self-harm safety', 'Sexual-content rate', 'Bias rate', 'Demographic parity', 'Stereotype rate',
    'PII leakage rate', 'Data-leakage rate', 'Secret-exposure rate', 'Jailbreak resistance',
    'Prompt-injection resistance', 'Adversarial robustness', 'Refusal appropriateness', 'Over-refusal rate',
    'Under-refusal rate', 'Harmful-instruction rate', 'Misinformation rate', 'Unsafe-output rate',
    'Content-policy adherence', 'Guardrail trigger rate', 'Red-team pass rate', 'Profanity rate',
    'Privacy compliance'],
  Performance: ['Latency', 'Response time', 'Time to first token', 'Time to last token', 'Inference latency',
    'API latency', 'End-to-end latency', 'Throughput', 'Tokens per second', 'Requests per second', 'Queue time',
    'Cold-start time', 'Render time', 'Page load time', 'Time to interactive', 'Processing time', 'Round-trip time'],
  Cost: ['Cost per request', 'Cost per task', 'Cost per resolution', 'Cost per token', 'Token usage',
    'Prompt-token count', 'Completion-token count', 'Compute cost', 'GPU utilization', 'Token efficiency',
    'Cache-hit rate', 'Cost efficiency', 'Budget adherence'],
  Engagement: ['Click-through rate', 'Engagement rate', 'Interaction rate', 'Session length', 'Session depth',
    'Scroll depth', 'Bounce rate', 'Dwell time', 'Pages per session', 'Feature adoption rate', 'Feature usage rate',
    'Active-use rate', 'Stickiness', 'Return-visit rate', 'Time on task', 'Time in app'],
  Retention: ['Retention rate', 'Churn rate', 'Reactivation rate', 'Resurrection rate', 'Renewal rate',
    'Repeat-usage rate', 'Loyalty rate', 'Lifetime value', 'Cohort retention'],
  Conversion: ['Conversion rate', 'Signup completion', 'Checkout completion', 'Cart-abandonment rate',
    'Activation rate', 'Onboarding completion', 'Upgrade rate', 'Cross-sell rate', 'Upsell rate',
    'Trial-conversion rate', 'Lead-conversion rate', 'Form-completion rate', 'Funnel drop-off',
    'Add-to-cart rate', 'Purchase rate'],
  Task: ['Task completion rate', 'Task success rate', 'Goal completion rate', 'Subtask success rate',
    'Steps to completion', 'Action efficiency', 'Error rate', 'Retry rate', 'Recovery rate', 'Self-correction rate',
    'Escalation rate', 'Handoff rate', 'Tool-use accuracy', 'Tool-selection accuracy', 'Tool-call success rate',
    'Function-call accuracy', 'API-call success rate', 'Planning quality', 'Plan validity', 'Reasoning accuracy',
    'Multi-step accuracy', 'Stuck / loop rate', 'Timeout rate', 'Abandonment rate', 'Intervention rate',
    'First-attempt success'],
  Satisfaction: ['User satisfaction', 'CSAT', 'NPS', 'Customer effort score', 'Sentiment positivity',
    'Sentiment negativity', 'Frustration rate', 'Apologize rate', 'Complaint rate', 'Praise rate', 'Delight rate',
    'Trust score', 'Perceived helpfulness', 'Perceived accuracy', 'Recommendation rate'],
  Support: ['First-contact resolution', 'Resolution rate', 'Mean time to resolution', 'Deflection rate',
    'Escalation-to-human rate', 'Reopen rate', 'Backlog rate', 'Response rate', 'Containment rate'],
  Accessibility: ['Accessibility score', 'Screen-reader compatibility', 'Keyboard navigability', 'Contrast adequacy',
    'Alt-text coverage', 'ARIA correctness', 'Focus-order correctness', 'Caption coverage', 'Readability grade',
    'Color-blind safety', 'Motion-safety adherence', 'Touch-target adequacy'],
  Reliability: ['Robustness', 'Consistency', 'Determinism', 'Stability', 'Reproducibility', 'Edge-case handling',
    'Out-of-distribution detection', 'Graceful-degradation rate', 'Uptime', 'Availability', 'Failure rate',
    'Crash rate', 'Recovery time', 'Fault tolerance'],
  Compliance: ['Compliance rate', 'Policy adherence', 'Regulatory adherence', 'Audit pass rate', 'Explainability',
    'Transparency', 'Traceability', 'Consent adherence', 'Data-retention compliance', 'Fairness',
    'Equal-opportunity gap'],
};
Object.keys(CORE).forEach(cat => CORE[cat].forEach(n => add(n, cat)));

/* ---------- families ---------- */
// latency percentiles
const LAT = ['Latency', 'Response time', 'Time to first token', 'Inference latency', 'API latency', 'Render time',
  'Queue time', 'Processing time'];
const PCT = ['P50', 'P75', 'P90', 'P95', 'P99', 'P99.9', 'mean', 'max'];
LAT.forEach(s => PCT.forEach(p => add(`${s} — ${p}`, 'Performance')));

// temporal windows on retention/engagement
const WIN_STEM = ['Retention rate', 'Churn rate', 'Reactivation rate', 'Active-use rate', 'Repeat-usage rate'];
const WIN = ['Day-1', 'Day-3', 'Day-7', 'Day-14', 'Day-30', 'Day-60', 'Day-90', 'Week-1', 'Month-1', 'Month-3', 'Month-6'];
WIN_STEM.forEach(s => WIN.forEach(w => add(`${w} ${s.toLowerCase()}`, 'Retention')));

// per-channel
const CH_STEM = ['Click-through rate', 'Conversion rate', 'Bounce rate', 'Engagement rate', 'Completion rate',
  'Drop-off rate', 'Error rate', 'Satisfaction', 'Task success rate', 'Latency'];
const CH = ['Mobile', 'Desktop', 'Tablet', 'Web', 'Voice', 'Email', 'In-app', 'Push', 'SMS', 'Chat', 'Kiosk'];
CH_STEM.forEach(s => CH.forEach(c => add(`${c} ${s.toLowerCase()}`, 'Channel')));

// per-segment
const SEG_STEM = ['Conversion rate', 'Task completion rate', 'Satisfaction', 'Churn rate', 'Error rate',
  'Completion rate', 'Engagement rate', 'Drop-off rate', 'Resolution rate', 'Latency'];
const SEG = ['New-user', 'Returning-user', 'Power-user', 'Mobile', 'Low-bandwidth', 'Non-native English',
  'Age 55+', 'Accessibility-needs', 'Enterprise', 'SMB', 'Free-tier', 'Paid-tier'];
SEG_STEM.forEach(s => SEG.forEach(g => add(`${g} ${s.toLowerCase()}`, 'Segment')));

// quality at granularity
const QG_STEM = ['Accuracy', 'Relevance', 'Coherence', 'Completeness', 'Fluency', 'Faithfulness', 'Groundedness',
  'Helpfulness', 'Conciseness', 'Factuality', 'Consistency', 'Correctness', 'Toxicity', 'Bias', 'Refusal rate',
  'Hallucination rate', 'Citation accuracy', 'Instruction adherence', 'Tone match', 'Sentiment'];
const GRAN = ['(per response)', '(per session)', '(per turn)', '(per task)', '(overall)', '(per user)'];
QG_STEM.forEach(s => GRAN.forEach(g => add(`${s} ${g}`, 'Quality')));

// per funnel stage
const FN_STEM = ['Drop-off rate', 'Completion rate', 'Time spent', 'Error rate', 'Retry rate', 'Abandonment rate'];
const STAGE = ['landing', 'signup', 'onboarding', 'search', 'results', 'add-to-cart', 'checkout', 'payment',
  'confirmation', 'support'];
FN_STEM.forEach(s => STAGE.forEach(st => add(`${s} — ${st}`, 'Funnel')));

// safety harm categories
const HARM = ['Toxicity', 'Hate speech', 'Harassment', 'Violence', 'Self-harm', 'Sexual content', 'Misinformation',
  'Privacy violation', 'PII exposure', 'Bias', 'Stereotyping', 'Profanity', 'Extremism', 'Fraud / scam',
  'Malware / unsafe code', 'Medical misinformation', 'Legal misinformation', 'Financial misinformation',
  'Prompt injection', 'Data exfiltration', 'Copyright violation', 'Defamation'];
HARM.forEach(h => ['rate', 'exposure rate'].forEach(suf => add(`${cap(h)} ${suf}`, 'Safety')));

// per-locale
const LOC_STEM = ['Conversion rate', 'Latency', 'Satisfaction', 'Task completion rate', 'Error rate'];
const LOC = ['North America', 'Europe', 'LATAM', 'South Asia', 'East Asia', 'MENA', 'Africa', 'Oceania'];
LOC_STEM.forEach(s => LOC.forEach(l => add(`${l} ${s.toLowerCase()}`, 'Locale')));

// per-OS / device
const OS_STEM = ['Crash rate', 'Latency', 'Completion rate', 'Error rate'];
const OS = ['iOS', 'Android', 'Windows', 'macOS', 'Linux', 'ChromeOS'];
OS_STEM.forEach(s => OS.forEach(o => add(`${o} ${s.toLowerCase()}`, 'Device')));

// per-intent
const INT_STEM = ['Task success rate', 'Satisfaction', 'Resolution rate', 'Escalation rate'];
const INTENT = ['troubleshooting', 'billing', 'how-to', 'account', 'returns', 'complaints'];
INT_STEM.forEach(s => INTENT.forEach(it => add(`${cap(it)} ${s.toLowerCase()}`, 'Intent')));

// fairness by demographic
const FAIR = ['Bias rate', 'Fairness gap', 'Accuracy gap'];
const DEMO = ['gender', 'age', 'race / ethnicity', 'language', 'disability', 'geography'];
FAIR.forEach(s => DEMO.forEach(d => add(`${s} by ${d}`, 'Fairness')));

// voice / conversation
['Word error rate', 'Speech-recognition accuracy', 'Barge-in rate', 'Turn-taking latency', 'Interruption rate',
  'Wake-word accuracy', 'Transcription accuracy', 'Intent-recognition accuracy', 'Slot-filling accuracy',
  'Dialog success rate', 'Turns to resolution', 'Repair rate', 'Mispronunciation rate', 'Endpointing accuracy']
  .forEach(n => add(n, 'Conversation'));

// search / recommendation
['Search success rate', 'Zero-result rate', 'Result relevance', 'Mean reciprocal rank', 'NDCG', 'Recall@k',
  'Precision@k', 'Click position', 'Query-reformulation rate', 'Recommendation CTR', 'Recommendation acceptance',
  'Catalog coverage', 'Diversity', 'Novelty', 'Serendipity', 'Personalization lift']
  .forEach(n => add(n, 'Search & reco'));

// business KPIs
['Revenue per user', 'ARPU', 'Gross margin', 'Customer-acquisition cost', 'Payback period', 'Win rate',
  'Pipeline conversion', 'Net revenue retention', 'Gross revenue retention', 'Expansion rate', 'Refund rate',
  'Dispute rate', 'Chargeback rate', 'Average order value']
  .forEach(n => add(n, 'Business'));

/* ---------- write ---------- */
const cats = {};
out.forEach(m => (cats[m.category] = (cats[m.category] || 0) + 1));
fs.writeFileSync(path.join(__dirname, 'metrics.json'),
  JSON.stringify({ name: 'matrAIx evaluation metrics', count: out.length, categories: cats, metrics: out }, null, 2) + '\n');
const groups = {};
out.forEach(m => { (groups[m.category] = groups[m.category] || []).push(m.name); });
const groupsArr = Object.keys(groups).map(c => ({ category: c, metrics: groups[c] }));
fs.writeFileSync(path.join(__dirname, 'metrics.js'),
  'window.MATRAIX_METRICS = ' + JSON.stringify(out.map(m => m.name)) + ';\n' +
  'window.MATRAIX_METRIC_GROUPS = ' + JSON.stringify(groupsArr) + ';\n');

console.log(`metrics: ${out.length}`);
console.log('by category: ' + Object.entries(cats).map(([k, v]) => `${k} ${v}`).join(', '));
