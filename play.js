(() => {
  "use strict";

  const STORAGE_KEY = "matraix_persona_survey_v2";
  const OCEAN_KEYS = ["O", "C", "E", "A", "N"];
  const EXPLORATORY_FAMILIES = ["Personality:", "Worldview:"];

  const UI = {
    en: {
      title: "Persona Attribute Survey",
      subtitle: "Complete all 1290 persona dimensions in 43 groups. Progress is auto-saved locally so you can continue after refresh.",
      searchLabel: "Search dimensions",
      searchPlaceholder: "search dimensions...",
      languageLabel: "Language",
      prev: "← Previous",
      next: "Next →",
      saveDraft: "Save draft",
      fillDefaults: "Fill defaults",
      download: "Download attributes.json",
      reset: "Reset",
      progressLabel: "Progress",
      tabLabel: "Tab",
      of: "of",
      complete: "complete",
      searchEmpty: "No matching dimensions in this group.",
      cardsHidden: "Dimension cards hidden by default for this exploratory group.",
      interactiveCardsHidden: "Examples above infer values below. Expand cards to fine-tune individual dimensions.",
      showCards: "Show dimension cards",
      hideCards: "Hide dimension cards",
      smartTitle: "Smart Question Bank",
      smartHint: "Answer quick prompts, then apply inferred values to this tab.",
      smartApply: "Apply smart inference",
      smartSaved: "Smart inference applied to this group.",
      tipiTitle: "TIPI Personality Gauge",
      tipiHint: "Use TIPI answers or sliders to infer Big Five values.",
      tipiFromAnswers: "Calculate gauge from TIPI answers",
      tipiApply: "Apply gauge to Big Five dimensions",
      factualHint: "Factual group: set values directly per dimension.",
      interactiveTitle: "Pick an example",
      interactiveHint: "Choose the option that feels closest to you. We'll map it to the schema values.",
      interactiveApply: "Apply selections",
      interactiveSaved: "Example selections applied to this group.",
      interactivePickFirst: "Pick at least one example before applying.",
      skipGroup: "Not familiar — skip & use defaults",
      unskipGroup: "Undo skip",
      skipHintDefault: "Not familiar with this topic? Skip this group and use defaults.",
      skipDone: "Group skipped — neutral defaults applied.",
      skipBanner: "This group was skipped. Defaults are filled. You can undo or expand cards to override.",
      draftSaved: "Draft saved locally.",
      restored: "Draft restored from local storage.",
      fillDone: "Defaults filled for all dimensions.",
      resetDone: "Survey reset.",
      resetConfirm: "Reset all answers, smart answers, and local data?",
      exportMissing: "Cannot export yet. Missing values: ",
      exportReady: "attributes.json downloaded.",
      exportPartial: "attributes.json downloaded. Unfilled saved as null: ",
      loadError: "Failed to load dimensions or language pack.",
      toggleLang: "Switch language",
      missingIds: "Required survey DOM nodes are missing."
    },
    zh: {
      title: "Persona 属性问卷",
      subtitle: "完成全部 1290 个 persona 维度（43 个分组）。进度会自动保存在本地，刷新后可继续填写。",
      searchLabel: "搜索维度",
      searchPlaceholder: "搜索维度...",
      languageLabel: "语言",
      prev: "← 上一组",
      next: "下一组 →",
      saveDraft: "保存草稿",
      fillDefaults: "填充默认值",
      download: "下载 attributes.json",
      reset: "重置",
      progressLabel: "进度",
      tabLabel: "分组",
      of: "/",
      complete: "已完成",
      searchEmpty: "当前分组没有匹配的维度。",
      cardsHidden: "该探索分组默认隐藏维度卡片。",
      interactiveCardsHidden: "上方示例会推断下方属性；展开卡片可逐条微调。",
      showCards: "展开维度卡片",
      hideCards: "收起维度卡片",
      smartTitle: "智能问题组",
      smartHint: "先回答快速问题，再将推断结果应用到当前分组。",
      smartApply: "应用智能推断",
      smartSaved: "已将智能推断应用到当前分组。",
      tipiTitle: "TIPI 人格刻度",
      tipiHint: "可通过 TIPI 作答或滑杆推断大五人格维度。",
      tipiFromAnswers: "根据 TIPI 作答计算刻度",
      tipiApply: "应用刻度到大五维度",
      factualHint: "事实分组：直接逐维度选择值。",
      interactiveTitle: "选一个示例",
      interactiveHint: "选最贴近你的选项即可，系统会自动映射到对应属性值。",
      interactiveApply: "应用所选示例",
      interactiveSaved: "已将示例选择应用到当前分组。",
      interactivePickFirst: "请至少选择一个示例后再应用。",
      skipGroup: "不熟悉 — 跳过并使用默认值",
      unskipGroup: "取消跳过",
      skipHintDefault: "不熟悉这个主题？可跳过本组并使用默认值。",
      skipDone: "已跳过本组并填入中性默认值。",
      skipBanner: "本组已跳过，已填入默认值。可取消跳过，或展开卡片手动修改。",
      draftSaved: "草稿已保存到本地。",
      restored: "已从本地恢复草稿。",
      fillDone: "已为全部维度填入默认值。",
      resetDone: "问卷已重置。",
      resetConfirm: "确定重置全部答案、智能答案和本地数据吗？",
      exportMissing: "暂时无法导出，缺失维度数量：",
      exportReady: "attributes.json 已下载。",
      exportPartial: "attributes.json 已下载。未填写已存为 null，缺失数量：",
      loadError: "加载 dimensions 或中文包失败。",
      toggleLang: "切换语言",
      missingIds: "缺少问卷所需的 DOM 节点。"
    }
  };

  const TIPI_ITEMS = [
    { id: "tipi_1", trait: "E", reverse: false, text: { en: "Extraverted, enthusiastic.", zh: "外向、热情。" } },
    { id: "tipi_2", trait: "A", reverse: true, text: { en: "Critical, quarrelsome.", zh: "爱批评、易争辩。" } },
    { id: "tipi_3", trait: "C", reverse: false, text: { en: "Dependable, self-disciplined.", zh: "可靠、自律。" } },
    { id: "tipi_4", trait: "N", reverse: true, text: { en: "Anxious, easily upset.", zh: "焦虑、容易烦躁。" } },
    { id: "tipi_5", trait: "O", reverse: false, text: { en: "Open to new experiences, complex.", zh: "愿意接受新体验、思维复杂。" } },
    { id: "tipi_6", trait: "E", reverse: true, text: { en: "Reserved, quiet.", zh: "内敛、安静。" } },
    { id: "tipi_7", trait: "A", reverse: false, text: { en: "Sympathetic, warm.", zh: "有同理心、温暖。" } },
    { id: "tipi_8", trait: "C", reverse: true, text: { en: "Disorganized, careless.", zh: "缺乏条理、粗心。" } },
    { id: "tipi_9", trait: "N", reverse: false, text: { en: "Calm, emotionally stable.", zh: "冷静、情绪稳定。" } },
    { id: "tipi_10", trait: "O", reverse: true, text: { en: "Conventional, uncreative.", zh: "传统保守、缺乏创造性。" } }
  ];

  const SMART_QUESTION_BANK = {
    "_default": [
      {
        id: "social_energy",
        text: { en: "In group settings, I usually...", zh: "在群体场景中，我通常..." },
        options: [
          { value: "lead", label: { en: "Take the lead quickly", zh: "很快主动带头" }, traitDelta: { E: 2, C: 1 }, valueDelta: { achievement: 1 } },
          { value: "participate", label: { en: "Join actively once context is clear", zh: "明确背景后积极参与" }, traitDelta: { E: 1, A: 1 }, valueDelta: { community: 1 } },
          { value: "observe", label: { en: "Observe and contribute selectively", zh: "先观察再选择性发言" }, traitDelta: { C: 1, E: -1 }, valueDelta: { security: 1 } },
          { value: "avoid", label: { en: "Avoid if possible", zh: "尽量避免参与" }, traitDelta: { E: -2, N: 1 }, valueDelta: { security: 1 } }
        ]
      },
      {
        id: "ambiguity_style",
        text: { en: "When instructions are vague, I...", zh: "当任务说明模糊时，我会..." },
        options: [
          { value: "explore", label: { en: "Experiment and iterate", zh: "边试边迭代" }, traitDelta: { O: 2 }, valueDelta: { novelty: 2 } },
          { value: "ask", label: { en: "Ask clarifying questions first", zh: "先提澄清问题" }, traitDelta: { C: 1, A: 1 }, valueDelta: { security: 1 } },
          { value: "template", label: { en: "Use a template and adapt", zh: "先套模板再调整" }, traitDelta: { C: 2 }, valueDelta: { order: 1 } },
          { value: "delay", label: { en: "Delay until requirements firm up", zh: "等要求明确后再做" }, traitDelta: { N: 1, C: -1 }, valueDelta: { security: 2 } }
        ]
      }
    ],
    "Values & Motivation": [
      {
        id: "success_definition",
        text: { en: "Success feels like...", zh: "在我看来，成功更像..." },
        options: [
          { value: "impact", label: { en: "Creating measurable impact", zh: "创造可衡量的影响" }, valueDelta: { achievement: 2, community: 1 }, traitDelta: { C: 1 } },
          { value: "freedom", label: { en: "Freedom over my direction", zh: "拥有自主方向的自由" }, valueDelta: { autonomy: 2, novelty: 1 }, traitDelta: { O: 1 } },
          { value: "stability", label: { en: "Stability for me and my family", zh: "自己和家人的稳定" }, valueDelta: { security: 2, tradition: 1 }, traitDelta: { C: 1 } },
          { value: "joy", label: { en: "Daily joy and meaningful moments", zh: "日常快乐与意义感" }, valueDelta: { community: 1, novelty: 1 }, traitDelta: { A: 1 } }
        ]
      },
      {
        id: "money_tradeoff",
        text: { en: "Given same effort, I prefer...", zh: "在付出相同努力时，我更倾向..." },
        options: [
          { value: "high_pay", label: { en: "Higher pay with pressure", zh: "更高收入但压力更大" }, valueDelta: { achievement: 2, wealth: 2 }, traitDelta: { C: 1 } },
          { value: "balance", label: { en: "Balanced pay and flexibility", zh: "薪资与弹性兼顾" }, valueDelta: { autonomy: 1, security: 1 }, traitDelta: { C: 1 } },
          { value: "mission", label: { en: "Mission fit over pay", zh: "使命契合优先于收入" }, valueDelta: { community: 2, integrity: 1 }, traitDelta: { A: 1 } },
          { value: "safe", label: { en: "Lower variance, safer path", zh: "更低波动、更安全路径" }, valueDelta: { security: 2 }, traitDelta: { N: 1 } }
        ]
      }
    ],
    "Risk & Decision": [
      {
        id: "uncertain_choice",
        text: { en: "Facing an uncertain but high-upside option...", zh: "面对高收益但不确定的选项时..." },
        options: [
          { value: "jump", label: { en: "I jump in fast", zh: "我会快速尝试" }, traitDelta: { O: 1, E: 1 }, valueDelta: { novelty: 2, achievement: 1 } },
          { value: "pilot", label: { en: "I run a small pilot first", zh: "我会先做小范围试点" }, traitDelta: { C: 1 }, valueDelta: { security: 1, achievement: 1 } },
          { value: "wait_data", label: { en: "I wait for more evidence", zh: "我会等待更多证据" }, traitDelta: { C: 1, N: 1 }, valueDelta: { security: 2 } },
          { value: "avoid", label: { en: "I avoid downside risk", zh: "我会回避下行风险" }, traitDelta: { N: 2, O: -1 }, valueDelta: { security: 2 } }
        ]
      },
      {
        id: "decision_mode",
        text: { en: "In complex decisions I trust...", zh: "面对复杂决策时，我更信任..." },
        options: [
          { value: "models", label: { en: "Models and structured analysis", zh: "模型与结构化分析" }, traitDelta: { C: 2 }, valueDelta: { order: 2 } },
          { value: "intuition", label: { en: "Pattern-matching intuition", zh: "直觉与经验模式" }, traitDelta: { O: 1 }, valueDelta: { autonomy: 1 } },
          { value: "consensus", label: { en: "Team consensus", zh: "团队共识" }, traitDelta: { A: 2 }, valueDelta: { community: 2 } },
          { value: "defer", label: { en: "More time before deciding", zh: "延后决策以换取信息" }, traitDelta: { N: 1, C: 1 }, valueDelta: { security: 1 } }
        ]
      }
    ],
    "Worldview: Beliefs": [
      {
        id: "tech_change",
        text: { en: "Rapid technological change is mostly...", zh: "快速技术变革总体上..." },
        options: [
          { value: "opportunity", label: { en: "A major opportunity", zh: "是重大机会" }, traitDelta: { O: 2 }, valueDelta: { novelty: 2 } },
          { value: "balanced", label: { en: "Mixed: gains with trade-offs", zh: "利弊并存" }, traitDelta: { C: 1 }, valueDelta: { security: 1 } },
          { value: "risky", label: { en: "Risky without safeguards", zh: "若无保障则风险偏高" }, traitDelta: { N: 1 }, valueDelta: { security: 2 } },
          { value: "harmful", label: { en: "Mostly harmful", zh: "总体偏负面" }, traitDelta: { N: 2 }, valueDelta: { tradition: 1 } }
        ]
      },
      {
        id: "institution_trust",
        text: { en: "When authority and peers disagree, I rely on...", zh: "当权威与同侪意见冲突时，我更依赖..." },
        options: [
          { value: "authority", label: { en: "Established authority", zh: "既有权威" }, traitDelta: { C: 1 }, valueDelta: { tradition: 2 } },
          { value: "evidence", label: { en: "Primary evidence", zh: "一手证据" }, traitDelta: { O: 1, C: 1 }, valueDelta: { autonomy: 1, achievement: 1 } },
          { value: "community", label: { en: "Trusted community", zh: "信任社群" }, traitDelta: { A: 2 }, valueDelta: { community: 2 } },
          { value: "skeptic", label: { en: "Skepticism by default", zh: "默认保持怀疑" }, traitDelta: { N: 1 }, valueDelta: { security: 1 } }
        ]
      }
    ],
    "State: Emotional": [
      {
        id: "current_mood",
        text: { en: "Today my baseline feels...", zh: "今天我的整体状态更像..." },
        options: [
          { value: "energized", label: { en: "Energized", zh: "精力充沛" }, traitDelta: { E: 2, N: -1 }, valueDelta: { achievement: 1 } },
          { value: "steady", label: { en: "Steady", zh: "稳定平衡" }, traitDelta: { C: 1, N: -1 }, valueDelta: { security: 1 } },
          { value: "overloaded", label: { en: "Overloaded", zh: "负荷较高" }, traitDelta: { N: 2 }, valueDelta: { security: 2 } },
          { value: "detached", label: { en: "Detached", zh: "有些抽离" }, traitDelta: { E: -1, A: -1 }, valueDelta: { autonomy: 1 } }
        ]
      },
      {
        id: "query_intent_mode",
        text: { en: "When I open an AI/chat tool, I usually want to...", zh: "当我打开 AI/聊天工具时，通常是为了..." },
        options: [
          { value: "decide", label: { en: "Make a decision", zh: "做决策" }, traitDelta: { C: 1 }, valueDelta: { achievement: 1 } },
          { value: "learn", label: { en: "Learn or explore", zh: "学习或探索" }, traitDelta: { O: 2 }, valueDelta: { novelty: 1 } },
          { value: "ship", label: { en: "Ship work quickly", zh: "快速交付工作" }, traitDelta: { C: 2 }, valueDelta: { achievement: 2 } },
          { value: "reflect", label: { en: "Reflect and think", zh: "反思与整理思路" }, traitDelta: { N: 1, O: 1 }, valueDelta: { growth: 1 } }
        ]
      }
    ],
    "Personality: Big Five": [
      {
        id: "novelty_response",
        text: { en: "My reaction to unfamiliar methods is...", zh: "面对陌生方法时，我通常..." },
        options: [
          { value: "eager", label: { en: "Eager to try", zh: "愿意积极尝试" }, traitDelta: { O: 2 } },
          { value: "measured", label: { en: "Measured and selective", zh: "谨慎筛选后尝试" }, traitDelta: { O: 1, C: 1 } },
          { value: "resistant", label: { en: "Prefer proven patterns", zh: "更偏好成熟路径" }, traitDelta: { O: -2, C: 1 } }
        ]
      }
    ]
  };

  const state = {
    dimensions: [],
    categories: [],
    grouped: {},
    dimById: {},
    activeIndex: 0,
    search: "",
    lang: "en",
    i18n: null,
    answers: {},
    smartAnswers: {},
    personalityGauge: { O: 0, C: 0, E: 0, A: 0, N: 0 },
    manualExpanded: {},
    interactiveAnswers: {},
    skippedCategories: {},
    saveTimer: null
  };

  const dom = {};
  const REQUIRED_IDS = [
    "titleText", "subtitleText", "searchLabel", "dimensionSearch", "languageLabel", "langToggle",
    "progressStats", "groupTabs", "groupContent", "prevGroupBtn", "nextGroupBtn",
    "saveDraftBtn", "fillDefaultsBtn", "downloadBtn", "resetBtn", "status"
  ];

  function t(key) {
    return UI[state.lang]?.[key] || UI.en[key] || key;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[m]));
  }

  function setStatus(message, kind = "info") {
    if (!dom.status) return;
    dom.status.textContent = message;
    dom.status.dataset.kind = kind;
  }

  function assertDomNodes() {
    const missing = [];
    for (const id of REQUIRED_IDS) {
      const node = document.getElementById(id);
      if (!node) {
        missing.push(id);
      } else {
        dom[id] = node;
      }
    }
    if (missing.length) {
      throw new Error(`${t("missingIds")}: ${missing.join(", ")}`);
    }
  }

  function getCategoryOrder(dimensions) {
    const seen = new Set();
    const categories = [];
    for (const dim of dimensions) {
      if (!seen.has(dim.category)) {
        seen.add(dim.category);
        categories.push(dim.category);
      }
    }
    return categories;
  }

  async function loadDimensions() {
    const [dimsResponse, zhResponse] = await Promise.all([
      fetch("./dimensions.json"),
      fetch("./i18n/zh.json?v=16")
    ]);
    if (!dimsResponse.ok || !zhResponse.ok) {
      throw new Error(t("loadError"));
    }
    const [dimsData, zhData] = await Promise.all([dimsResponse.json(), zhResponse.json()]);
    const dimensions = Array.isArray(dimsData) ? dimsData : (Array.isArray(dimsData?.dimensions) ? dimsData.dimensions : []);
    state.dimensions = dimensions;
    state.i18n = zhData;
    state.dimById = {};
    state.grouped = {};
    for (const dim of dimensions) {
      state.dimById[dim.id] = dim;
      if (!state.grouped[dim.category]) {
        state.grouped[dim.category] = [];
      }
      state.grouped[dim.category].push(dim);
    }
    state.categories = getCategoryOrder(dimensions);
  }

  function zhPack() { return state.lang === "zh" ? state.i18n : null; }
  function dimensionLabelForUi(dim) {
    const pack = zhPack();
    if (!pack) return dim.label || dim.id;
    return pack.dimensions[dim.id]?.label ?? dim.label ?? dim.id;
  }
  function dimensionDescriptionForUi(dim) {
    const pack = zhPack();
    if (!pack) return dim.description || "";
    return pack.dimensions[dim.id]?.description ?? dim.description ?? "";
  }
  function optionLabelForUi(_dim, value) {
    const pack = zhPack();
    if (!pack) return value;
    return pack.values[value] ?? value; // exact match only; untranslated stays English
  }
  function categoryLabel(category) {
    if (state.lang === "zh") return state.i18n?.categories?.[category] ?? category;
    return category;
  }

  function isExploratoryCategory(category) {
    if (category === "Linguistic: Communication") return true;
    if (category === "Developer: Agent Adoption") return true;
    if (category === "Personality: Big Five") return true;
    if (category === "Values & Motivation") return true;
    if (category === "Risk & Decision") return true;
    if (category === "State: Emotional") return true;
    if (category.startsWith("Worldview:")) return true;
    if (category.startsWith("Personality:")) return true;
    return false;
  }

  function isInteractiveCategory(category) {
    const decks = window.INTERACTIVE_DECKS || {};
    return Boolean(decks[category]);
  }

  function getInteractiveDeck(category) {
    const decks = window.INTERACTIVE_DECKS || {};
    return decks[category] || null;
  }

  function skipHintForCategory(category) {
    const hints = window.SKIP_GROUP_HINTS || {};
    const hint = hints[category] || hints._default || {};
    return hint[state.lang] || hint.en || t("skipHintDefault");
  }

  function defaultForDimension(dim) {
    if (dim.defaultValue != null && (dim.values || []).includes(dim.defaultValue)) {
      return dim.defaultValue;
    }
    const neutral = pickByKeywords(
      dim.values || [],
      ["mixed", "moderate", "neutral", "not applicable", "none", "average", "balanced", "indifferent", "aware"],
      null
    );
    if (neutral) return neutral;
    const values = dim.values || [];
    if (!values.length) return null;
    return values[Math.floor((values.length - 1) / 2)] ?? values[0];
  }

  function isCategorySkipped(category) {
    return !!state.skippedCategories[category];
  }

  function skipCurrentCategory() {
    const category = getCurrentCategory();
    const dims = state.grouped[category] || [];
    for (const dim of dims) {
      const fallback = defaultForDimension(dim);
      if (fallback != null) {
        state.answers[dim.id] = fallback;
      }
    }
    state.skippedCategories[category] = true;
    queueSave();
    const lastIndex = state.categories.length - 1;
    if (state.activeIndex < lastIndex) {
      changeCategory(state.activeIndex + 1);
    } else {
      renderAll();
    }
    setStatus(`${t("skipDone")} (${category})`, "ok");
  }

  function unskipCurrentCategory() {
    const category = getCurrentCategory();
    delete state.skippedCategories[category];
    queueSave();
    renderAll();
  }

  function localizedDeckText(obj) {
    if (!obj) return "";
    if (typeof obj === "string") return obj;
    return obj[state.lang] || obj.en || "";
  }

  function localizedDeckCode(option) {
    if (!option?.code) return "";
    if (typeof option.code === "string") return option.code;
    return option.code[state.lang] || option.code.en || "";
  }

  function renderSkipGroupBar(category) {
    const skipped = isCategorySkipped(category);
    if (skipped) {
      return `<div class="skip-banner">
        <p>${escapeHtml(t("skipBanner"))}</p>
        <button type="button" class="btn btn-ghost" data-action="unskip-group">${escapeHtml(t("unskipGroup"))}</button>
      </div>`;
    }
    return `<div class="skip-bar">
      <p class="muted">${escapeHtml(skipHintForCategory(category))}</p>
      <button type="button" class="btn btn-ghost" data-action="skip-group">${escapeHtml(t("skipGroup"))}</button>
    </div>`;
  }

  function renderInteractiveDeckSection(category) {
    const deck = getInteractiveDeck(category);
    if (!deck) return "";
    const answers = state.interactiveAnswers[category] || {};
    const questionHtml = (deck.questions || []).map(question => {
      const selected = answers[question.id];
      const optionHtml = question.options.map(option => {
        const active = selected === option.value ? " is-active" : "";
        const codeText = localizedDeckCode(option);
        const codeBlock = codeText
          ? `<pre class="example-code"><code>${escapeHtml(codeText)}</code></pre>`
          : "";
        return `<button type="button" class="example-option${active}" data-action="interactive-pick"
          data-question="${escapeHtml(question.id)}" data-option="${escapeHtml(option.value)}">
          <strong>${escapeHtml(localizedDeckText(option.label))}</strong>
          ${codeBlock}
        </button>`;
      }).join("");
      return `<article class="interactive-question">
        <h4>${escapeHtml(localizedDeckText(question.text))}</h4>
        <div class="example-grid">${optionHtml}</div>
      </article>`;
    }).join("");

    return `<section class="interactive-box">
      <h3>${escapeHtml(t("interactiveTitle"))}</h3>
      <p>${escapeHtml(localizedDeckText(deck.intro) || t("interactiveHint"))}</p>
      ${questionHtml}
      <div class="smart-actions">
        <button type="button" class="btn btn-solid" data-action="interactive-apply">${escapeHtml(t("interactiveApply"))}</button>
      </div>
    </section>`;
  }

  function setInteractiveAnswer(category, questionId, optionValue) {
    if (!state.interactiveAnswers[category]) {
      state.interactiveAnswers[category] = {};
    }
    state.interactiveAnswers[category][questionId] = optionValue;
    queueSave();
    renderCurrentGroup();
  }

  function applyInteractiveDeck(category) {
    const deck = getInteractiveDeck(category);
    if (!deck) return;
    const answers = state.interactiveAnswers[category] || {};
    const merged = {};
    for (const question of deck.questions || []) {
      const picked = answers[question.id];
      if (!picked) continue;
      const option = question.options.find(o => o.value === picked);
      if (!option) continue;
      const dim = state.dimById[question.dimId];
      if (!dim) continue;
      const canonical = option.mapsTo;
      if (canonical && (dim.values || []).includes(canonical)) {
        merged[question.dimId] = canonical;
      }
    }
    if (!Object.keys(merged).length) {
      setStatus(t("interactivePickFirst"), "warn");
      return;
    }
    delete state.skippedCategories[category];
    state.answers = { ...state.answers, ...merged };
    queueSave();
    setStatus(t("interactiveSaved"), "ok");
    renderAll();
  }

  function isBigFiveCategory(category) {
    return category === "Personality: Big Five";
  }

  function getCurrentCategory() {
    return state.categories[state.activeIndex] || state.categories[0] || "";
  }

  function filterDimensionsInCategory(category) {
    const source = state.grouped[category] || [];
    const query = state.search.trim().toLowerCase();
    if (!query) return source;
    return source.filter(dim => {
      const strings = [
        dim.id,
        dim.label,
        dim.description,
        dimensionLabelForUi(dim),
        dimensionDescriptionForUi(dim),
        ...((dim.values || []).map(v => String(v))),
        ...((dim.values || []).map(v => optionLabelForUi(dim, String(v))))
      ].filter(Boolean);
      return strings.some(s => String(s).toLowerCase().includes(query));
    });
  }

  function answeredCountOverall() {
    let count = 0;
    for (const dim of state.dimensions) {
      if (state.answers[dim.id] !== undefined && state.answers[dim.id] !== null && state.answers[dim.id] !== "") {
        count += 1;
      }
    }
    return count;
  }

  function answeredCountInCategory(category) {
    const dims = state.grouped[category] || [];
    let count = 0;
    for (const dim of dims) {
      if (state.answers[dim.id] !== undefined && state.answers[dim.id] !== null && state.answers[dim.id] !== "") {
        count += 1;
      }
    }
    return count;
  }

  function persistState() {
    const payload = {
      version: 2,
      activeIndex: state.activeIndex,
      lang: state.lang,
      search: state.search,
      answers: state.answers,
      smartAnswers: state.smartAnswers,
      personalityGauge: state.personalityGauge,
      manualExpanded: state.manualExpanded,
      interactiveAnswers: state.interactiveAnswers,
      skippedCategories: state.skippedCategories,
      updatedAt: Date.now()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_err) {
      // no-op: storage can fail in private mode
    }
  }

  function queueSave() {
    if (state.saveTimer) {
      clearTimeout(state.saveTimer);
    }
    state.saveTimer = setTimeout(() => {
      persistState();
      state.saveTimer = null;
    }, 120);
  }

  function sanitizeGauge(input) {
    const out = { O: 0, C: 0, E: 0, A: 0, N: 0 };
    for (const key of OCEAN_KEYS) {
      const raw = Number(input?.[key]);
      out[key] = Number.isFinite(raw) ? Math.max(-2, Math.min(2, raw)) : 0;
    }
    return out;
  }

  function restoreState() {
    let raw = null;
    try {
      raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (_err) {
      raw = null;
    }
    if (!raw || typeof raw !== "object") return false;

    const restoredAnswers = {};
    const sourceAnswers = raw.answers && typeof raw.answers === "object" ? raw.answers : {};
    for (const dim of state.dimensions) {
      const value = sourceAnswers[dim.id];
      if (value === undefined || value === null || value === "") continue;
      if ((dim.values || []).includes(value)) {
        restoredAnswers[dim.id] = value;
      }
    }

    state.answers = restoredAnswers;
    state.smartAnswers = raw.smartAnswers && typeof raw.smartAnswers === "object" ? raw.smartAnswers : {};
    state.personalityGauge = sanitizeGauge(raw.personalityGauge || {});
    state.manualExpanded = raw.manualExpanded && typeof raw.manualExpanded === "object" ? raw.manualExpanded : {};
    state.interactiveAnswers = raw.interactiveAnswers && typeof raw.interactiveAnswers === "object" ? raw.interactiveAnswers : {};
    state.skippedCategories = raw.skippedCategories && typeof raw.skippedCategories === "object" ? raw.skippedCategories : {};
    state.lang = raw.lang === "zh" ? "zh" : "en";
    state.search = typeof raw.search === "string" ? raw.search : "";
    const idx = Number(raw.activeIndex);
    state.activeIndex = Number.isFinite(idx) ? Math.max(0, Math.min(state.categories.length - 1, idx)) : 0;
    return true;
  }

  function updateStaticUiText() {
    dom.titleText.textContent = t("title");
    dom.subtitleText.textContent = t("subtitle");
    dom.searchLabel.textContent = t("searchLabel");
    dom.dimensionSearch.placeholder = t("searchPlaceholder");
    dom.languageLabel.textContent = t("languageLabel");
    dom.langToggle.value = state.lang;
    dom.prevGroupBtn.textContent = t("prev");
    dom.nextGroupBtn.textContent = t("next");
    dom.saveDraftBtn.textContent = t("saveDraft");
    dom.fillDefaultsBtn.textContent = t("fillDefaults");
    dom.downloadBtn.textContent = t("download");
    dom.resetBtn.textContent = t("reset");
    dom.langToggle.setAttribute("aria-label", t("toggleLang"));
  }

  function renderProgressStats() {
    const category = getCurrentCategory();
    const total = state.dimensions.length;
    const complete = answeredCountOverall();
    const currentTotal = (state.grouped[category] || []).length;
    const currentComplete = answeredCountInCategory(category);
    dom.progressStats.innerHTML =
      `<div><strong>${escapeHtml(t("progressLabel"))}:</strong> ${complete}/${total} ${escapeHtml(t("complete"))}</div>` +
      `<div>${escapeHtml(t("tabLabel"))} ${state.activeIndex + 1} ${escapeHtml(t("of"))} ${state.categories.length} · ` +
      `${escapeHtml(categoryLabel(category))}: ${currentComplete}/${currentTotal}</div>`;
  }

  function renderTabs() {
    const html = state.categories.map((category, index) => {
      const active = index === state.activeIndex ? " is-active" : "";
      const count = answeredCountInCategory(category);
      const total = (state.grouped[category] || []).length;
      return `<button type="button" class="group-tab${active}" data-action="tab" data-index="${index}">
        ${escapeHtml(categoryLabel(category))}
        <span class="tab-count">${count}/${total}</span>
      </button>`;
    }).join("");
    dom.groupTabs.innerHTML = html;
  }

  function getSmartQuestionsForCategory(category) {
    if (category === "Linguistic: Communication" && window.COMMUNICATION_SMART?.questions) {
      return window.COMMUNICATION_SMART.questions;
    }
    if (category === "Developer: Agent Adoption" && window.AGENT_ADOPTION_SMART?.questions) {
      return window.AGENT_ADOPTION_SMART.questions;
    }
    return SMART_QUESTION_BANK[category] || SMART_QUESTION_BANK._default || [];
  }

  function getSmartCategoryIntro(category) {
    if (category === "Linguistic: Communication" && window.COMMUNICATION_SMART?.intro) {
      return window.COMMUNICATION_SMART.intro;
    }
    if (category === "Developer: Agent Adoption" && window.AGENT_ADOPTION_SMART?.intro) {
      return window.AGENT_ADOPTION_SMART.intro;
    }
    return null;
  }

  function usesSmartMapInference(category) {
    return category === "Linguistic: Communication" || category === "Developer: Agent Adoption";
  }

  function smartLabel(question, option) {
    return option.label?.[state.lang] || option.label?.en || option.value;
  }

  function smartQuestionText(question) {
    return question.text?.[state.lang] || question.text?.en || question.id;
  }

  function traitLabelForUi(key) {
    const labels = {
      en: { O: "Openness", C: "Conscientiousness", E: "Extraversion", A: "Agreeableness", N: "Neuroticism" },
      zh: { O: "开放性", C: "尽责性", E: "外向性", A: "宜人性", N: "神经质" }
    };
    return labels[state.lang][key] || key;
  }

  function renderTipiSection(category) {
    const saved = state.smartAnswers[category] || {};
    const itemHtml = TIPI_ITEMS.map(item => {
      const selected = Number(saved[item.id] || 0);
      const choices = Array.from({ length: 7 }, (_, i) => i + 1).map(score => {
        const checked = selected === score ? " checked" : "";
        return `<label class="tipi-choice"><input type="radio" name="${item.id}" value="${score}" data-tipiq="${item.id}"${checked}><span>${score}</span></label>`;
      }).join("");
      return `<div class="tipi-item">
        <div class="tipi-prompt">${escapeHtml(item.text[state.lang] || item.text.en)}</div>
        <div class="tipi-choices">${choices}</div>
      </div>`;
    }).join("");

    const gaugeHtml = OCEAN_KEYS.map(key => {
      const value = Number(state.personalityGauge[key] || 0);
      return `<label class="gauge-item">
        <span>${escapeHtml(traitLabelForUi(key))}</span>
        <input type="range" min="-2" max="2" step="1" value="${value}" data-gauge-key="${key}">
        <strong>${value > 0 ? `+${value}` : String(value)}</strong>
      </label>`;
    }).join("");

    return `<section class="smart-box">
      <h3>${escapeHtml(t("tipiTitle"))}</h3>
      <p>${escapeHtml(t("tipiHint"))}</p>
      <div class="tipi-grid">${itemHtml}</div>
      <div class="smart-actions">
        <button type="button" class="btn btn-ghost" data-action="tipi-calc">${escapeHtml(t("tipiFromAnswers"))}</button>
        <button type="button" class="btn btn-solid" data-action="smart-apply">${escapeHtml(t("tipiApply"))}</button>
      </div>
      <div class="gauge-grid">${gaugeHtml}</div>
    </section>`;
  }

  function renderSmartBankSection(category) {
    const bank = getSmartQuestionsForCategory(category);
    if (!bank.length) return "";
    const answers = state.smartAnswers[category] || {};
    const categoryIntro = getSmartCategoryIntro(category);
    const questionHtml = bank.map(question => {
      const selected = answers[question.id];
      const optionHtml = question.options.map(option => {
        const active = selected === option.value ? " is-active" : "";
        const example = option.example
          ? `<div class="smart-example">${escapeHtml(localizedDeckText(option.example))}</div>`
          : "";
        return `<button type="button" class="smart-option smart-option-rich${active}" data-action="smart-answer"
          data-category="${escapeHtml(category)}" data-question="${escapeHtml(question.id)}" data-option="${escapeHtml(option.value)}">
          <strong>${escapeHtml(smartLabel(question, option))}</strong>
          ${example}
        </button>`;
      }).join("");
      return `<article class="smart-question">
        <h4>${escapeHtml(smartQuestionText(question))}</h4>
        <div class="smart-options smart-options-rich">${optionHtml}</div>
      </article>`;
    }).join("");
    const introText = categoryIntro
      ? localizedDeckText(categoryIntro)
      : t("smartHint");
    return `<section class="smart-box">
      <h3>${escapeHtml(t("smartTitle"))}</h3>
      <p>${escapeHtml(introText)}</p>
      ${questionHtml}
      <div class="smart-actions">
        <button type="button" class="btn btn-solid" data-action="smart-apply">${escapeHtml(t("smartApply"))}</button>
      </div>
    </section>`;
  }

  function renderDimensionCards(category, dims, hiddenByDefault) {
    if (!dims.length) {
      return `<div class="empty-group">${escapeHtml(t("searchEmpty"))}</div>`;
    }
    const cardHtml = dims.map(dim => {
      const current = state.answers[dim.id];
      const options = (dim.values || []).map(value => {
        const checked = current === value ? " checked" : "";
        const id = `opt-${dim.id}-${String(value).replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "")}`;
        return `<label class="value-choice" for="${escapeHtml(id)}">
          <input type="radio" id="${escapeHtml(id)}" name="dim-${escapeHtml(dim.id)}" value="${escapeHtml(value)}"
            data-action="set-value" data-dim-id="${escapeHtml(dim.id)}"${checked}>
          <span>${escapeHtml(optionLabelForUi(dim, value))}</span>
        </label>`;
      }).join("");
      return `<article class="dimension-card">
        <header class="dim-card-head">
          <h4 class="dim-card-title">${escapeHtml(dimensionLabelForUi(dim))}</h4>
        </header>
        <p class="dim-card-desc">${escapeHtml(dimensionDescriptionForUi(dim))}</p>
        <div class="value-grid">${options}</div>
      </article>`;
    }).join("");

    if (!hiddenByDefault) {
      return `<div class="dimension-grid">${cardHtml}</div>`;
    }

    const expanded = !!state.manualExpanded[category];
    const toggleText = expanded ? t("hideCards") : t("showCards");
    const collapsedHint = hasExampleInference(category) ? t("interactiveCardsHidden") : t("cardsHidden");
    const info = `<p class="muted">${escapeHtml(collapsedHint)}</p>`;
    const body = expanded ? `<div class="dimension-grid">${cardHtml}</div>` : "";
    return `${info}
      <button type="button" class="btn btn-ghost" data-action="toggle-expand">${escapeHtml(toggleText)}</button>
      ${body}`;
  }

  function renderCurrentGroup() {
    const category = getCurrentCategory();
    const filteredDims = filterDimensionsInCategory(category);
    const exploratory = isExploratoryCategory(category);
    const interactive = isInteractiveCategory(category);
    const bigFive = isBigFiveCategory(category);
    const showCardsCollapsed = exploratory || interactive;
    let html = `<section class="group-panel">
      <header class="group-head">
        <h3>${escapeHtml(categoryLabel(category))}</h3>
        <div>${answeredCountInCategory(category)}/${(state.grouped[category] || []).length}</div>
      </header>`;

    html += renderSkipGroupBar(category);

    if (interactive && !isCategorySkipped(category)) {
      html += renderInteractiveDeckSection(category);
    }

    if (exploratory) {
      html += renderSmartBankSection(category);
      if (bigFive) {
        html += renderTipiSection(category);
      }
    } else if (!interactive) {
      html += `<p class="muted">${escapeHtml(t("factualHint"))}</p>`;
    }

    html += renderDimensionCards(category, filteredDims, showCardsCollapsed);
    html += "</section>";
    dom.groupContent.innerHTML = html;
    dom.prevGroupBtn.disabled = state.activeIndex <= 0;
    dom.nextGroupBtn.disabled = state.activeIndex >= state.categories.length - 1;
  }

  function renderAll() {
    updateStaticUiText();
    renderProgressStats();
    renderTabs();
    renderCurrentGroup();
  }

  function changeCategory(index) {
    const next = Math.max(0, Math.min(state.categories.length - 1, index));
    if (next === state.activeIndex) return;
    state.activeIndex = next;
    queueSave();
    renderAll();
  }

  function pickByKeywords(values, preferredKeywords = [], fallback = null) {
    if (!values.length) return fallback;
    const normalizedValues = values.map(v => ({ raw: v, lc: String(v).toLowerCase() }));
    for (const key of preferredKeywords) {
      const keyLc = key.toLowerCase();
      const hit = normalizedValues.find(v => v.lc.includes(keyLc));
      if (hit) return hit.raw;
    }
    return fallback ?? values[Math.floor(values.length / 2)] ?? null;
  }

  function valueForScale(values, score) {
    if (!values.length) return null;
    const index = Math.max(0, Math.min(values.length - 1, Math.round(((score + 2) / 4) * (values.length - 1))));
    const highKeywords = ["very high", "high", "always", "often", "strongly agree", "excellent", "thriving"];
    const lowKeywords = ["very low", "low", "never", "rarely", "strongly disagree", "poor", "crisis"];
    if (score >= 1) {
      return pickByKeywords(values, highKeywords, values[index]);
    }
    if (score <= -1) {
      return pickByKeywords(values, lowKeywords, values[index]);
    }
    return values[index];
  }

  function computeSmartProfile(category) {
    const bank = getSmartQuestionsForCategory(category);
    const answers = state.smartAnswers[category] || {};
    const trait = { O: 0, C: 0, E: 0, A: 0, N: 0 };
    const values = {
      autonomy: 0, security: 0, community: 0, achievement: 0,
      novelty: 0, tradition: 0, order: 0, growth: 0, wealth: 0, integrity: 0
    };
    for (const q of bank) {
      const selected = answers[q.id];
      if (!selected) continue;
      const option = q.options.find(o => o.value === selected);
      if (!option) continue;
      for (const k of Object.keys(option.traitDelta || {})) {
        trait[k] += option.traitDelta[k];
      }
      for (const k of Object.keys(option.valueDelta || {})) {
        values[k] = (values[k] || 0) + option.valueDelta[k];
      }
    }
    return { trait, values };
  }

  function inferTraitForDimension(dimId) {
    const id = dimId.toLowerCase();
    if (/open|imagination|artistic|intellect|adventurous|liberal|open_minded/.test(id)) return "O";
    if (/order|dutiful|discipline|achievement|self_efficacy|cautious|organization|conscientious/.test(id)) return "C";
    if (/friend|gregarious|assertive|activity|excitement|cheer|sociab|energy|extrav/.test(id)) return "E";
    if (/trust|morality|altru|cooper|modesty|sympath|compassion|respect|agree/.test(id)) return "A";
    if (/anxiety|anger|depress|self_conscious|immoderation|vulnerability|negative_emotional|neurotic/.test(id)) return "N";
    return null;
  }

  function pickDominantTraitLabel(values, profile) {
    const ranked = Object.entries(profile).sort((a, b) => b[1] - a[1]);
    const top = ranked[0]?.[0] || "C";
    const map = {
      O: ["high openness", "openness"],
      C: ["high conscientiousness", "conscientiousness"],
      E: ["high extraversion", "extraversion"],
      A: ["high agreeableness", "agreeableness"],
      N: ["high neuroticism", "neuroticism"]
    };
    return pickByKeywords(values, map[top], values[0] || null);
  }

  function inferValueByDimension(dim, profile) {
    const values = dim.values || [];
    if (!values.length) return null;
    const id = dim.id.toLowerCase();

    if (id === "dominant_trait") {
      return pickDominantTraitLabel(values, profile.trait);
    }
    if (id.includes("risk_tolerance") || id.includes("dospert")) {
      const score = (profile.trait.O * 0.7) - (profile.trait.N * 0.8);
      return valueForScale(values, Math.max(-2, Math.min(2, score / 3)));
    }
    if (id.includes("decision_style") || id.includes("need_for_closure")) {
      const cues = profile.trait.C >= 1
        ? ["analytical", "structured", "deliberative", "high"]
        : profile.trait.O >= 1
          ? ["intuitive", "adaptive", "exploratory"]
          : ["consensus", "balanced", "moderate"];
      return pickByKeywords(values, cues, values[Math.floor(values.length / 2)]);
    }
    if (id.includes("trust_level")) {
      const cues = profile.trait.N >= 1 ? ["skeptical", "verifying", "low"] : ["trusting", "high", "moderate"];
      return pickByKeywords(values, cues, values[Math.floor(values.length / 2)]);
    }
    if (id.includes("emotional_state")) {
      const cues = profile.trait.N >= 1
        ? ["anxious", "stressed", "overwhelmed", "negative"]
        : profile.trait.E >= 1
          ? ["excited", "energized", "positive"]
          : ["calm", "stable", "neutral"];
      return pickByKeywords(values, cues, values[Math.floor(values.length / 2)]);
    }
    if (id.includes("intent")) {
      const cues = profile.trait.C >= 1 ? ["decide", "act", "ship"] : profile.trait.O >= 1 ? ["learn", "explore"] : ["reflect", "explain"];
      return pickByKeywords(values, cues, values[0]);
    }
    if (id.includes("query_complexity")) {
      const cues = profile.trait.C >= 1 ? ["multi-step", "complex"] : profile.trait.O >= 1 ? ["open-ended"] : ["simple", "factual"];
      return pickByKeywords(values, cues, values[Math.floor(values.length / 2)]);
    }
    if (id === "mbti_type" || id === "neurotype") {
      const ei = profile.trait.E >= 0 ? "E" : "I";
      const sn = profile.trait.O >= 0 ? "N" : "S";
      const tf = profile.trait.A >= 0 ? "F" : "T";
      const jp = profile.trait.C >= 0 ? "J" : "P";
      const type = `${ei}${sn}${tf}${jp}`;
      return pickByKeywords(values, [type, ei, sn], values[0]);
    }
    if (id.includes("value") || id.includes("motivation") || id.includes("priority")) {
      const valueSorted = Object.entries(profile.values).sort((a, b) => b[1] - a[1]);
      const top = valueSorted[0]?.[0] || "achievement";
      const map = {
        autonomy: ["autonomy", "independence", "freedom"],
        security: ["security", "stability", "safe", "certainty"],
        community: ["community", "belonging", "helping", "loyalty"],
        achievement: ["achievement", "success", "recognition", "career"],
        novelty: ["novelty", "adventure", "stimulation", "creativity"],
        tradition: ["tradition", "conformity", "order", "duty"],
        order: ["order", "structure"],
        growth: ["growth", "learning", "development"],
        wealth: ["wealth", "status", "money"]
      };
      return pickByKeywords(values, map[top] || [top], values[Math.floor(values.length / 2)]);
    }

    const oceanTrait = inferTraitForDimension(dim.id);
    if (oceanTrait) {
      return valueForScale(values, Math.max(-2, Math.min(2, profile.trait[oceanTrait] / 2)));
    }
    return values[Math.floor(values.length / 2)];
  }

  function inferFromSmartMaps(category) {
    const bank = getSmartQuestionsForCategory(category);
    const answers = state.smartAnswers[category] || {};
    const merged = {};
    for (const q of bank) {
      const picked = answers[q.id];
      if (!picked) continue;
      const option = q.options.find(o => o.value === picked);
      if (!option?.maps) continue;
      for (const [dimId, canonical] of Object.entries(option.maps)) {
        const dim = state.dimById[dimId];
        if (dim && (dim.values || []).includes(canonical)) {
          merged[dimId] = canonical;
        }
      }
    }
    return merged;
  }

  function inferSmartMapDimensions(category) {
    const dims = state.grouped[category] || [];
    const merged = inferFromSmartMaps(category);
    for (const dim of dims) {
      if (merged[dim.id]) continue;
      const fallback = defaultForDimension(dim);
      if (fallback != null) merged[dim.id] = fallback;
    }
    return merged;
  }

  function inferCommunicationDimensions(category) {
    const merged = inferSmartMapDimensions(category);
    if (state.dimById.ind_telecommunications) {
      merged.ind_telecommunications = "None";
    }
    return merged;
  }

  function inferAgentAdoptionDimensions(category) {
    return inferSmartMapDimensions(category);
  }

  function hasExampleInference(category) {
    return isInteractiveCategory(category)
      || (category === "Linguistic: Communication" && window.COMMUNICATION_SMART?.questions?.length)
      || (category === "Developer: Agent Adoption" && window.AGENT_ADOPTION_SMART?.questions?.length);
  }

  function inferPersonalityDimensions(category, smartAnswers = null, personalityGauge = null) {
    const dims = state.grouped[category] || [];
    const profile = computeSmartProfile(category);
    void smartAnswers;
    if (personalityGauge && typeof personalityGauge === "object") {
      for (const key of OCEAN_KEYS) {
        if (Number.isFinite(personalityGauge[key])) {
          profile.trait[key] += Number(personalityGauge[key]) * 1.5;
        }
      }
    }
    const output = {};
    for (const dim of dims) {
      const guessed = inferValueByDimension(dim, profile);
      if (guessed !== null && guessed !== undefined) {
        output[dim.id] = guessed;
      }
    }
    return output;
  }

  function inferValueDimensions(category, smartAnswers = null) {
    const dims = state.grouped[category] || [];
    const profile = computeSmartProfile(category);
    void smartAnswers;
    const output = {};
    for (const dim of dims) {
      const guessed = inferValueByDimension(dim, profile);
      if (guessed !== null && guessed !== undefined) {
        output[dim.id] = guessed;
      }
    }
    return output;
  }

  function applyPersonalityGauge(dims, gauge, existingAnswers = null) {
    const source = sanitizeGauge(gauge || state.personalityGauge);
    const merged = {};
    for (const dim of dims) {
      const trait = inferTraitForDimension(dim.id);
      if (!trait) continue;
      const values = dim.values || [];
      const picked = valueForScale(values, source[trait]);
      if (picked !== null && picked !== undefined) {
        merged[dim.id] = picked;
      }
    }
    if (existingAnswers && typeof existingAnswers === "object") {
      return { ...existingAnswers, ...merged };
    }
    return merged;
  }

  function calcGaugeFromTipi(category) {
    const answers = state.smartAnswers[category] || {};
    const raw = { O: [], C: [], E: [], A: [], N: [] };
    for (const item of TIPI_ITEMS) {
      const score = Number(answers[item.id]);
      if (!Number.isFinite(score) || score < 1 || score > 7) continue;
      const normalized = item.reverse ? 8 - score : score;
      raw[item.trait].push(normalized);
    }
    const output = { O: 0, C: 0, E: 0, A: 0, N: 0 };
    for (const trait of OCEAN_KEYS) {
      if (!raw[trait].length) continue;
      const avg = raw[trait].reduce((sum, v) => sum + v, 0) / raw[trait].length;
      output[trait] = Math.max(-2, Math.min(2, Math.round(avg - 4)));
    }
    state.personalityGauge = output;
    queueSave();
  }

  function applyInferenceForCurrentCategory() {
    const category = getCurrentCategory();
    const dims = state.grouped[category] || [];
    let inferred = {};
    if (category === "Values & Motivation") {
      inferred = inferValueDimensions(category, state.smartAnswers[category] || {});
    } else if (category === "Linguistic: Communication") {
      inferred = inferCommunicationDimensions(category);
    } else if (category === "Developer: Agent Adoption") {
      inferred = inferAgentAdoptionDimensions(category);
    } else if (isBigFiveCategory(category)) {
      inferred = applyPersonalityGauge(dims, state.personalityGauge, {});
    } else {
      inferred = inferPersonalityDimensions(category, state.smartAnswers[category] || {}, state.personalityGauge);
    }
    if (usesSmartMapInference(category)) {
      const answered = Object.keys(state.smartAnswers[category] || {}).length;
      if (!answered) {
        setStatus(t("interactivePickFirst"), "warn");
        return;
      }
    }
    state.answers = { ...state.answers, ...inferred };
    if (usesSmartMapInference(category)) {
      delete state.skippedCategories[category];
    }
    queueSave();
    setStatus(t("smartSaved"), "ok");
    renderAll();
  }

  function setSmartAnswer(category, questionId, optionValue) {
    if (!state.smartAnswers[category]) {
      state.smartAnswers[category] = {};
    }
    state.smartAnswers[category][questionId] = optionValue;
    queueSave();
    renderCurrentGroup();
  }

  function setDimensionValue(dimId, value) {
    const dim = state.dimById[dimId];
    if (!dim) return;
    if (!(dim.values || []).includes(value)) return;
    state.answers[dimId] = value;
    queueSave();
    renderProgressStats();
    renderTabs();
  }

  function fillDefaults() {
    for (const dim of state.dimensions) {
      const fallback = dim.defaultValue != null && (dim.values || []).includes(dim.defaultValue)
        ? dim.defaultValue
        : (dim.values || [])[0] ?? null;
      if (fallback != null) {
        state.answers[dim.id] = fallback;
      }
    }
    queueSave();
    setStatus(t("fillDone"), "ok");
    renderAll();
  }

  function resetSurvey() {
    const accepted = window.confirm(t("resetConfirm"));
    if (!accepted) return;
    state.answers = {};
    state.smartAnswers = {};
    state.personalityGauge = { O: 0, C: 0, E: 0, A: 0, N: 0 };
    state.manualExpanded = {};
    state.interactiveAnswers = {};
    state.skippedCategories = {};
    state.search = "";
    state.activeIndex = 0;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_err) {
      // no-op
    }
    dom.dimensionSearch.value = "";
    setStatus(t("resetDone"), "ok");
    renderAll();
  }

  function downloadAttributes() {
    const missing = state.dimensions.filter(dim => !state.answers[dim.id]).map(dim => dim.id);
    const payload = {};
    for (const dim of state.dimensions) {
      payload[dim.id] = state.answers[dim.id] || null;
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "attributes.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    if (missing.length) {
      setStatus(`${t("exportPartial")}${missing.length}`, "warn");
    } else {
      setStatus(t("exportReady"), "ok");
    }
  }

  function handleGroupContentClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    const category = getCurrentCategory();

    if (action === "smart-answer") {
      const q = target.dataset.question;
      const option = target.dataset.option;
      if (q && option) {
        setSmartAnswer(category, q, option);
      }
      return;
    }
    if (action === "toggle-expand") {
      state.manualExpanded[category] = !state.manualExpanded[category];
      queueSave();
      renderCurrentGroup();
      return;
    }
    if (action === "smart-apply") {
      applyInferenceForCurrentCategory();
      return;
    }
    if (action === "interactive-pick") {
      const q = target.dataset.question;
      const option = target.dataset.option;
      if (q && option) {
        setInteractiveAnswer(category, q, option);
      }
      return;
    }
    if (action === "interactive-apply") {
      applyInteractiveDeck(category);
      return;
    }
    if (action === "skip-group") {
      skipCurrentCategory();
      return;
    }
    if (action === "unskip-group") {
      unskipCurrentCategory();
      return;
    }
    if (action === "tipi-calc") {
      calcGaugeFromTipi(category);
      renderCurrentGroup();
      return;
    }
  }

  function handleGroupContentChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.action === "set-value") {
      const dimId = target.dataset.dimId;
      if (dimId) {
        setDimensionValue(dimId, target.value);
      }
      return;
    }
    if (target.dataset.tipiq) {
      const category = getCurrentCategory();
      if (!state.smartAnswers[category]) {
        state.smartAnswers[category] = {};
      }
      state.smartAnswers[category][target.dataset.tipiq] = Number(target.value);
      queueSave();
      return;
    }
    if (target.dataset.gaugeKey) {
      const key = target.dataset.gaugeKey;
      if (OCEAN_KEYS.includes(key)) {
        state.personalityGauge[key] = Number(target.value);
        queueSave();
        renderCurrentGroup();
      }
    }
  }

  function bindEvents() {
    dom.dimensionSearch.addEventListener("input", () => {
      state.search = dom.dimensionSearch.value || "";
      queueSave();
      renderCurrentGroup();
    });

    dom.langToggle.addEventListener("change", () => {
      state.lang = dom.langToggle.value === "zh" ? "zh" : "en";
      queueSave();
      renderAll();
    });

    dom.groupTabs.addEventListener("click", event => {
      const button = event.target.closest("[data-action='tab']");
      if (!button) return;
      const index = Number(button.dataset.index);
      if (Number.isFinite(index)) {
        changeCategory(index);
      }
    });

    dom.prevGroupBtn.addEventListener("click", () => changeCategory(state.activeIndex - 1));
    dom.nextGroupBtn.addEventListener("click", () => changeCategory(state.activeIndex + 1));
    dom.saveDraftBtn.addEventListener("click", () => {
      persistState();
      setStatus(t("draftSaved"), "ok");
    });
    dom.fillDefaultsBtn.addEventListener("click", fillDefaults);
    dom.downloadBtn.addEventListener("click", downloadAttributes);
    dom.resetBtn.addEventListener("click", resetSurvey);

    dom.groupContent.addEventListener("click", handleGroupContentClick);
    dom.groupContent.addEventListener("change", handleGroupContentChange);
  }

  async function init() {
    try {
      assertDomNodes();
      await loadDimensions();
      const restored = restoreState();
      dom.dimensionSearch.value = state.search;
      bindEvents();
      renderAll();
      if (restored) {
        setStatus(t("restored"), "ok");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("loadError");
      const statusNode = document.getElementById("status");
      if (statusNode) {
        statusNode.textContent = message;
      }
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }

  init();
})();
