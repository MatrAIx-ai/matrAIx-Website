#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(__dirname, "i18n-extra.js");
const { dimensions } = JSON.parse(fs.readFileSync(path.join(ROOT, "dimensions.json"), "utf8"));
const I18N = require("./i18n-words");
const BASE = require("./i18n-data/base-dicts");

const BRANDS = new Set([
  "AI", "API", "CLI", "GitHub", "SMS", "MBTI", "ADHD", "UI", "UX", "IDE", "QA", "SRE", "GTM", "STEM",
  "ERP", "CRM", "GIS", "NLP", "SEO", "DevOps", "BNPL", "COBOL", "SQL", "PHP", "R", "C", "Go", "Java",
  "Python", "JavaScript", "TypeScript", "Rust", "Ruby", "Swift", "Kotlin", "Chrome", "Safari", "Firefox",
  "Edge", "Brave", "Windows", "Linux", "Apple", "Android", "Google", "WeChat", "WhatsApp", "Instagram",
  "TikTok", "Facebook", "LinkedIn", "YouTube", "Reddit", "Excel", "Figma", "ChatGPT", "Claude", "Copilot",
  "Notion", "Slack", "Jira", "Trello", "Asana", "Linear", "AWS", "Azure", "Docker", "Kubernetes",
  "Terraform", "GraphQL", "Midjourney", "Stripe", "Shopify", "WordPress", "Webflow", "AutoCAD", "Blender",
  "Unity", "Unreal", "Obsidian", "Vim", "Postman", "Jupyter", "Zapier", "X", "Twitter", "VS", "VP", "HR",
  "TV", "TLDR", "PR", "Agent", "LinkedIn",
]);

const WORDS = { ...BASE.WORDS, ...I18N.WORDS };

const EXTRA = {
  cognitive: "认知", theory: "理论", architecture: "建筑学", typography: "字体设计",
  organizational: "组织", psychology: "心理学", sommelier: "侍酒师", knowledge: "知识",
  cinematography: "摄影", meteorology: "气象学", forestry: "林业", paleontology: "古生物学",
  nanotechnology: "纳米技术", mining: "采矿", aviation: "航空", military: "军事", strategy: "战略",
  diplomacy: "外交", counseling: "咨询", theology: "神学", copywriting: "文案写作",
  editing: "编辑", storytelling: "讲故事", statistical: "统计", modeling: "建模",
  coaching: "教练", mental: "心理", arithmetic: "算术", operations: "运营管理",
  educator: "教育者", hobbyist: "爱好者", secondary: "中等", medicine: "医学", law: "法律",
  interdisciplinary: "跨学科", academia: "学术界", design: "设计", lurker: "潜水者",
  inactive: "不活跃", retirement: "退休", caregiving: "照护", bereavement: "丧亲",
  comfortable: "舒适", reluctant: "勉强", avoidant: "回避", cautious: "谨慎",
  analytical: "分析型", directive: "指令型", deliberative: "审慎", business: "商业",
  practitioner: "从业者", priority: "优先级", value: "价值观", activity: "活跃度",
  bandwidth: "带宽", visual: "视觉", diagram: "图表", step: "步骤", examples: "示例",
  barrier: "障碍", journals: "期刊", form: "形式", cost: "成本", premium: "高端",
  exposure: "接触", bird: "早起", owl: "夜猫", shift: "轮班", keto: "生酮", carb: "碳水",
  impulse: "冲动", bargain: "划算", flyer: "飞行", trips: "旅行", flexible: "灵活",
  introvert: "内向", extrovert: "外向", multi: "多", donor: "捐赠", wallet: "钱包",
  union: "合作社", index: "指数", investor: "投资者", trader: "交易者", brew: "冲泡",
  café: "咖啡", tea: "茶", trend: "潮流", backpacking: "背包", loosely: "松散",
  multitasker: "多任务", monotasker: "单任务", calibrated: "校准", obsessed: "痴迷",
  opportunity: "机会", threat: "威胁", undiagnosed: "未诊断", limitation: "受限",
  mobility: "行动", deaf: "聋", blind: "盲", assistive: "辅助", reader: "阅读器",
  domestic: "国内", partnership: "伴侣", sensitive: "敏感", driven: "驱动",
  seeking: "追求", heavy: "重度", structured: "结构化", formal: "正式", polite: "礼貌",
  precise: "精确", snap: "快速", constantly: "持续", rarely: "很少", usually: "通常",
  regular: "定期", avoids: "避开", instead: "替代", setter: "引领者", follower: "追随者",
};

function acceptable(text) {
  if (!text || !/[A-Za-z]/.test(text)) return true;
  const stripped = text.replace(/（[^）]*）|\([^)]*\)/g, "");
  const tokens = stripped.match(/[A-Za-z+#/.]+/g) || [];
  return tokens.every((t) => BRANDS.has(t));
}

function trToken(token) {
  const bare = token.replace(/['']/g, "").toLowerCase();
  if (BRANDS.has(token) || BRANDS.has(bare)) return token;
  if (EXTRA[bare]) return EXTRA[bare];
  if (WORDS[bare]) return WORDS[bare];
  return null;
}

function trSuffix(suffix) {
  const parts = suffix.split("_").map((w) => trToken(w)).filter(Boolean);
  if (parts.length && parts.length === suffix.split("_").length) return parts.join("");
  const phrase = suffix.replace(/_/g, " ");
  return trPhrase(phrase);
}

function forceTranslate(text) {
  const chunks = text.split(/\s*(\/|&|—|–|-)\s*/);
  const out = [];
  for (const chunk of chunks) {
    if (["/", "&", "—", "–", "-"].includes(chunk)) {
      out.push(chunk === "&" ? "与" : chunk === "-" ? "" : chunk);
      continue;
    }
    const words = chunk.split(/[\s(),]+/).filter(Boolean);
    const tr = words.map((w) => trToken(w));
    if (tr.some(Boolean)) out.push(tr.map((t, i) => t || words[i]).join(""));
    else out.push(chunk);
  }
  const joined = out.join("/").replace(/\/+/g, "/");
  return joined;
}

function trValue(text) {
  const tr = trPhrase(text);
  if (tr && acceptable(tr)) return tr;
  const forced = forceTranslate(text);
  if (forced && acceptable(forced)) return forced;
  return tr || forced || null;
}

function trPhrase(text) {
  if (!text) return null;
  if (/^[\d$<>\-+]/.test(text) || text.includes("$")) return text;

  const manual = {
    "Upper-middle": "中上层",
    "Regional dialect": "地区方言",
    "Code-switching": "语码转换",
    "Technical jargon": "专业术语",
    "Healthcare & Medicine": "医疗健康与医学",
    "Law & Policy": "法律与政策",
    "Natural Sciences": "自然科学",
    "Social Sciences": "社会科学",
    "Business & Management": "商业与管理",
    "Public Sector": "公共部门",
    "Skilled Trades": "技能行业",
    "Quant trading": "量化交易",
    "Investigative reporting": "调查报道",
    "Culinary arts": "烹饪艺术",
    "Cutting-edge researcher": "前沿研究者",
    "Cross-disciplinary": "跨学科",
    "No formal": "无正式学历",
    "Vocational / cert": "职业/证书",
    "Some college": "读过大学",
    "Social science": "社会科学",
    "Top-tier research": "顶尖研究",
    "Mid-tier university": "中等院校",
    "Self-taught": "自学",
    "Not applicable": "不适用",
    "Prolific publisher": "高产发表者",
    "Occasional author": "偶尔写作",
    "Industry whitepapers": "行业白皮书",
    "Thesis only": "仅论文",
    "Solo / freelance": "独立/自由职业",
    "Startup (<50)": "初创（<50人）",
    "SMB (50-500)": "中小企业（50-500）",
    "Enterprise (5k+)": "大型企业（5000+）",
    "Public sector": "公共部门",
    "Thought leader": "意见领袖",
    "Active networker": "活跃社交者",
    "Job seeker": "求职者",
    "Parent of young kids": "有年幼子女",
    "Mid-life": "中年",
    "Empty nester": "空巢期",
    "Migration / immigration": "迁移/移民",
    "Started a business": "创业",
    "Health journey": "健康历程",
    "Military service": "兵役",
    "Major relocation": "重大搬迁",
    "None notable": "无显著事件",
    "Digital native": "数字原生代",
    "Cautious adopter": "谨慎采纳者",
    "High openness": "高开放性",
    "High conscientiousness": "高尽责性",
    "High extraversion": "高外向性",
    "High agreeableness": "高宜人性",
    "High neuroticism": "高神经质",
    "Risk-averse": "风险规避",
    "Risk-tolerant": "风险容忍",
    "Risk-seeking": "风险寻求",
    "Consensus-driven": "共识驱动",
    "Anxiety-prone": "易焦虑",
    "Get task done": "完成任务",
    "Probe / red-team": "探查/红队",
    "Verify a claim": "核实主张",
    "Simple factual": "简单事实",
    "Multi-step": "多步骤",
    "Open-ended creative": "开放式创意",
    "Novice asking expert": "新手请教专家",
    "Peer-level": "同级",
    "Expert testing the system": "专家测试系统",
    "Teaching the model": "教学/指导模型",
    "Sensitive personal": "敏感个人信息",
    "High-stakes (medical/legal/financial)": "高风险（医疗/法律/金融）",
    "Potentially harmful": "潜在有害",
    "Dual-use": "双重用途",
    "No rush": "不紧迫",
    "Cold start": "冷启动",
    "Returning user": "回访用户",
    "Long ongoing project": "长期持续项目",
    "Frustrated re-ask": "沮丧地重复提问",
    "Desktop, focused": "桌面专注",
    "Mobile, on-the-go": "移动出行",
    "Voice assistant": "语音助手",
    "Accessibility tool": "无障碍工具",
    "Formal / standard": "正式/标准",
    Colloquial: "口语化",
    Operations: "运营管理",
    Educator: "教育者",
    Hobbyist: "爱好者",
    Secondary: "中等",
    "Associate's": "副学士",
    "Bachelor's": "学士",
    "Master's": "硕士",
    Medicine: "医学",
    Law: "法律",
    Business: "商业",
    Interdisciplinary: "跨学科",
    Academia: "学术界",
    Design: "设计",
    Lurker: "潜水者",
    Inactive: "不活跃",
    Retirement: "退休",
    Caregiving: "照护",
    Bereavement: "丧亲",
    Comfortable: "舒适",
    Reluctant: "勉强",
    Avoidant: "回避",
    Cautious: "谨慎",
    Analytical: "分析型",
    Directive: "指令型",
    Deliberative: "审慎",
    "Folk / traditional": "民间/传统宗教",
    "Citizen by birth": "出生公民",
    "No disability": "无残疾",
    "Prefers not to say": "不愿透露",
    "Only child": "独生子女",
    "Parent of minors": "有未成年子女",
    Veteran: "老手",
    Civilian: "非军人/平民",
    "Active duty": "现役",
    "Reserve / guard": "预备役/国民警卫队",
    "Military family": "军人家庭",
    Eldest: "排行最大",
    Youngest: "排行最小",
    "Twin / multiple": "双胞胎/多胞胎",
    "Same as primary": "与主要语言相同",
    "Bilingual home": "双语家庭",
    "Heritage language": "传承语言",
    "Mixed languages": "混合语言",
    Disengaged: "政治冷感",
    "Non-voter": "不投票",
    "Not a parent": "非父母",
    "New parent": "新手父母",
    "Parent of adults": "子女已成年",
    "Step / foster parent": "继父母/养父母",
    "Not in one": "无固定伴侣关系",
    "Under 1 year": "不满 1 年",
    "1-5 years": "1–5 年",
    "5-15 years": "5–15 年",
    "15+ years": "15 年以上",
    "Daily driver": "每日开车",
    "Occasional driver": "偶尔开车",
    "Licensed, rarely drives": "有驾照但很少开",
    "Non-driver": "不开车",
    "Cannot drive": "无法开车",
    "Domestic partnership": "同居伴侣",
    Separated: "分居",
    Expecting: "怀孕中",
    "1 child": "1 个孩子",
    "2 children": "2 个孩子",
    "3+ children": "3 个及以上",
    "Adult children": "成年子女",
    "Gig / freelance": "零工/自由职业",
    "Own outright": "完全自有",
    Renting: "租房",
    "Living with family": "与家人同住",
    "Shared housing": "合租",
    "Temporary / transitional": "临时/过渡性住房",
    "Spiritual but unaffiliated": "有精神信仰但未入教",
    Heterosexual: "异性恋",
    "Gay / lesbian": "同性恋",
    Bisexual: "双性恋",
    Pansexual: "泛性恋",
    Asexual: "无性恋",
    Queer: "酷儿",
    "Naturalized citizen": "归化公民",
    "Permanent resident": "永久居民",
    "Visa holder": "签证持有者",
    "Dual national": "双重国籍",
    Undocumented: "无证身份",
    "White / European": "白人/欧洲裔",
    "Black / African": "黑人/非洲裔",
    "Hispanic / Latino": "西班牙裔/拉丁裔",
    "East Asian": "东亚裔",
    "Southeast Asian": "东南亚裔",
    "Pacific Islander": "太平洋岛民裔",
    Multiracial: "多种族混血",
    Physical: "身体残疾",
    Sensory: "感官残疾",
    "Chronic illness": "慢性疾病",
  };
  if (manual[text]) return manual[text];

  const chunks = text.split(/\s*(\/|&|—|–|-)\s*/);
  const out = [];
  for (const chunk of chunks) {
    if (["/", "&", "—", "–", "-"].includes(chunk)) {
      out.push(chunk === "&" ? "与" : chunk);
      continue;
    }
    const words = chunk.split(/\s+/);
    const tr = words.map((w) => trToken(w.replace(/[()']/g, "")));
    if (tr.every(Boolean)) {
      out.push(tr.join(words.length > 1 ? "" : ""));
      continue;
    }
    const whole = trToken(chunk.toLowerCase());
    if (whole) out.push(whole);
    else return null;
  }
  const joined = out.join(" ");
  return joined && joined !== text ? joined : null;
}

const VALUE_EXT = {};
const ENTITY_EXT = {};
const WORD_EXT = { ...EXTRA };

for (const d of dimensions) {
  const suffix = d.id.includes("_") ? d.id.replace(/^[^_]+_/, "") : "";
  if (suffix) {
    const tr = trSuffix(suffix);
    if (tr && acceptable(tr)) WORD_EXT[suffix.toLowerCase()] = tr;
  }

  const entMatch = d.label.match(/^[^:]+:\s*(.+)$/);
  if (entMatch) {
    const ent = entMatch[1].trim();
    const existing = I18N.ENTITIES[ent];
    if (existing && acceptable(existing)) {
      ENTITY_EXT[ent] = existing;
    } else {
      const tr = trSuffix(suffix) || trPhrase(ent);
      if (tr && acceptable(tr)) ENTITY_EXT[ent] = tr;
    }
  }

  for (const v of d.values || []) {
    if (VALUE_EXT[v]) continue;
    const tr = trValue(v);
    if (tr) VALUE_EXT[v] = tr;
  }
}

const body = `/** Auto-generated — run: node scripts/build-i18n-extra.js */
module.exports = {
  VALUE_EXT: ${JSON.stringify(VALUE_EXT, null, 2)},
  ENTITY_EXT: ${JSON.stringify(ENTITY_EXT, null, 2)},
  WORD_EXT: ${JSON.stringify(WORD_EXT, null, 2)},
};
`;

fs.writeFileSync(OUT, body);
console.log(`Wrote ${OUT}`);
console.log(`VALUE_EXT: ${Object.keys(VALUE_EXT).length}`);
console.log(`ENTITY_EXT: ${Object.keys(ENTITY_EXT).length}`);
console.log(`WORD_EXT: ${Object.keys(WORD_EXT).length}`);
