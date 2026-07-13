#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(__dirname, "i18n-words.js");
const { dimensions } = JSON.parse(fs.readFileSync(path.join(ROOT, "dimensions.json"), "utf8"));

const BRANDS = new Set([
  "chrome","safari","firefox","edge","brave","python","javascript","typescript","java","go","rust",
  "ruby","swift","kotlin","c","c++","c#","r","sql","php","scala","perl","haskell","clojure","elixir",
  "erlang","lua","dart","julia","fortran","cobol","ocaml","f#","objective-c","solidity","matlab","sas",
  "spss","stata","apple","android","google","windows","linux","instagram","tiktok","facebook","linkedin",
  "youtube","reddit","whatsapp","imessage","wechat","telegram","signal","messenger","excel","figma",
  "photoshop","illustrator","tableau","looker","bnpl","crypto","adhd","ai","api","cli","github","gitlab",
  "sms","aws","azure","docker","kubernetes","terraform","graphql","chatgpt","claude","midjourney","copilot",
  "notion","slack","jira","trello","asana","linear","hubspot","salesforce","shopify","stripe","wordpress",
  "webflow","autocad","blender","unity","unreal","revit","solidworks","obsidian","vim","postman","jupyter",
  "zapier","xero","quickbooks","power bi","powerpoint","premiere pro","after effects","indesign","sketch",
  "canva","airtable","google sheets","google cloud","oracle erp","sap","intj","intp","entj","entp","infj",
  "infp","enfj","enfp","istj","isfj","estj","esfj","istp","isfp","estp","esfp","mbti","tipi","ci/cd","devops",
  "seo","mma","r&b","j-pop","k-pop","lo-fi","sci-fi","tv","hr","ngo","smb","vp","c-suite","tdd","nlp","gis",
  "erp","crm","ux","ui","ide","pr","qa","sre","gtm","uae","mena","stem","x","twitter","vs code","github copilot",
  "jetbrains ides","microsoft teams","stack overflow","word","assembly","bash","powershell","git","linear",
  "keynote","premiere","obsidian","unity","unreal engine","jet brains","copilot",
]);

// Import base dictionaries from companion module
const BASE = require("./i18n-data/base-dicts");

const VS_LABELS = {
  "Abstract vs concrete": "抽象 vs 具体",
  "Attitude: Privacy vs security": "态度：隐私 vs 安全",
  "Big group vs one-on-one": "大群体 vs 一对一",
  "Big-picture vs detail": "大局观 vs 细节",
  "Brief vs full detail": "简略 vs 详尽",
  "City vs nature": "城市 vs 自然",
  "Competition vs collaboration": "竞争 vs 合作",
  "Early vs late adopter": "早期采纳者 vs 晚期采纳者",
  "Individual contributor vs manager": "个人贡献者 vs 管理者",
  "Indoor vs outdoor": "室内 vs 户外",
  "Lead vs follow": "领导 vs 跟随",
  "Logic vs intuition": "逻辑 vs 直觉",
  "Novelty vs familiarity": "新奇 vs 熟悉",
  "Office vs remote": "办公室 vs 远程",
  "Performance vs Readability Priority": "性能 vs 可读性优先级",
  "Planned vs spontaneous": "计划性 vs 即兴",
  "Quality vs quantity": "质量 vs 数量",
  "Reading vs watching": "阅读 vs 观看",
  "Routine vs variety": "规律 vs 多样",
  "Save vs spend": "储蓄 vs 消费",
  "Speed vs accuracy": "速度 vs 准确度",
  "Spending vs saving": "消费 vs 储蓄",
  "Stability vs change": "稳定 vs 变化",
  "Team vs solo work": "团队 vs 独立工作",
  "Texting vs calling": "短信 vs 通话",
  "Visual vs verbal thinking": "视觉 vs 语言思维",
};

function collect() {
  const labels = new Set(), values = new Set(), entities = new Set(), vsLabels = new Set();
  const tokens = new Set();
  for (const d of dimensions) {
    labels.add(d.label);
    if (d.label.includes(" vs ")) vsLabels.add(d.label);
    for (const v of d.values || []) values.add(v);
    const m = d.label.match(/^[^:]+:\s*(.+)$/);
    if (m) entities.add(m[1].trim());
    for (const t of [d.label, d.description, ...(d.values||[])]) tokenize(t).forEach(x => tokens.add(x));
    if (m) tokenize(m[1]).forEach(x => tokens.add(x));
  }
  return { labels, values, entities, vsLabels, tokens };
}

function tokenize(text) {
  if (!text) return [];
  return String(text).toLowerCase()
    .replace(/[^a-z0-9\s\/\-+&'.]/g, " ")
    .split(/\s+/).filter(Boolean);
}

function isBrand(word) {
  const w = word.toLowerCase();
  if (BRANDS.has(w)) return true;
  if (/^[A-Z][a-z]+$/.test(word) && BRANDS.has(w)) return true;
  if (/^[A-Z]{2,}$/.test(word)) return true;
  return false;
}

function preserveCase(orig, zh) {
  if (/^[A-Z]/.test(orig) && /^[\u4e00-\u9fff]/.test(zh)) {
    return zh; // Chinese doesn't need case
  }
  return zh;
}

function trWord(word) {
  const lower = word.toLowerCase();
  if (isBrand(word)) return word;
  if (BASE.WORDS[lower]) return BASE.WORDS[lower];
  if (BASE.WORDS[word]) return BASE.WORDS[word];
  // suffix patterns
  if (lower.endsWith("ing") && BASE.WORDS[lower.slice(0,-3)]) return BASE.WORDS[lower.slice(0,-3)] + "中";
  if (lower.endsWith("ed") && BASE.WORDS[lower.slice(0,-2)]) return "已" + BASE.WORDS[lower.slice(0,-2)];
  if (lower.endsWith("er") && BASE.WORDS[lower.slice(0,-2)]) return BASE.WORDS[lower.slice(0,-2)] + "者";
  if (lower.endsWith("ly") && BASE.WORDS[lower.slice(0,-2)]) return BASE.WORDS[lower.slice(0,-2)] + "地";
  if (lower.endsWith("tion") && BASE.WORDS[lower.slice(0,-4) + "te"]) return BASE.WORDS[lower.slice(0,-4) + "te"];
  if (lower.endsWith("s") && !lower.endsWith("ss") && BASE.WORDS[lower.slice(0,-1)]) return BASE.WORDS[lower.slice(0,-1)];
  return null;
}

function trPhrase(text, overrides) {
  if (!text) return text;
  if (overrides && overrides[text]) return overrides[text];
  const lower = text.toLowerCase();
  if (overrides && overrides[lower]) return overrides[lower];
  // numeric / money / ranges - keep as-is
  if (/^[\d$<>\-+]+$/.test(text.replace(/\s/g,"")) || /^\d/.test(text) || text.includes("$")) return text;
  // MBTI patterns
  if (/^[A-Z]{4}\s*—/.test(text)) return text; // keep Latin type names
  // exact brand
  if (BRANDS.has(lower)) return text;
  // split by delimiters
  const parts = text.split(/\s*(\/|&|—|–|-)\s*/);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p === "/" || p === "&" || p === "—" || p === "–" || p === "-") { out.push(p === "&" ? "与" : p); continue; }
    if (BASE.ENTITIES[p]) { out.push(BASE.ENTITIES[p]); continue; }
    if (BASE.VALUE_PHRASES[p]) { out.push(BASE.VALUE_PHRASES[p]); continue; }
    const words = p.split(/\s+/);
    const tw = words.map(w => {
      if (isBrand(w)) return w;
      const t = trWord(w);
      if (t) return preserveCase(w, t);
      if (BASE.WORDS[w.toLowerCase()]) return BASE.WORDS[w.toLowerCase()];
      return w;
    });
    const joined = tw.join(words.length > 1 ? "" : "");
    out.push(joined);
  }
  return out.join(" ");
}

function buildWords(tokens) {
  const WORDS = { ...BASE.WORDS };
  for (const t of tokens) {
    if (!WORDS[t]) {
      const tr = trWord(t);
      if (tr) WORDS[t] = tr;
    }
  }
  // Add common phrase tokens from labels
  const extra = {
    "age":"年龄","bracket":"区间","region":"地区","gender":"性别","identity":"认同",
    "urbanicity":"城镇化程度","socioeconomic":"社会经济","band":"层级","primary":"主要",
    "english":"英语","proficiency":"熟练度","multilingualism":"多语能力","dialect":"方言",
    "register":"语体","domain":"领域","subject":"学科","specialty":"专长","stance":"立场",
    "highest":"最高","education":"教育","academic":"学术","field":"领域","institution":"院校",
    "tier":"层级","research":"研究","output":"产出","seniority":"资历","company":"公司",
    "size":"规模","role":"角色","function":"职能","years":"年","experience":"经验",
    "linkedin":"LinkedIn","activity":"活跃度","life":"生活","stage":"阶段","major":"重大",
    "events":"事件","cultural":"文化","background":"背景","tech":"科技","savviness":"熟练度",
    "dominant":"主导","trait":"特质","risk":"风险","tolerance":"承受度","decision":"决策",
    "style":"风格","core":"核心","value":"价值观","political":"政治","lean":"倾向",
    "religiosity":"宗教虔诚度","neurotype":"神经类型","emotional":"情绪","state":"状态",
    "intent":"意图","query":"查询","complexity":"复杂度","expertise":"专业能力","gap":"差距",
    "expected":"期望","tone":"语气","trust":"信任","level":"水平","safety":"安全",
    "sensitivity":"敏感度","time":"时间","pressure":"压力","prior":"先前","context":"背景",
    "device":"设备","modality":"模态","preference":"偏好","accessibility":"无障碍",
    "needs":"需求","learning":"学习","media":"媒体","diet":"饮食","economic":"经济",
    "motivation":"动机","myers-briggs":"迈尔斯-布里格斯","type":"类型","imagination":"想象力",
    "artistic":"艺术","interest":"兴趣","emotionality":"情感丰富度","adventurousness":"冒险性",
    "intellect":"求知欲","liberalism":"自由开放度","self-efficacy":"自我效能","orderliness":"条理性",
    "dutifulness":"尽责性","achievement":"成就","striving":"追求","self-discipline":"自律",
    "cautiousness":"谨慎性","friendliness":"友善","gregariousness":"合群性","assertiveness":"果断性",
    "activity":"活跃","excitement":"刺激","seeking":"寻求","cheerfulness":"愉悦感","morality":"道德感",
    "altruism":"利他","cooperation":"合作性","modesty":"谦逊","sympathy":"同情心","anxiety":"焦虑",
    "anger":"易怒","depression":"抑郁","self-consciousness":"自我意识","immoderation":"冲动",
    "vulnerability":"脆弱性","familiarity":"熟悉度","attitude":"态度","tool":"工具","skill":"技能",
    "hobby":"爱好","culture":"文化","sport":"运动","music":"音乐","cuisine":"菜系","programming":"编程",
    "character":"品格","film":"电影","books":"阅读","peeve":"雷点","fit":"适配","pet":"宠物",
    "ai":"AI","task":"任务","habit":"习惯","industry":"行业","language":"语言",
    "vs":"对比","priority":"优先级","readability":"可读性","performance":"性能",
    "contributor":"贡献者","manager":"管理者","adopter":"采纳者","early":"早期","late":"晚期",
    "concrete":"具体","abstract":"抽象","detail":"细节","big-picture":"大局观","brief":"简略",
    "full":"完整","city":"城市","nature":"自然","competition":"竞争","collaboration":"合作",
    "indoor":"室内","outdoor":"户外","lead":"领导","follow":"跟随","logic":"逻辑",
    "intuition":"直觉","novelty":"新奇","familiarity":"熟悉感","office":"办公室","remote":"远程",
    "planned":"计划性","spontaneous":"即兴","quality":"质量","quantity":"数量","reading":"阅读",
    "watching":"观看","routine":"规律","variety":"多样","save":"储蓄","spend":"消费","saving":"储蓄",
    "spending":"消费","speed":"速度","accuracy":"准确度","stability":"稳定","change":"变化",
    "team":"团队","solo":"独立","work":"工作","texting":"短信","calling":"通话","visual":"视觉",
    "verbal":"语言","thinking":"思维","group":"群体","one-on-one":"一对一","privacy":"隐私",
    "security":"安全","individual":"个人",
  };
  Object.assign(WORDS, extra);
  for (const t of tokens) {
    if (!WORDS[t]) {
      const tr = trWord(t);
      if (tr) WORDS[t] = tr;
    }
  }
  return WORDS;
}

function buildEntities(entities) {
  const ENTITIES = { ...BASE.ENTITIES };
  for (const e of entities) {
    if (!ENTITIES[e]) {
      const tr = trPhrase(e, BASE.ENTITIES);
      if (tr && tr !== e) ENTITIES[e] = tr;
      else if (BASE.ENTITIES[e]) ENTITIES[e] = BASE.ENTITIES[e];
      else {
        // force translation attempt
        const words = e.split(/[\s\/&]+/);
        const parts = words.map(w => {
          if (isBrand(w)) return w;
          return BASE.ENTITIES[w] || BASE.WORDS[w.toLowerCase()] || trWord(w) || w;
        });
        ENTITIES[e] = parts.join("");
      }
    }
  }
  return ENTITIES;
}

function buildValuePhrases(values) {
  const VALUE_PHRASES = { ...BASE.VALUE_PHRASES };
  for (const v of values) {
    if (!VALUE_PHRASES[v]) {
      if (BASE.VALUE_PHRASES[v]) { VALUE_PHRASES[v] = BASE.VALUE_PHRASES[v]; continue; }
      if (/^[\d$<>\-\+]/.test(v) || v.includes("$") || /^\d+[\-–]\d+/.test(v)) continue;
      if (/^[A-Z]{4}\s*—/.test(v)) { VALUE_PHRASES[v] = v; continue; }
      if (BRANDS.has(v.toLowerCase())) { VALUE_PHRASES[v] = v; continue; }
      const tr = trPhrase(v, { ...BASE.VALUE_PHRASES, ...BASE.ENTITIES });
      VALUE_PHRASES[v] = tr;
    }
  }
  return VALUE_PHRASES;
}

function serialize(obj) {
  const lines = [];
  const keys = Object.keys(obj).sort((a,b) => a.localeCompare(b));
  for (const k of keys) {
    const v = obj[k];
    const ks = JSON.stringify(k);
    const vs = JSON.stringify(v);
    lines.push(`  ${ks}: ${vs},`);
  }
  return lines.join("\n");
}

const { labels, values, entities, vsLabels, tokens } = collect();
const WORDS = buildWords(tokens);
const ENTITIES = buildEntities(entities);
const VALUE_PHRASES = buildValuePhrases(values);

// Ensure all VS labels present
for (const v of vsLabels) {
  if (!VS_LABELS[v]) {
    VS_LABELS[v] = trPhrase(v.replace(/ vs /g, " vs "), VS_LABELS) || v;
  }
}

const out = `/**
 * English-to-Chinese word dictionary for persona survey localization.
 * Auto-generated by scripts/build-i18n-words.js — do not edit by hand.
 * Regenerate: node scripts/build-i18n-words.js
 */
module.exports = {
  WORDS: {
${serialize(WORDS)}
  },
  ENTITIES: {
${serialize(ENTITIES)}
  },
  VS_LABELS: {
${serialize(VS_LABELS)}
  },
  VALUE_PHRASES: {
${serialize(VALUE_PHRASES)}
  },
};
`;

fs.writeFileSync(OUT, out);
console.log(`Wrote ${OUT}`);
console.log(`WORDS: ${Object.keys(WORDS).length}`);
console.log(`ENTITIES: ${Object.keys(ENTITIES).length}`);
console.log(`VS_LABELS: ${Object.keys(VS_LABELS).length}`);
console.log(`VALUE_PHRASES: ${Object.keys(VALUE_PHRASES).length}`);
