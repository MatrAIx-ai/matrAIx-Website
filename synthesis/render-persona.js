// Line-by-line port of persona/synthesis/render.py (stdlib-only renderer).
import { validateDimensions } from "./dimensions-schema.js";

export const CORE_ORDER = [
  "age_bracket",
  "gender_identity",
  "region",
  "urbanicity",
  "socioeconomic_band",
  "cultural_background",
  "primary_language",
  "english_proficiency",
  "multilingualism",
  "highest_education",
  "academic_field",
  "domain",
  "subject_specialty",
  "seniority",
  "role_function",
  "company_size",
  "years_experience",
  "life_stage",
];

const BUCKETS = [
  ["Personality & values", ["Personality", "Values", "Risk & Decision"]],
  ["Worldview", ["Worldview"]],
  ["Interests", ["Interests"]],
  ["Skills & tools", ["Expertise", "Skills"]],
  [
    "Lifestyle & health",
    ["Health", "Behavior", "Demographic: Life", "Demographic: Family"],
  ],
  ["Learning", ["Learning"]],
  ["Developer & AI", ["Developer", "Coding", "AI"]],
];

const EXCLUDE_PREFIX = [
  "apple_primex_dimension_",
  "personahub_dimension_",
  "oasis_dimension_",
  "horizonbench_dimension_",
  "wildchat_",
  "pandora_",
  "personachat_",
  "synthetic_persona_chat_dimension_",
  "nemotron_",
  "wiki_",
];
const EXCLUDE_CATEGORY = ["External"];
const STATE_IDS = new Set([
  "emotional_state",
  "intent",
  "query_complexity",
  "expertise_gap",
  "tone_expected",
  "trust_level",
  "safety_sensitivity",
  "time_pressure",
  "prior_context",
  "device_context",
  "modality_pref",
  "accessibility_needs",
]);

function fixArticles(text) {
  return text.replace(
    /\b([Aa]n?)\s+([A-Za-z0-9][\w\-/()]*)/g,
    (_, article, word) => {
      const letters = word.replace(/[^A-Za-z]/g, "");
      let vowel;
      if (letters === letters.toUpperCase() && letters.length >= 2) {
        vowel = "AEFHILMNORSX".includes(word[0].toUpperCase());
      } else {
        vowel = "aeiou".includes(word[0].toLowerCase());
      }
      let newArticle = vowel ? "an" : "a";
      if (article[0] === article[0].toUpperCase()) {
        newArticle = `${newArticle[0].toUpperCase()}${newArticle.slice(1)}`;
      }
      return `${newArticle} ${word}`;
    },
  );
}

export function loadDims(data) {
  validateDimensions(data);
  const dims = new Map();
  for (const dimension of data.dimensions ?? []) {
    if (dimension.id !== undefined && dimension.values !== undefined) {
      dims.set(dimension.id, dimension);
    }
  }
  return dims;
}

const isDefault = (value, defaultValue) => {
  if (defaultValue === null || defaultValue === undefined) return false;
  if (Array.isArray(defaultValue)) return defaultValue.includes(value);
  return value === defaultValue;
};

const clause = (dimension, value) => {
  if (dimension.phrase) {
    return dimension.phrase.replaceAll("{value}", String(value));
  }
  const label = dimension.label || (dimension.id ?? "attribute").replaceAll("_", " ");
  return `their ${label[0].toLowerCase()}${label.slice(1)} is ${value}`;
};

export function renderPersona(
  assignment,
  dims,
  { maxClausesPerBucket = 30 } = {},
) {
  const core = [];
  for (const dimId of CORE_ORDER) {
    if (dimId in assignment && dims.has(dimId)) {
      const value = assignment[dimId];
      const dimension = dims.get(dimId);
      if (!isDefault(value, dimension.defaultValue)) {
        core.push(clause(dimension, value));
      }
    }
  }

  const lines = core.length ? [`A persona ${core.join(", ")}.`] : [];
  const used = new Set([...CORE_ORDER, ...STATE_IDS]);
  for (const [title, categories] of BUCKETS) {
    let clauses = [];
    for (const [dimId, value] of Object.entries(assignment)) {
      if (used.has(dimId) || !dims.has(dimId)) continue;
      if (EXCLUDE_PREFIX.some((prefix) => dimId.startsWith(prefix))) continue;
      const dimension = dims.get(dimId);
      const category = dimension.category || "";
      if (EXCLUDE_CATEGORY.some((prefix) => category.startsWith(prefix))) continue;
      if (!categories.some((prefix) => category.startsWith(prefix))) continue;
      if (isDefault(value, dimension.defaultValue)) continue;
      clauses.push(clause(dimension, value));
      used.add(dimId);
    }
    if (clauses.length) {
      if (maxClausesPerBucket !== null && clauses.length > maxClausesPerBucket) {
        const omitted = clauses.length - maxClausesPerBucket;
        clauses = clauses.slice(0, maxClausesPerBucket);
        clauses.push(`and ${omitted} more salient attributes`);
      }
      lines.push(`${title}: ${clauses.join("; ")}.`);
    }
  }
  return fixArticles(lines.join("\n"));
}
