(() => {
  "use strict";

  const STORAGE_KEY = "matraix_persona_survey_v2";
  const NOT_APPLICABLE_VALUE = "N/A";
  const AUTO_SAVE_INTERVAL_MS = 15000;
  const OCEAN_KEYS = ["O", "C", "E", "A", "N"];
  const EXPLORATORY_FAMILIES = ["Personality:", "Worldview:"];

  const UI = {
    en: {
      title: "Persona Attribute Survey",
      subtitle: "Complete all 1290 persona dimensions in 43 groups. Progress is auto-saved locally every 15 seconds so you can continue after refresh.",
      searchLabel: "Search dimensions",
      searchPlaceholder: "search dimensions...",
      languageLabel: "Language",
      prev: "← Previous",
      next: "Next →",
      saveDraft: "Save draft",
      fillDefaults: "Fill group defaults",
      generateReport: "Reveal My MatrAIx Persona",
      download: "Download attributes.json",
      reset: "Reset group",
      reportKicker: "MatrAIx 36 · Persona report",
      primaryArchetype: "Primary archetype",
      secondaryArchetype: "Secondary blend",
      profileFidelity: "Profile fidelity",
      reportOverview: "Core profile",
      reportStrengths: "Natural strengths",
      reportBlindSpots: "Watch-outs",
      reportWork: "Work & creation",
      reportRelationships: "Relationships",
      reportPressure: "Under pressure",
      reportGrowth: "Growth edge",
      reportAi: "AI operating manual",
      reportBlend: "Your blend",
      reportMatrix: "Your matching matrix",
      reportDrives: "Core drives · why you move",
      reportModes: "Operating modes · how you move",
      reportEvidence: "Strongest matching signals",
      reportEvidenceEmpty: "Answer more core personality questions to reveal matching signals.",
      reportCoverage: "core signal coverage",
      reportDownload: "Download Persona Report",
      reportPrint: "Print / Save PDF",
      reportBack: "Back to survey",
      reportReady: "Your MatrAIx persona report is ready.",
      reportNeedAnswers: "Answer at least one core personality, values, decision, or cognitive-style question before revealing your MatrAIx.",
      reportDownloadFirst: "Download the current attributes.json before revealing your MatrAIx Persona.",
      reportEngineMissing: "The MatrAIx report engine could not be loaded.",
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
      fillDone: "Defaults filled for this group.",
      resetDone: "Current group reset.",
      resetConfirm: "Reset answers, smart answers, and skip state for this group only?",
      exportMissing: "Cannot export yet. Missing values: ",
      exportReady: "attributes.json downloaded.",
      exportPartial: "attributes.json downloaded. Unfilled saved as null: ",
      loadError: "Failed to load dimensions or language pack.",
      toggleLang: "Switch language",
      missingIds: "Required survey DOM nodes are missing."
    },
    zh: {
      title: "Persona 属性问卷",
      subtitle: "完成全部 1290 个 persona 维度（43 个分组）。进度每 15 秒自动保存在本地，刷新后可继续填写。",
      searchLabel: "搜索维度",
      searchPlaceholder: "搜索维度...",
      languageLabel: "语言",
      prev: "← 上一组",
      next: "下一组 →",
      saveDraft: "保存草稿",
      fillDefaults: "填充本组默认值",
      generateReport: "揭示我的 MatrAIx Persona",
      download: "下载 attributes.json",
      reset: "重置本组",
      reportKicker: "MatrAIx 36 · 人格报告",
      primaryArchetype: "核心人格",
      secondaryArchetype: "次级人格组合",
      profileFidelity: "画像可信度",
      reportOverview: "核心画像",
      reportStrengths: "自然优势",
      reportBlindSpots: "潜在盲点",
      reportWork: "工作与创造",
      reportRelationships: "人际关系",
      reportPressure: "压力下的你",
      reportGrowth: "成长方向",
      reportAi: "AI 协作说明书",
      reportBlend: "你的人格组合",
      reportMatrix: "你的人格匹配矩阵",
      reportDrives: "核心驱动力 · 你为何行动",
      reportModes: "行动模式 · 你如何行动",
      reportEvidence: "最强匹配信号",
      reportEvidenceEmpty: "回答更多核心人格问题后，将显示匹配依据。",
      reportCoverage: "核心信号覆盖率",
      reportDownload: "下载人格报告",
      reportPrint: "打印 / 保存 PDF",
      reportBack: "返回问卷",
      reportReady: "你的 MatrAIx 人格报告已生成。",
      reportNeedAnswers: "请至少回答一道核心人格、价值观、决策或认知风格问题，再揭示你的 MatrAIx。",
      reportDownloadFirst: "请先下载当前版本的 attributes.json，再揭示你的 MatrAIx Persona。",
      reportEngineMissing: "无法加载 MatrAIx 人格报告引擎。",
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
      fillDone: "已为本组填入默认值。",
      resetDone: "已重置当前分组。",
      resetConfirm: "确定仅重置当前分组的答案、智能答案和跳过状态吗？",
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
      /* superseded by values-motivation-smart-bank.js */
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
      /* superseded by worldview-smart-bank.js — kept empty to avoid _default fallback */
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
    downloadedFingerprint: "",
    result: null,
    reportVisible: false,
    saveTimer: null
  };

  const dom = {};
  const REQUIRED_IDS = [
    "titleText", "subtitleText", "searchLabel", "dimensionSearch", "languageLabel", "langToggle",
    "progressStats", "groupTabs", "groupContent", "prevGroupBtn", "nextGroupBtn",
    "saveDraftBtn", "fillDefaultsBtn", "generateReportBtn", "downloadBtn", "resetBtn", "status",
    "reportPanel", "reportContent"
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
    dom.status.dataset.tone = kind;
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
      fetch("./data/dimensions.json"),
      fetch("./i18n/zh.json?v=20")
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
  function optionLabelForUi(dim, value) {
    if (value === NOT_APPLICABLE_VALUE) {
      return state.lang === "zh" ? "无" : "N/A";
    }
    const pack = zhPack();
    if (!pack) return value;
    const dimId = typeof dim === "string" ? dim : dim?.id;
    const override = dimId && pack.valueOverrides?.[dimId]?.[value];
    if (override) return override;
    return pack.values[value] ?? value; // exact match only; untranslated stays English
  }
  function categoryLabel(category) {
    if (state.lang === "zh") return state.i18n?.categories?.[category] ?? category;
    return category;
  }

  function isAllowedDimensionValue(dim, value) {
    return value === NOT_APPLICABLE_VALUE || (dim.values || []).includes(value);
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

  function answersFingerprint() {
    let hash = 2166136261;
    for (const dim of state.dimensions) {
      const token = `${dim.id}:${state.answers[dim.id] ?? ""}|`;
      for (let i = 0; i < token.length; i += 1) {
        hash ^= token.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
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
      downloadedFingerprint: state.downloadedFingerprint,
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
      if (isAllowedDimensionValue(dim, value)) {
        restoredAnswers[dim.id] = value;
      }
    }

    state.answers = restoredAnswers;
    state.smartAnswers = raw.smartAnswers && typeof raw.smartAnswers === "object" ? raw.smartAnswers : {};
    state.personalityGauge = sanitizeGauge(raw.personalityGauge || {});
    state.manualExpanded = raw.manualExpanded && typeof raw.manualExpanded === "object" ? raw.manualExpanded : {};
    state.interactiveAnswers = raw.interactiveAnswers && typeof raw.interactiveAnswers === "object" ? raw.interactiveAnswers : {};
    state.skippedCategories = raw.skippedCategories && typeof raw.skippedCategories === "object" ? raw.skippedCategories : {};
    state.downloadedFingerprint = typeof raw.downloadedFingerprint === "string" ? raw.downloadedFingerprint : "";
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
    dom.generateReportBtn.textContent = t("generateReport");
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
    if (category === "Worldview: Beliefs" && window.WORLDVIEW_SMART?.questions) {
      return window.WORLDVIEW_SMART.questions;
    }
    if (category === "Values & Motivation" && window.VALUES_MOTIVATION_SMART?.questions) {
      return window.VALUES_MOTIVATION_SMART.questions;
    }
    if (category === "Personality: Character" && window.PERSONALITY_CHARACTER_SMART?.questions) {
      return window.PERSONALITY_CHARACTER_SMART.questions;
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
    if (category === "Worldview: Beliefs" && window.WORLDVIEW_SMART?.intro) {
      return window.WORLDVIEW_SMART.intro;
    }
    if (category === "Values & Motivation" && window.VALUES_MOTIVATION_SMART?.intro) {
      return window.VALUES_MOTIVATION_SMART.intro;
    }
    if (category === "Personality: Character" && window.PERSONALITY_CHARACTER_SMART?.intro) {
      return window.PERSONALITY_CHARACTER_SMART.intro;
    }
    return null;
  }

  function usesSmartMapInference(category) {
    return category === "Linguistic: Communication"
      || category === "Developer: Agent Adoption"
      || category === "Worldview: Beliefs"
      || category === "Values & Motivation"
      || category === "Personality: Character";
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
      const options = [...(dim.values || []), NOT_APPLICABLE_VALUE].map(value => {
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
    if (state.reportVisible) {
      generateReport(false);
    }
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
      || (category === "Developer: Agent Adoption" && window.AGENT_ADOPTION_SMART?.questions?.length)
      || (category === "Worldview: Beliefs" && window.WORLDVIEW_SMART?.questions?.length)
      || (category === "Values & Motivation" && window.VALUES_MOTIVATION_SMART?.questions?.length)
      || (category === "Personality: Character" && window.PERSONALITY_CHARACTER_SMART?.questions?.length);
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
      inferred = inferSmartMapDimensions(category);
    } else if (category === "Personality: Character") {
      inferred = inferSmartMapDimensions(category);
    } else if (category === "Linguistic: Communication") {
      inferred = inferCommunicationDimensions(category);
    } else if (category === "Developer: Agent Adoption") {
      inferred = inferAgentAdoptionDimensions(category);
    } else if (category === "Worldview: Beliefs") {
      inferred = inferSmartMapDimensions(category);
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
    if (!isAllowedDimensionValue(dim, value)) return;
    state.answers[dimId] = value;
    queueSave();
    renderProgressStats();
    renderTabs();
  }

  function fillDefaults() {
    const category = getCurrentCategory();
    const dims = state.grouped[category] || [];
    for (const dim of dims) {
      const fallback = defaultForDimension(dim);
      if (fallback != null) {
        state.answers[dim.id] = fallback;
      }
    }
    queueSave();
    setStatus(`${t("fillDone")} (${categoryLabel(category)})`, "ok");
    renderAll();
  }

  function resetSurvey() {
    const category = getCurrentCategory();
    const accepted = window.confirm(t("resetConfirm"));
    if (!accepted) return;
    const dims = state.grouped[category] || [];
    for (const dim of dims) {
      delete state.answers[dim.id];
    }
    delete state.smartAnswers[category];
    delete state.interactiveAnswers[category];
    delete state.skippedCategories[category];
    delete state.manualExpanded[category];
    if (category === "Personality: Big Five") {
      state.personalityGauge = { O: 0, C: 0, E: 0, A: 0, N: 0 };
    }
    queueSave();
    setStatus(`${t("resetDone")} (${categoryLabel(category)})`, "ok");
    renderAll();
  }

  function resultLabel(localized) {
    return localized?.[state.lang] || localized?.en || "";
  }

  function renderScoreRows(items, definitions) {
    const max = Math.max(0, ...items.map(item => Number(item.score) || 0));
    return items.map(item => {
      const label = resultLabel(definitions[item.id]?.name) || item.id;
      const relative = max > 0 ? item.score / max : 0;
      const width = Math.round(8 + relative * 92);
      const displayScore = max > 0 ? Math.round(45 + relative * 50) : 45;
      return `<div class="report-score-row">
        <span class="report-match-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
        <span class="report-score-track"><span class="report-score-fill" style="width:${width}%"></span></span>
        <span class="report-score-value">${displayScore}</span>
      </div>`;
    }).join("");
  }

  function evidenceLabel(item) {
    if (item.dimension.startsWith("big5_")) {
      const group = item.dimension.replace("big5_", "").replace(/_/g, " ");
      const groupZh = {
        openness: "开放性",
        conscientiousness: "尽责性",
        extraversion: "外向性",
        agreeableness: "宜人性"
      }[group] || group;
      const names = {
        en: `Big Five ${group}`,
        zh: `大五人格 ${groupZh}`
      };
      return names[state.lang];
    }
    const dim = state.dimById[item.dimension];
    if (!dim) return item.dimension.replace(/_/g, " ");
    const label = dimensionLabelForUi(dim);
    const valueZh = {
      Achievement: "成就",
      Security: "安全",
      Autonomy: "自主",
      Community: "社群",
      Novelty: "新奇",
      Tradition: "传统"
    }[item.value];
    const value = state.lang === "zh" && valueZh ? valueZh : optionLabelForUi(dim, item.value);
    return `${label}: ${value}`;
  }

  function reportCard(label, title, content, classes = "") {
    return `<article class="report-card ${classes}">
      <div class="report-section-label">${escapeHtml(label)}</div>
      <h3>${escapeHtml(title)}</h3>
      ${content}
    </article>`;
  }

  function renderReport() {
    const engine = window.MATRAIX_ARCHETYPES;
    if (!engine || !state.result) return;
    const result = state.result;
    const report = engine.reportFor(result, state.lang);
    const list = items => `<ul class="report-list">${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    const primaryName = resultLabel(result.primary.name);
    const secondaryName = resultLabel(result.secondary.name);
    const uniqueEvidence = result.evidence.filter((item, index, items) =>
      items.findIndex(candidate => candidate.dimension === item.dimension && candidate.value === item.value) === index
    );
    const evidence = uniqueEvidence.length
      ? `<div class="report-evidence">${uniqueEvidence.map(item => `<span class="report-evidence-chip">${escapeHtml(evidenceLabel(item))}</span>`).join("")}</div>`
      : `<p>${escapeHtml(t("reportEvidenceEmpty"))}</p>`;

    dom.reportContent.innerHTML = `
      <div class="report-hero">
        <div>
          <p class="report-kicker">${escapeHtml(t("reportKicker"))}</p>
          <h2 class="report-title">${escapeHtml(report.name)}</h2>
          <p class="report-tagline">${escapeHtml(report.tagline)}</p>
        </div>
        <aside class="report-identity-card">
          <div class="report-signature">${escapeHtml(result.signature)}</div>
          <div class="report-meta-row"><span>${escapeHtml(t("primaryArchetype"))}</span><strong>${escapeHtml(primaryName)} · ${result.primary.match}</strong></div>
          <div class="report-meta-row"><span>${escapeHtml(t("secondaryArchetype"))}</span><strong>${escapeHtml(secondaryName)} · ${result.secondary.match}</strong></div>
          <div class="report-meta-row"><span>${escapeHtml(t("profileFidelity"))}</span><strong>${result.confidence}%</strong></div>
        </aside>
      </div>
      <div class="report-body">
        ${reportCard("01", t("reportOverview"), `<p>${escapeHtml(report.overview)}</p>`, "wide accent")}
        ${reportCard("02", t("reportStrengths"), list(report.strengths))}
        ${reportCard("03", t("reportBlindSpots"), list(report.blindSpots))}
        ${reportCard("04", t("reportBlend"), `<p>${escapeHtml(report.blend)}</p>`, "wide")}
        ${reportCard("05", t("reportWork"), `<p>${escapeHtml(report.work)}</p>`)}
        ${reportCard("06", t("reportRelationships"), `<p>${escapeHtml(report.relationships)}</p>`)}
        ${reportCard("07", t("reportPressure"), `<p>${escapeHtml(report.underPressure)}</p>`)}
        ${reportCard("08", t("reportGrowth"), `<p>${escapeHtml(report.growth)}</p>`)}
        ${reportCard("09", t("reportAi"), `<p>${escapeHtml(report.aiCollaboration)}</p>`, "wide accent")}
        ${reportCard("10", t("reportMatrix"), `
          <div class="report-score-grid">
            <div class="report-score-group"><h4>${escapeHtml(t("reportDrives"))}</h4>${renderScoreRows(result.drives, engine.drives)}</div>
            <div class="report-score-group"><h4>${escapeHtml(t("reportModes"))}</h4>${renderScoreRows(result.modes, engine.modes)}</div>
          </div>`, "wide")}
        ${reportCard("11", t("reportEvidence"), `${evidence}<p class="report-disclaimer">${result.coverage}% ${escapeHtml(t("reportCoverage"))}</p>`, "wide")}
      </div>
      <div class="report-actions">
        <button type="button" class="btn btn-solid" data-report-action="download">${escapeHtml(t("reportDownload"))}</button>
        <button type="button" class="btn btn-ghost" data-report-action="print">${escapeHtml(t("reportPrint"))}</button>
        <button type="button" class="btn btn-ghost" data-report-action="close">${escapeHtml(t("reportBack"))}</button>
      </div>
      <p class="report-disclaimer">${escapeHtml(report.disclaimer)}</p>`;
  }

  function generateReport(shouldScroll = true) {
    const engine = window.MATRAIX_ARCHETYPES;
    if (!engine) {
      setStatus(t("reportEngineMissing"), "error");
      return;
    }
    if (!answeredCountOverall()) {
      state.reportVisible = false;
      dom.reportPanel.hidden = true;
      setStatus(t("reportNeedAnswers"), "warn");
      return;
    }
    if (!state.downloadedFingerprint || state.downloadedFingerprint !== answersFingerprint()) {
      state.reportVisible = false;
      dom.reportPanel.hidden = true;
      setStatus(t("reportDownloadFirst"), "warn");
      return;
    }
    const result = engine.match(state.answers, {
      skippedGroups: Object.keys(state.skippedCategories).length
    });
    if (!result.relevantAnswered) {
      state.reportVisible = false;
      dom.reportPanel.hidden = true;
      setStatus(t("reportNeedAnswers"), "warn");
      return;
    }
    state.result = result;
    state.reportVisible = true;
    dom.reportPanel.hidden = false;
    renderReport();
    setStatus(t("reportReady"), "ok");
    if (shouldScroll) {
      dom.reportPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function buildPersonaReportPayload() {
    const engine = window.MATRAIX_ARCHETYPES;
    const result = state.result;
    if (!engine || !result) return null;
    return {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      signature: result.signature,
      archetype: {
        primary: {
          id: result.primary.id,
          code: result.primary.code,
          name: result.primary.name,
          match: result.primary.match
        },
        secondary: {
          id: result.secondary.id,
          code: result.secondary.code,
          name: result.secondary.name,
          match: result.secondary.match
        }
      },
      fidelity: result.confidence,
      scores: {
        drives: Object.fromEntries(result.drives.map(item => [item.id, Number(item.score.toFixed(3))])),
        operatingModes: Object.fromEntries(result.modes.map(item => [item.id, Number(item.score.toFixed(3))]))
      },
      matchingEvidence: result.evidence,
      report: {
        en: engine.reportFor(result, "en"),
        zh: engine.reportFor(result, "zh")
      },
      attributes: Object.fromEntries(state.dimensions.map(dim => [dim.id, state.answers[dim.id] || null]))
    };
  }

  function downloadPersonaReport() {
    if (!state.result) generateReport(false);
    const payload = buildPersonaReportPayload();
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `matraix-persona-${state.result.signature}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function handleReportClick(event) {
    const target = event.target.closest("[data-report-action]");
    if (!target) return;
    const action = target.dataset.reportAction;
    if (action === "download") {
      downloadPersonaReport();
    } else if (action === "print") {
      window.print();
    } else if (action === "close") {
      state.reportVisible = false;
      dom.reportPanel.hidden = true;
      dom.generateReportBtn.scrollIntoView({ behavior: "smooth", block: "center" });
    }
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
    state.downloadedFingerprint = answersFingerprint();
    persistState();
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

  function bindNavigationMenu() {
    const toggle = document.querySelector(".nav-toggle");
    const navLinks = document.querySelector(".nav-links");
    const nav = document.querySelector(".nav");
    if (!toggle || !navLinks || !nav) return;

    const closeMenu = () => {
      navLinks.classList.remove("active");
      toggle.classList.remove("active");
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "Menu";
    };

    toggle.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const open = navLinks.classList.toggle("active");
      toggle.classList.toggle("active", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Close" : "Menu";
    });
    navLinks.addEventListener("click", event => {
      if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("click", event => {
      if (!event.target.closest(".nav")) closeMenu();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 820) closeMenu();
    });
  }

  function bindEvents() {
    bindNavigationMenu();
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
    dom.generateReportBtn.addEventListener("click", () => generateReport(true));
    dom.downloadBtn.addEventListener("click", downloadAttributes);
    dom.resetBtn.addEventListener("click", resetSurvey);

    dom.groupContent.addEventListener("click", handleGroupContentClick);
    dom.groupContent.addEventListener("change", handleGroupContentChange);
    dom.reportPanel.addEventListener("click", handleReportClick);
  }

  async function init() {
    try {
      assertDomNodes();
      await loadDimensions();
      const restored = restoreState();
      dom.dimensionSearch.value = state.search;
      bindEvents();
      renderAll();
      window.setInterval(persistState, AUTO_SAVE_INTERVAL_MS);
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
