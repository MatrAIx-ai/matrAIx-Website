#!/usr/bin/env node
/**
 * Build i18n/zh.json — display-only Chinese for the persona survey.
 * Exact-key lookups only. No runtime substring replacement.
 *
 * Policy:
 * - UI copy should be Chinese wherever practical.
 * - Brand / product / language names (Chrome, Python, JavaScript, etc.) may
 *   keep Latin letters — they do NOT need forced pure-Chinese transliterations.
 * - Exported attribute values always remain English canonical keys.
 *
 * Run: node scripts/generate-i18n-zh.js
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

execFileSync(process.execPath, [path.join(__dirname, "build-i18n-extra.js")], { stdio: "inherit" });

const ROOT = path.join(__dirname, "..");
const DIMENSIONS_PATH = path.join(ROOT, "data", "dimensions.json");
const OUT_PATH = path.join(ROOT, "i18n", "zh.json");

const { dimensions } = JSON.parse(fs.readFileSync(DIMENSIONS_PATH, "utf8"));
const I18N = require("./i18n-words");
const { VALUE_EXT, ENTITY_EXT, WORD_EXT } = require("./i18n-extra");
const BATCH = require("./i18n-data/batch-fixes");

const CATEGORIES = {
  "Demographic: Core": "人口统计：核心",
  "Demographic: Cultural": "人口统计：文化",
  "Demographic: Life Events": "人口统计：生命事件",
  "Demographic: Family": "人口统计：家庭",
  "Linguistic: Language": "语言：语言能力",
  "Linguistic: Communication": "语言：沟通风格",
  "Expertise: Domains": "专业能力：领域",
  "Expertise: Skills": "专业能力：技能",
  "Professional: Career": "职业：职业阶段",
  "Professional: Industry": "职业：行业",
  "Learning: Academic": "学习：学术",
  "Learning: Style": "学习：风格",
  "Personality: Character": "人格：性格",
  "Personality: MBTI": "人格：MBTI",
  "Personality: Big Five": "人格：大五人格",
  "Personality: Relationships": "人格：关系",
  "State: Emotional": "状态：情绪",
  "Risk & Decision": "风险与决策",
  "Values & Motivation": "价值观与动机",
  "Worldview: Beliefs": "世界观：信念",
  "Behavior: Time": "行为：时间",
  "Behavior: Preferences": "行为：偏好",
  "Behavior: Habits": "行为：习惯",
  "Behavior: Work": "行为：工作",
  "Interests: Topics": "兴趣：主题",
  "Interests: Culture": "兴趣：文化",
  "Interests: Media": "兴趣：媒体",
  "Interests: Food": "兴趣：饮食",
  "Interests: Sports": "兴趣：运动",
  "Interests: Hobbies": "兴趣：爱好",
  "Health: Physical": "健康：身体",
  "Health: Fitness": "健康：健身",
  "Health: Lifestyle": "健康：生活方式",
  "Skills: Tools": "技能：工具",
  "Skills: Programming": "技能：编程",
  "Developer: Professional Context": "开发者：职业背景",
  "Developer: AI Adoption": "开发者：AI 采纳",
  "Developer: Agent Adoption": "开发者：Agent 采纳",
  "Developer: AI Workflow Tasks": "开发者：AI 工作流任务",
  "Developer: Technology Evaluation": "开发者：技术评估",
  "Developer: Community Behavior": "开发者：社区行为",
  "Developer: Open Source Behavior": "开发者：开源行为",
  "Developer: Code Maintenance": "开发者：代码维护",
};

const PREFIX_LABEL = {
  Familiarity: "熟悉度",
  Interest: "兴趣",
  Tool: "工具",
  Skill: "技能",
  Attitude: "态度",
  Language: "语言",
  Industry: "行业",
  Hobby: "爱好",
  Culture: "文化",
  Sport: "运动",
  Music: "音乐",
  Cuisine: "菜系",
  Programming: "编程语言",
  Character: "品格特质",
  Subject: "学科",
  Habit: "习惯",
  Value: "价值观",
  Film: "电影类型",
  Books: "阅读类型",
  "Pet peeve": "雷点",
  "AI task fit": "AI 任务适配",
};

/** Entity names inside "Prefix: Entity" labels — exact key only */
const ENTITY = {
  Fitness: "健身",
  Exercise: "锻炼",
  Immigration: "移民",
  Politics: "政治",
  Technology: "科技",
  Travel: "旅行",
  Cooking: "烹饪",
  Gaming: "游戏",
  Fashion: "时尚",
  Science: "科学",
  Space: "太空",
  "Machine learning": "机器学习",
  "Deep learning": "深度学习",
  Statistics: "统计学",
  "Data science": "数据科学",
  Knitting: "针织",
  Crocheting: "钩针编织",
  Pottery: "陶艺",
  Woodworking: "木工",
  Soccer: "足球",
  Basketball: "篮球",
  Baseball: "棒球",
  Tennis: "网球",
  Swimming: "游泳",
  Running: "跑步",
  English: "英语",
  Mandarin: "中文（普通话）",
  Cantonese: "中文（粤语）",
  Spanish: "西班牙语",
  Hindi: "印地语",
  Arabic: "阿拉伯语",
  French: "法语",
  Portuguese: "葡萄牙语",
  Japanese: "日语",
  German: "德语",
  Korean: "韩语",
  Italian: "意大利语",
  "United States": "美国",
  Canada: "加拿大",
  China: "中国",
  Japan: "日本",
  "South Korea": "韩国",
  India: "印度",
  Mexico: "墨西哥",
  Brazil: "巴西",
  "United Kingdom": "英国",
  France: "法国",
  Germany: "德国",
  Australia: "澳大利亚",
  Healthcare: "医疗健康",
  Finance: "金融",
  Banking: "银行",
  Retail: "零售",
  Pop: "流行",
  Rock: "摇滚",
  Jazz: "爵士",
  Classical: "古典",
  Gentrification: "中产阶层化",
};
Object.assign(ENTITY, BATCH.ENTITIES);

/** Brand / product names — keep Latin letters in zh display */
const BRAND_NAMES = new Set([
  "Chrome", "Safari", "Firefox", "Edge", "Brave",
  "Python", "JavaScript", "TypeScript", "Java", "Go", "Rust", "Ruby", "Swift", "Kotlin", "C", "C++", "C#",
  "Apple", "Android", "Google", "Windows", "Linux",
  "Instagram", "TikTok", "Facebook", "LinkedIn", "YouTube", "Reddit",
  "WhatsApp", "iMessage", "WeChat", "Telegram", "Signal", "Messenger",
  "Excel", "Figma", "Photoshop", "Illustrator", "Tableau", "Looker",
  "BNPL", "Crypto", "ADHD", "INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP",
  "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP",
  "MBTI", "TIPI", "AI", "API", "CLI", "CI/CD", "GitHub", "SMS",
]);
for (const brand of BATCH.BRAND_NAMES) BRAND_NAMES.add(brand);

const LABEL_BY_ID = {
  age_bracket: "年龄区间",
  region: "所在地区",
  gender_identity: "性别认同",
  urbanicity: "城镇化程度",
  socioeconomic_band: "社会经济层级",
  register: "方言/语体",
  att_traditional_gender_roles: "对传统性别角色的态度",
  cultural_background: "文化背景",
  att_immigration: "对移民的态度",
  att_gentrification: "态度：中产阶层化",
  primary_language: "主要语言",
  english_proficiency: "英语熟练度",
  multilingualism: "多语能力",
  topic_fitness: "对健身的兴趣",
  lstyle_exercise_freq: "锻炼频率",
  health_general_health: "总体健康状况",
  health_chronic_condition: "慢性病情况",
  health_mobility: "行动能力",
  health_vision: "视力",
  health_hearing: "听力",
  health_color_vision: "色觉",
  health_dexterity: "手部灵活性",
  health_mental_health: "心理健康",
  health_stress_level: "压力水平",
  health_energy_level: "精力水平",
  health_sleep_quality: "睡眠质量",
  health_pain_level: "慢性疼痛",
  health_medication_use: "用药情况",
  health_dietary_restriction: "饮食限制",
  health_neurodivergence: "神经多样性",
  health_caregiver_status: "照护者身份",
  health_health_literacy: "健康素养",
  health_insurance_status: "医疗保险情况",
  health_fitness_level: "体能水平",
  demo_marital_status: "婚姻状况",
  demo_children_count: "子女情况",
  demo_household_income: "家庭收入区间",
  demo_employment_status: "就业状态",
  demo_housing_status: "住房状况",
  demo_generation: "代际群体",
  demo_religion_affiliation: "宗教信仰",
  demo_sexual_orientation: "性取向",
  demo_citizenship_status: "公民身份",
  demo_ethnicity_broad: "族裔背景",
  demo_disability_status: "残障状况",
  demo_veteran_status: "退伍军人身份",
  demo_birth_order: "出生顺序",
  demo_home_language: "家庭常用语言",
  demo_political_engagement: "政治参与程度",
  demo_parental_status: "为人父母状态",
  demo_relationship_length: "关系时长",
  demo_driver_status: "驾驶状态",
  lstyle_household_size: "家庭人数",
  mbti_type: "MBTI 类型",
  dominant_trait: "主导人格特质",
  risk_tolerance: "风险承受度",
  decision_style: "决策风格",
  core_value: "核心价值观",
  political_lean: "政治倾向",
  trust_level: "信任程度",
  emotional_state: "当前情绪状态",
  tone_expected: "期望语气",
  cog_verbosity: "表达详略偏好",
  cog_formality: "正式程度",
  cog_directness: "直接程度",
  pref_work_location: "办公室 vs 远程",
  pref_team_vs_solo: "团队 vs 独立工作",
  pref_plan_vs_spontaneous: "计划性 vs 即兴",
  pref_city_vs_nature: "城市 vs 自然",
  pref_routine_vs_variety: "规律 vs 多样",
  pref_speed_vs_accuracy: "速度 vs 准确度",
  pref_quality_vs_quantity: "质量 vs 数量",
  pref_logic_vs_intuition: "逻辑 vs 直觉",
  pref_save_vs_spend: "储蓄 vs 消费",
  pref_lead_vs_follow: "领导 vs 跟随",
  pref_indoor_vs_outdoor: "室内 vs 户外",
  pref_early_vs_late: "早期 vs 晚期采纳者",
  pref_text_vs_call: "短信 vs 通话",
  pref_big_group_vs_one_on_one: "大群体 vs 一对一",
  pref_novelty_vs_familiarity: "新奇 vs 熟悉",
  pref_detail_brief_vs_full: "简略 vs 详尽",
  pref_competition_vs_collab: "竞争 vs 合作",
  pref_stability_vs_change: "稳定 vs 变化",
  lstyle_sleep_schedule: "作息/睡眠时间",
  lstyle_diet_type: "饮食类型",
  lstyle_alcohol_use: "饮酒情况",
  lstyle_smoking: "吸烟/电子烟",
  lstyle_caffeine: "咖啡因摄入",
  lstyle_cooking_freq: "做饭频率",
  lstyle_shopping_style: "购物风格",
  lstyle_travel_freq: "旅行频率",
  lstyle_commute_mode: "通勤方式",
  lstyle_pet_ownership: "养宠物情况",
  lstyle_work_schedule: "工作时间安排",
  lstyle_screen_time: "每日屏幕时间",
  lstyle_social_battery: "社交电量",
  lstyle_planning_horizon: "计划时间跨度",
  lstyle_punctuality: "守时程度",
  lstyle_tidiness: "整洁程度",
  lstyle_frugality: "消费 vs 储蓄",
  lstyle_giving: "慈善捐赠",
  lstyle_news_freq: "新闻消费频率",
  lstyle_reading_freq: "阅读频率",
  lstyle_gaming_freq: "游戏频率",
  lstyle_streaming_hours: "每周流媒体时长",
  lstyle_music_listening: "听音乐",
  lstyle_podcast_listening: "听播客",
  lstyle_primary_social: "主要社交平台",
  lstyle_primary_messenger: "主要通讯工具",
  lstyle_device_ecosystem: "设备生态",
  lstyle_browser: "主要浏览器",
  lstyle_payment_pref: "支付偏好",
  lstyle_banking_style: "银行服务风格",
  lstyle_investment_style: "投资风格",
  lstyle_subscription_count: "活跃订阅数量",
  lstyle_coffee_ritual: "咖啡习惯",
  lstyle_fashion_sense: "时尚品味",
  lstyle_hobby_intensity: "爱好投入强度",
  lstyle_vacation_style: "度假风格",
  lstyle_morning_routine: "晨间习惯",
  lstyle_volunteering: "志愿服务",
  time_pressure: "时间紧迫程度",
  modality_pref: "偏好的回答形式",
  accessibility_needs: "所需无障碍支持",
  media_diet: "主要信息来源",
  cog_humor: "幽默风格",
  cog_detail_orientation: "细节取向",
  cog_abstraction: "抽象 vs 具体",
  cog_optimism: "乐观程度",
  cog_patience: "耐心程度",
  cog_curiosity: "好奇心",
  cog_skepticism: "怀疑倾向",
  cog_open_mindedness: "开放程度",
  cog_assertiveness: "果断性",
  cog_emotional_expressiveness: "情绪表达",
  cog_conflict_approach: "冲突处理方式",
  cog_feedback_receptiveness: "对反馈的接受度",
  cog_ambiguity_tolerance: "对模糊的容忍度",
  cog_perfectionism: "完美主义",
  cog_procrastination: "拖延倾向",
  cog_multitasking: "多任务处理",
  cog_attention_span: "注意力持续时间",
  cog_learning_pace: "学习节奏",
  cog_question_asking: "提问习惯",
  cog_decision_speed: "决策速度",
  cog_confidence_calibration: "自信校准",
  cog_numeracy_comfort: "数字/数理舒适度",
  cog_reading_vs_watching: "阅读 vs 观看",
  cog_visual_vs_verbal: "视觉 vs 语言思维",
  cog_big_picture_vs_detail: "大局观 vs 细节",
  cog_risk_framing: "风险表述方式",
  cog_empathy_expression: "共情表达",
  cog_storytelling: "讲故事倾向",
  cog_precision_of_language: "语言精确度",
  cog_use_of_jargon: "术语使用",
  cog_emoji_use: "表情符号使用",
  cog_politeness: "礼貌程度",
  linkedin_activity: "LinkedIn 活跃度",
  values_priority: "核心价值观优先级",
  coding_ai_usage_frequency: "AI 编程工具使用频率",
  coding_ai_sentiment: "对 AI 编程工具的态度",
  coding_ai_output_trust: "对 AI 生成代码的信任度",
  coding_ai_complexity_comfort: "AI 处理复杂任务的舒适度",
  coding_ai_job_threat_perception: "AI 对工作岗位的威胁感知",
  coding_ai_learning_source: "AI 编程工具的学习来源",
  human_help_boundary_for_ai_coding: "仍需要人工帮助的边界",
  future_developer_skill_belief: "未来仍重要的开发者技能",
  coding_tool_ai_capability_importance: "编程工具 AI 能力重要性",
  coding_tool_api_completeness_importance: "编程工具 API 完整度重要性",
  coding_tool_reliability_latency_importance: "编程工具可靠性与延迟重要性",
  coding_tool_open_source_importance: "编程工具开源属性重要性",
  coding_tool_security_privacy_blocker: "编程工具安全与隐私阻障",
  coding_tool_ethics_blocker: "编程工具伦理阻障",
  coding_tool_alternative_sensitivity: "编程工具替代方案敏感度",
  coding_tool_obsolescence_blocker: "编程工具过时/淘汰阻障",
  coding_agent_usage_frequency: "编程 Agent 使用频率",
  coding_agent_autonomy_preference: "编程 Agent 自主程度偏好",
  coding_agent_workflow_impact: "编程 Agent 对工作流的影响",
  coding_agent_adoption_barrier: "编程 Agent 采纳障碍",
  coding_agent_control_expectation: "编程 Agent 控制预期",
  coding_agent_explanation_preference: "编程 Agent 解释偏好",
  coding_agent_context_sharing_comfort: "与 Agent 共享上下文的舒适度",
  coding_agent_security_expectation: "编程 Agent 安全预期",
  coding_agent_memory_preference: "编程 Agent 记忆偏好",
  coding_agent_tool_integration_preference: "编程 Agent 工具集成偏好",
  coding_agent_failure_tolerance: "编程 Agent 失败容忍度",
  open_source_activity_level: "开源活跃度",
  github_contribution_mode: "GitHub 贡献模式",
  pr_collaboration_style: "Pull Request 协作风格",
  issue_engagement_style: "Issue 参与风格",
  code_review_participation_level: "代码评审参与程度",
  commit_cadence_style: "提交节奏风格",
  release_maintenance_orientation: "发布与维护取向",
  code_complexity_tolerance: "代码复杂度容忍度",
  code_modularity_preference: "代码模块化偏好",
  code_type_system_orientation: "类型系统取向",
  code_api_design_orientation: "API 设计取向",
  code_security_review_habit: "代码安全审查习惯",
  code_observability_habit: "代码可观测性习惯",
  bug_fix_scope_preference: "缺陷修复范围偏好",
  bug_fix_test_behavior: "缺陷修复时的测试行为",
  debugging_strategy: "调试策略",
  codebase_onboarding_style: "代码库上手方式",
  life_stage: "生活阶段",
  major_life_events: "重大生活事件",
  lifex_childhood_environment: "童年成长环境",
  lifex_geographic_mobility: "地理流动性",
  lifex_travel_breadth: "旅行广度",
  lifex_career_path_shape: "职业路径形态",
  lifex_education_journey: "教育经历",
  lifex_financial_trajectory: "财务轨迹",
  lifex_adversity_level: "经历逆境程度",
  lifex_immigration_generation: "移民代际",
  lifex_military_history: "军旅经历",
  lifex_entrepreneurship_history: "创业经历",
  lifex_relationship_history: "感情/婚恋经历",
  lifex_parenting_journey: "育儿历程",
  lifex_health_journey: "健康历程",
  lifex_loss_experience: "丧亲/失去经历",
  lifex_faith_journey: "信仰历程",
  lifex_cultural_exposure: "跨文化经历",
  lifex_formative_decade: "成长关键年代",
  lifex_public_recognition: "公众知名度",
  lifex_service_history: "社区/公益服务经历",
  lifex_turning_point: "人生转折点",
  lifex_languages_lifetime: "一生掌握的语言数",
  lifex_hometown_tie: "与故乡的联系",
};
Object.assign(LABEL_BY_ID, BATCH.LABEL_BY_ID);

/** Explicit Chinese descriptions by dimension id (overrides pattern rules). */
const DESC_BY_ID = {
  att_gentrification: "对城市旧区改造与阶层置换（gentrification）的态度。",
  coding_ai_usage_frequency: "在软件开发流程中使用 AI 工具的频率。",
  coding_ai_sentiment: "对将 AI 工具纳入开发工作流的总体态度。",
  coding_ai_output_trust: "在依赖 AI 生成内容之前，对产出的信任程度。",
  coding_ai_complexity_comfort: "将复杂开发任务交给 AI 工具时的舒适程度。",
  coding_ai_job_threat_perception: "是否认为 AI 对当前或未来的开发者角色构成威胁。",
  coding_ai_learning_source: "学习 AI 编程工具或 AI 编程实践的主要途径。",
  human_help_boundary_for_ai_coding: "即使 AI 能完成许多编码任务，仍更倾向寻求人工帮助的情境。",
  future_developer_skill_belief: "在 AI 编程工具日益强大时，认为仍将保持价值的技能。",
  coding_tool_ai_capability_importance: "AI 集成或 Agent 能力对选择开发工具的吸引程度。",
  coding_tool_api_completeness_importance: "API 是否完善、健壮对采纳该技术的影响程度。",
  coding_tool_reliability_latency_importance: "评估工具时，对可靠性、可用性与低延迟的重视程度。",
  coding_tool_open_source_importance: "开源状态或开源生态关联对选择工具的吸引程度。",
  coding_tool_security_privacy_blocker: "安全、隐私或合规顾虑导致拒绝使用该工具的程度。",
  coding_tool_ethics_blocker: "伦理顾虑导致拒绝某技术或 AI 编程产品的程度。",
  coding_tool_alternative_sensitivity: "是否存在更好替代方案对采纳意愿的影响程度。",
  coding_tool_obsolescence_blocker: "技术过时或将被淘汰导致拒绝使用该工具的程度。",
  coding_agent_usage_frequency: "使用 AI Agent 进行开发或相关技术工作的频率。",
  coding_agent_autonomy_preference: "对编程 Agent 在规划、编辑、测试或执行任务时自主程度的偏好。",
  coding_agent_workflow_impact: "AI Agent 对该 persona 开发工作流改变的程度。",
  coding_agent_adoption_barrier: "阻碍该 persona 采纳编程 Agent 的主要因素。",
  coding_agent_control_expectation: "在 Agent 修改文件或运行命令前，期望拥有的显式控制程度。",
  coding_agent_explanation_preference: "希望编程 Agent 在工作过程中提供解释的程度。",
  coding_agent_context_sharing_comfort: "愿意与编程 Agent 共享项目或仓库上下文的程度。",
  coding_agent_security_expectation: "对编程 Agent 在安全、隐私和密钥处理方面的期望。",
  coding_agent_memory_preference: "是否希望编程 Agent 跨会话记住项目、决策或工作风格。",
  coding_agent_tool_integration_preference: "偏好的编程 Agent 产品形态或集成入口。",
  coding_agent_failure_tolerance: "对 Agent 产出不完美、返工或回滚的容忍程度。",
  open_source_activity_level: "可观察到的开源参与总体水平。",
  github_contribution_mode: "GitHub 式开发行为的主要类型。",
  pr_collaboration_style: "典型的 Pull Request 规模、节奏与协作方式。",
  issue_engagement_style: "参与 Issue、缺陷报告和功能讨论的方式。",
  code_review_participation_level: "在代码评审流程中的活跃程度。",
  commit_cadence_style: "典型的提交规模与节奏。",
  release_maintenance_orientation: "在发布、维护、依赖更新或运维 ownership 中的参与程度。",
  code_complexity_tolerance: "在倾向简化之前，能容忍的代码结构/分支/概念复杂度。",
  code_modularity_preference: "将代码拆分为模块、组件、包等更小单元的偏好。",
  code_type_system_orientation: "对静态类型、渐进类型、动态类型或边界类型注解的偏好。",
  code_api_design_orientation: "构建软件时设计内部或公开 API 的倾向。",
  code_security_review_habit: "审查代码中安全、隐私、密钥和滥用场景的一致程度。",
  code_observability_habit: "在构建软件时添加日志、指标、追踪或诊断的频率。",
  bug_fix_scope_preference: "修复缺陷时偏好的变更范围。",
  bug_fix_test_behavior: "修复缺陷时添加或更新测试的频率。",
  debugging_strategy: "诊断代码故障或不明行为时的主要方法。",
  codebase_onboarding_style: "学习陌生仓库或接手代码库时的通常方式。",
  life_stage: "当前所处的人生阶段。",
  major_life_events: "塑造其世界观的关键人生经历。",
  lifex_childhood_environment: "童年时期的成长与家庭环境。",
  lifex_geographic_mobility: "一生中跨地区/跨国迁居的程度与模式。",
  lifex_travel_breadth: "旅行与跨国经历的广度。",
  lifex_career_path_shape: "职业发展路径的整体形态（线性、转行、创业等）。",
  lifex_education_journey: "受教育路径与方式（传统、成人回归、自学等）。",
  lifex_financial_trajectory: "长期财务状况的变化趋势。",
  lifex_adversity_level: "人生中遭遇逆境与困难的程度。",
  lifex_immigration_generation: "在移民家庭或本土多代背景中的代际位置。",
  lifex_military_history: "本人或家庭的军旅/服役经历。",
  lifex_entrepreneurship_history: "创业或经营企业的经历。",
  lifex_relationship_history: "长期感情与婚恋经历概况。",
  lifex_parenting_journey: "为人父母及子女成长阶段的经历。",
  lifex_health_journey: "重大健康事件或长期健康管理经历。",
  lifex_loss_experience: "失去亲人或重要关系的经历。",
  lifex_faith_journey: "宗教信仰或精神信念的变化历程。",
  lifex_cultural_exposure: "跨文化接触与多元文化成长经历。",
  lifex_formative_decade: "人格与价值观形成的关键年代。",
  lifex_public_recognition: "在本地、行业或公众层面的知名度。",
  lifex_service_history: "志愿服务、社区参与或公共事务经历。",
  lifex_turning_point: "影响人生方向的关键转折点。",
  lifex_languages_lifetime: "一生中学会并使用过的语言数量。",
  lifex_hometown_tie: "与故乡/成长地保持的联系程度。",
};

const BIG5_FACET = {
  imagination: "想象力",
  artistic_interest: "艺术兴趣",
  emotionality: "情感丰富度",
  adventurousness: "冒险性",
  intellect: "求知欲",
  liberalism: "自由开放度",
  self_efficacy: "自我效能",
  orderliness: "条理性",
  dutifulness: "尽责性",
  achievement_striving: "成就动机",
  self_discipline: "自律",
  cautiousness: "谨慎性",
  friendliness: "友善",
  gregariousness: "合群性",
  assertiveness: "果断性",
  activity_level: "活跃程度",
  excitement_seeking: "寻求刺激",
  cheerfulness: "愉悦感",
  trust: "信任倾向",
  morality: "道德感",
  altruism: "利他",
  cooperation: "合作性",
  modesty: "谦逊",
  sympathy: "同情心",
  anxiety: "焦虑倾向",
  anger: "易怒性",
  depression: "抑郁倾向",
  self_consciousness: "自我意识",
  immoderation: "冲动性",
  vulnerability: "情绪脆弱性",
};

/** Exact English value → Chinese display label */
const VALUES = {
  "Prefer not to say": "不愿透露",
  "Self-described": "自行描述",
  Woman: "女性",
  Man: "男性",
  "Non-binary": "非二元",
  None: "无",
  Yes: "是",
  No: "否",
  Maybe: "可能",
  Neutral: "中立",
  Passionate: "非常热衷",
  Interested: "感兴趣",
  Indifferent: "无感",
  Averse: "反感",
  Expert: "专家",
  Proficient: "熟练",
  Familiar: "熟悉",
  Aware: "有所了解",
  Master: "精通",
  Advanced: "高级",
  Intermediate: "中级",
  Beginner: "初学者",
  "Power user": "重度用户",
  Regular: "常用",
  Occasional: "偶尔使用",
  "Tried it": "尝试过",
  "Never used": "从未使用",
  "Very high": "很高",
  High: "高",
  Average: "中等",
  Low: "低",
  "Very low": "很低",
  Moderate: "中等",
  Excellent: "优秀",
  Good: "良好",
  Fair: "一般",
  Poor: "较差",
  Thriving: "状态良好",
  Stable: "稳定",
  Struggling: "较为吃力",
  "In crisis": "处于危机中",
  Comprehensive: "全面覆盖",
  Basic: "基础",
  Minimal: "最低覆盖",
  Uninsured: "无保险",
  Neurotypical: "神经典型",
  ADHD: "ADHD",
  Autistic: "自闭症谱系",
  Dyslexic: "阅读障碍",
  Other: "其他",
  "Not a caregiver": "非照护者",
  "Child caregiver": "照护儿童",
  "Elder caregiver": "照护老人",
  Both: "两者兼有",
  "Individualist (Western)": "个人主义（西方）",
  "Collectivist (East Asian)": "集体主义（东亚）",
  "South Asian": "南亚文化",
  Latin: "拉丁文化",
  African: "非洲文化",
  "Middle Eastern": "中东文化",
  Indigenous: "原住民文化",
  "Mixed / diaspora": "混合/离散群体文化",
  Unfamiliar: "不熟悉",
  Native: "母语者/本地",
  "Lived there": "曾长期居住",
  Visited: "曾到访",
  Studied: "曾学习了解",
  Love: "非常喜欢",
  Like: "喜欢",
  Dislike: "不喜欢",
  Avoid: "尽量避开",
  Play: "经常参与",
  Follow: "关注/追随",
  Casual: "偶尔接触",
  Enthusiast: "爱好者",
  Positive: "积极支持",
  Skeptical: "持怀疑态度",
  Opposed: "反对",
  Never: "从不",
  Rarely: "很少",
  Sometimes: "有时",
  Often: "经常",
  Always: "总是",
  Daily: "每天",
  Weekly: "每周",
  Monthly: "每月",
  Annually: "每年",
  Single: "单身",
  "In a relationship": "恋爱中",
  Engaged: "积极参与",
  Married: "已婚",
  Divorced: "离异",
  Widowed: "丧偶",
  "Only child": "独生子女",
  "Folk / traditional": "民间/传统宗教",
  "Citizen by birth": "出生公民",
  "No disability": "无残疾",
  "Prefers not to say": "不愿透露",
  "Parent of minors": "有未成年子女",
  // Demographic: Core — extended (fix Chinglish)
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
  "Gen Alpha": "Alpha 世代",
  "Gen Z": "Z 世代",
  Millennial: "千禧一代",
  "Gen X": "X 世代",
  Boomer: "婴儿潮一代",
  Silent: "静默世代",
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
  "Full-time": "全职",
  "Part-time": "兼职",
  "Self-employed": "自雇/个体经营",
  Student: "学生",
  Unemployed: "失业",
  Retired: "退休",
  Homemaker: "全职在家",
  "Dense urban": "高密度城市",
  Suburban: "郊区",
  "Small town": "小城镇",
  Rural: "乡村",
  "Low income": "低收入",
  Middle: "中等",
  "High income": "高收入",
  Monolingual: "单语",
  Bilingual: "双语",
  "Trilingual+": "三语及以上",
  "Fluent (C1-C2)": "流利（C1-C2）",
  "Intermediate (B1-B2)": "中级（B1-B2）",
  "Basic (A1-A2)": "基础（A1-A2）",
  "Lives alone": "独居",
  "2 people": "2 人",
  "3-4 people": "3–4 人",
  "5+ people": "5 人及以上",
  Communal: "多人共居",
  Managed: "可管理",
  Multiple: "多项",
  Full: "完整/无受限",
  Normal: "正常",
  Mild: "轻度",
  Severe: "重度",
  Athlete: "运动员水平",
  Fit: "健康活跃",
  Sedentary: "久坐少动",
  Allergy: "过敏",
  Religious: "宗教原因",
  Medical: "医疗原因",
  Ethical: "伦理原因",
  Prefers: "偏好",
  Requires: "必须",
  "5-7 days": "每周 5–7 天",
  "2-4 days": "每周 2–4 天",
  "About 1 day": "约每周 1 天",
  "Less than weekly": "低于每周一次",
  Annoys: "会恼怒",
  Fine: "无所谓",
  Tabular: "表格形式",
  Motor: "运动/行动",
  News: "新闻",
  "Leans support": "偏向支持",
  Bulleted: "要点列表",
  Narrative: "叙述式",
  Visual: "视觉",
  Verbal: "偏语言",
  "Strongly prefers reading": "强烈偏好阅读",
  "Social-media-heavy": "重度社交媒体",
  "Monthly or infrequent": "每月或偶尔",
  "Tried but not active": "试过但未持续使用",
  "Actively avoids": "主动避开",
  "Very favorable": "非常积极",
  "Somewhat favorable": "较为积极",
  "Neutral / indifferent": "中立/无感",
  "Somewhat unfavorable": "较为消极",
  "Very unfavorable": "非常消极",
  "Strongly trusts with light review": "高度信任，仅轻量复核",
  "Trusts after verification": "验证后信任",
  "Neutral / depends on task": "中立/视任务而定",
  "Distrusts until proven": "需证明可靠后才信任",
  "Does not trust": "不信任",
  "Comfortable delegating complex tasks": "愿意委托复杂任务",
  "Comfortable with bounded complex tasks": "愿意处理有边界的复杂任务",
  "Only simple / boilerplate tasks": "仅用于简单/样板任务",
  "Uses AI for explanation only": "仅用于解释说明",
  "Avoids AI for complexity": "复杂任务避开 AI",
  "No perceived threat": "未感到威胁",
  "Minor long-term concern": "轻微长期担忧",
  "Unsure / mixed": "不确定/混合",
  "Moderate threat concern": "中等程度担忧",
  "Serious threat concern": "严重担忧",
  "AI-enabled coding tools": "AI 编程工具",
  "Documentation / tutorials": "文档/教程",
  "Online courses / videos": "在线课程/视频",
  "Stack Overflow / community Q&A": "Stack Overflow / 社区问答",
  "Peers / mentors": "同事/导师",
  "Self-experimentation": "自行摸索",
  "Not learning AI tooling": "未学习 AI 工具",
  "When trust is low": "信任度低时",
  "When learning deeply": "需要深入学习时",
  "When comparing approaches": "需要比较方案时",
  "When security / ethics matter": "涉及安全/伦理时",
  "When context is hard to explain": "上下文难以解释时",
  "Rarely needs human help": "很少需要人工帮助",
  "Systems understanding": "系统理解能力",
  "Problem decomposition": "问题分解能力",
  "Debugging and diagnosis": "调试与诊断",
  "Security and privacy judgment": "安全与隐私判断",
  "Product and user judgment": "产品与用户判断",
  "Communication and collaboration": "沟通与协作",
  "Domain expertise": "领域专业知识",
  "Ethical judgment": "伦理判断",
  Critical: "至关重要",
  "Not a factor": "非考虑因素",
  "Hard blocker": "硬性阻障",
  "Major concern": "重大顾虑",
  "Moderate concern": "中等顾虑",
  "Minor concern": "轻微顾虑",
  "Not a concern": "无顾虑",
  // Linguistic: Communication
  Concise: "简洁",
  Detailed: "详细",
  "Warm / empathetic": "温暖有共情",
  Formal: "正式",
  Playful: "轻松活泼",
  Blunt: "直截了当",
  Terse: "极简",
  Balanced: "平衡",
  Wordy: "啰嗦",
  Rambling: "絮叨",
  "Very formal": "非常正式",
  Slangy: "俚语化",
  Dry: "冷幽默",
  Sarcastic: "讽刺",
  Wholesome: "暖心幽默",
  Serious: "严肃认真",
  Direct: "直接",
  Indirect: "间接",
  Evasive: "回避",
  Confronting: "正面应对",
  Collaborative: "协作解决",
  Compromising: "折中",
  Avoidant: "回避型",
  Accommodating: "迁就型",
  Heavy: "大量使用",
  "Avoids jargon": "避免术语",
  Precise: "精确",
  "Very precise": "非常精确",
  Loose: "粗略",
  Vague: "模糊",
  "Strongly visual": "强视觉思维",
  "Strongly verbal": "强语言思维",
  "Strongly prefers reading": "强烈偏好阅读",
  "Prefers reading": "偏好阅读",
  "No preference": "无偏好",
  "Prefers video": "偏好视频",
  "Strongly prefers video": "强烈偏好视频",
  Deliberate: "从容深入",
  Fast: "快速",
  "Very fast": "非常快",
  Slow: "较慢",
  Some: "偶尔",
  "Asks constantly": "爱不断提问",
  "Asks often": "常提问",
  "Rarely asks": "很少提问",
  "Snap decisions": "速决",
  Quick: "较快",
  Agonizes: "反复纠结",
  "Opportunity-focused": "机会导向",
  "Threat-focused": "威胁导向",
  "Very polite": "非常礼貌",
  Polite: "礼貌",
  Brusque: "唐突",
  Rude: "粗鲁",
  Veteran: "老手",
  Experienced: "有经验",
  "Some exposure": "有些接触",
  "Heavy multitasker": "重度多任务",
  "Prefers single-task": "偏好单任务",
  "Strict monotasker": "严格单任务",
  Long: "较长",
  "Very long": "很长",
  Short: "较短",
  "Very short": "很短",
  "Highly abstract": "高度抽象",
  Abstract: "抽象",
  Concrete: "具体",
  "Very concrete": "非常具体",
  // Developer: Agent Adoption
  "Experimental only": "仅试验性使用",
  "Not yet but interested": "尚未使用但感兴趣",
  "No plans": "暂无计划",
  "Autonomous execution": "自主执行",
  "Plan-then-act with checkpoints": "先规划再执行（含检查点）",
  "Step-by-step pair programming": "逐步结对编程",
  "Suggest-only assistant": "仅建议型助手",
  "No agent autonomy": "不使用 Agent 自主能力",
  "Major productivity increase": "生产力显著提升",
  "Moderate productivity increase": "生产力适度提升",
  "Small targeted improvement": "小范围定向改进",
  "No clear change": "无明显变化",
  "Negative / slowdown": "负面影响/变慢",
  "Accuracy / reliability concerns": "准确度/可靠性顾虑",
  "Integration with existing tools": "与现有工具集成",
  "Learning / setup effort": "学习/配置成本",
  "Lack of clear use case": "缺乏明确用例",
  "Company policy": "公司政策",
  "No barrier": "无障碍",
  "Requires explicit approval before edits": "修改前需明确批准",
  "Approval before risky edits only": "仅高风险修改需批准",
  "Agent may edit within scoped files": "Agent 可在限定文件内修改",
  "Agent may run broad tasks autonomously": "Agent 可自主执行广泛任务",
  "Read-only assistance preferred": "偏好只读辅助",
  "Concise summary only": "仅简洁摘要",
  "Explain decisions and tradeoffs": "解释决策与权衡",
  "Detailed step-by-step reasoning": "详细逐步推理",
  "Show diffs / tests first": "优先展示 diff/测试",
  "Minimal explanation unless asked": "除非询问否则少解释",
  "Comfortable sharing full repo": "可分享完整仓库",
  "Shares selected files only": "仅分享选定文件",
  "Shares sanitized snippets": "分享脱敏代码片段",
  "Shares natural-language descriptions only": "仅分享自然语言描述",
  "Avoids sharing proprietary code": "避免分享专有代码",
  "Requires strict security review": "要求严格安全审查",
  "Expects basic secret / privacy checks": "期望基础密钥/隐私检查",
  "Security review only for sensitive areas": "仅敏感区域需安全审查",
  "Relies on human review": "依赖人工审查",
  "Not a priority": "非优先考虑",
  "Wants persistent project memory": "希望持久项目记忆",
  "Wants task-scoped memory": "希望任务级记忆",
  "Wants explicit opt-in memory": "希望显式 opt-in 记忆",
  "Prefers stateless interactions": "偏好无状态交互",
  Unsure: "不确定",
  "IDE-integrated": "IDE 集成",
  "GitHub / PR integrated": "GitHub/PR 集成",
  "CLI / terminal integrated": "CLI/终端集成",
  "Chat / browser integrated": "聊天/浏览器集成",
  "CI/CD integrated": "CI/CD 集成",
  "No strong preference": "无强烈偏好",
  "Very low tolerance": "极低容忍度",
  "Low tolerance with easy rollback": "低容忍度（易回滚）",
  "Moderate tolerance for prototypes": "原型阶段中等容忍度",
  "High tolerance for experimental work": "实验性工作高容忍度",
  "Does not use agents": "不使用 Agent",
  // Developer: Open Source Behavior
  "Maintainer / core contributor": "维护者/核心贡献者",
  "Regular contributor": "定期贡献者",
  "Occasional contributor": "偶尔贡献者",
  "Watcher / fork-only user": "仅 watch/fork 用户",
  "Private-only developer": "仅私有仓库开发者",
  "No coding activity": "无编程活动",
  "Code pusher": "直接推送代码",
  "Pull request contributor": "Pull Request 贡献者",
  "Issue reporter": "Issue 报告者",
  "Reviewer / commenter": "评审者/评论者",
  "Repository maintainer": "仓库维护者",
  "Star / fork explorer": "Star/fork 探索者",
  "Rare GitHub user": "很少使用 GitHub",
  "Small focused PRs": "小而聚焦的 PR",
  "Moderate scoped PRs": "中等范围 PR",
  "Large feature PRs": "大型功能 PR",
  "Draft / iterative PRs": "草稿/迭代式 PR",
  "Review-only participant": "仅参与评审",
  "Rare PR usage": "很少使用 PR",
  "Detailed bug reports": "详细缺陷报告",
  "Reproduction-focused": "侧重复现步骤",
  "Feature-request oriented": "偏功能需求",
  "Triage / labeling": "分流/打标签",
  "Comment-only discussion": "仅评论讨论",
  "Rare issue usage": "很少使用 Issue",
  "Frequent reviewer": "频繁评审",
  "Occasional reviewer": "偶尔评审",
  "Review requester mainly": "主要是请求他人评审",
  "Self-review only": "仅自我审查",
  "Rare / no review": "很少/不评审",
  "Many small commits": "大量小提交",
  "Task-sized commits": "按任务大小提交",
  "Squashed milestone commits": "里程碑 squash 提交",
  "Large infrequent commits": "大型低频提交",
  "Irregular / experimental commits": "不规则/实验性提交",
  "Active release maintainer": "活跃发布维护者",
  "Occasional release contributor": "偶尔发布贡献者",
  "Dependency / update maintainer": "依赖/更新维护者",
  "Internal-only maintainer": "仅内部维护",
  "Not involved in releases": "不参与发布",
  // Developer: Code Maintenance
  "Highly modular small components": "高度模块化小组件",
  "Moderately modular": "适度模块化",
  "Feature-file oriented": "按功能文件组织",
  "Monolithic / simple structure": "单体/简单结构",
  "Context-dependent": "视上下文而定",
  "Strong static typing preference": "强烈偏好静态类型",
  "Gradual typing preference": "渐进类型偏好",
  "Dynamic typing preference": "动态类型偏好",
  "Type annotations only for boundaries": "仅在边界使用类型注解",
  "Stable public API first": "稳定公开 API 优先",
  "Internal ergonomics first": "内部易用性优先",
  "Minimal API surface": "最小 API 面",
  "Rapid iteration over stability": "迭代速度优先于稳定性",
  "Framework-convention driven": "框架约定驱动",
  "Always reviews threat model": "总是审查威胁模型",
  "Checks common vulnerabilities": "检查常见漏洞",
  "Relies on automated scanners": "依赖自动化扫描",
  "Reviews only sensitive changes": "仅审查敏感变更",
  "Rarely reviews security": "很少审查安全",
  "Structured logging / metrics by default": "默认结构化日志/指标",
  "Logs important flows / errors": "记录重要流程/错误",
  "Adds observability when debugging": "调试时补充可观测性",
  "Minimal observability": "最低可观测性",
  "Not applicable": "不适用",
  "Minimal targeted patch": "最小定向补丁",
  "Patch plus adjacent cleanup": "补丁加相邻清理",
  "Root-cause / systemic fix": "根因/系统性修复",
  "Broad refactor while fixing": "修复时大范围重构",
  "Temporary workaround": "临时变通方案",
  "Always adds regression tests": "总是添加回归测试",
  "Usually adds tests": "通常添加测试",
  "Adds tests for critical bugs": "关键缺陷才加测试",
  "Rarely adds tests": "很少添加测试",
  "No tests": "不加测试",
  "Reproduce first": "先复现",
  "Read code / traces first": "先读代码/追踪",
  "Add logging / instrumentation": "添加日志/埋点",
  "Interactive debugger": "交互式调试器",
  "Search / ask externally": "搜索/向外求助",
  "Trial-and-error": "试错",
  "Reads architecture / docs first": "先读架构/文档",
  "Starts from tests": "从测试入手",
  "Traces execution paths": "追踪执行路径",
  "Uses search / grep heavily": "重度使用搜索/grep",
  "Asks teammates / AI for map": "向同事/AI 要概览",
  "Experiments by changing code": "通过改代码实验",
  "Does not plan AI use": "不计划使用 AI",
  "Does not participate": "不参与",
  // Demographic: Life Events
  "Parent of young kids": "有年幼子女",
  "Mid-life": "中年阶段",
  "Career change": "职业转型期",
  "Empty nester": "空巢期",
  Retirement: "退休",
  "Started a business": "创过业",
  "Health journey": "健康相关重大经历",
  "Military service": "军旅服役",
  Caregiving: "长期照护他人",
  Bereavement: "经历丧亲",
  "Major relocation": "重大搬迁",
  "None notable": "无特别突出事件",
  "Stable & secure": "稳定安全",
  "Modest but steady": "普通但稳定",
  Turbulent: "动荡不安",
  Privileged: "条件优渥",
  Hardship: "经历困苦",
  "Frequently uprooted": "频繁搬迁",
  "Never left hometown": "从未离开故乡",
  "Moved within region": "在同区域内迁居",
  "Moved nationally": "国内跨区迁居",
  "Moved internationally": "跨国迁居",
  "Serial relocator": "多次迁居",
  "Never left country": "从未出国",
  "A few countries": "去过少数国家",
  "Well-traveled": "游历较广",
  "Lived abroad": "曾长期旅居海外",
  "Global nomad": "全球游牧式生活",
  "Linear climb": "线性上升",
  "Pivoted once": "转型一次",
  "Multiple pivots": "多次转型",
  Entrepreneurial: "创业导向",
  "Portfolio / patchwork": "组合式/拼贴式路径",
  "Just starting": "刚刚起步",
  "Traditional track": "传统升学路径",
  "Returned as adult": "成年后重返校园",
  "Largely self-taught": "以自学为主",
  "Dropped out": "曾辍学",
  "Advanced degrees": "有高等学位",
  "Vocational / trade": "职业/技校培训",
  "Steady upward": "稳步上升",
  Volatile: "起伏波动",
  Downward: "下行",
  "Rebuilt after setback": "挫折后重建",
  "Inherited wealth": "继承财富",
  Sheltered: "较少经历风雨",
  "Minor setbacks": "小挫折",
  "Significant struggles": "显著困境",
  "Overcame major hardship": "克服重大困难",
  "Ongoing hardship": "仍在困境中",
  "First-generation immigrant": "第一代移民",
  "Second-generation": "第二代",
  "Third+ generation": "第三代及以上",
  "Native multi-generational": "本土多代家庭",
  "Returnee / repatriate": "归国/回流者",
  "Never served": "未服役",
  "Served briefly": "短期服役",
  "Career veteran": "职业军人",
  "Combat veteran": "作战退伍军人",
  "Military family": "军人家庭",
  "Never considered": "从未考虑",
  "Considered it": "曾考虑过",
  "Side hustle": "副业/兼职创业",
  "Founded once": "创过一次业",
  "Serial founder": "连续创业者",
  "Exited a company": "曾退出/出售公司",
  Limited: "经历较少",
  "A few relationships": "有过几段关系",
  "Long-term partnership": "长期伴侣关系",
  "Married once": "结过一次婚",
  Remarried: "再婚",
  Widowed: "丧偶",
  "No children": "无子女",
  "Young children": "有年幼子女",
  Teenagers: "有青少年子女",
  "Grown children": "子女已成年",
  "Raising grandchildren": "抚养孙辈",
  "No major events": "无重大健康事件",
  "Recovered from illness": "从疾病中康复",
  "Manages chronic condition": "管理慢性病",
  "Major surgery / injury": "重大手术/受伤",
  "Mental health journey": "心理健康相关经历",
  "Caregiving for others": "照护他人健康",
  "No major loss": "无重大失去",
  "Lost a grandparent": "失去祖父母",
  "Lost a parent": "失去父母",
  "Lost a partner / child": "失去伴侣/子女",
  "Multiple bereavements": "多次丧亲",
  "Lifelong faith": "终身信仰",
  Converted: "后来皈依/改信",
  "Lapsed / left faith": "脱离/放弃信仰",
  "Always secular": "一直世俗/无宗教",
  "Still searching": "仍在探索",
  "Returned to faith": "回归信仰",
  Monocultural: "单一文化背景",
  "Multicultural upbringing": "多元文化成长",
  "Lived across cultures": "跨文化生活",
  "Third-culture kid": "第三文化小孩",
  "1960s-70s": "1960–70 年代",
  "1980s": "1980 年代",
  "1990s": "1990 年代",
  "2000s": "2000 年代",
  "2010s": "2010 年代",
  "2020s": "2020 年代",
  "Private life": "低调私人生活",
  "Locally known": "本地知名",
  "Industry-recognized": "行业内知名",
  "Publicly notable": "公众知名",
  Famous: "广为人知",
  "Occasional volunteer": "偶尔志愿",
  "Long-term volunteer": "长期志愿",
  "Activist / organizer": "活动家/组织者",
  "Public office": "担任公职",
  "Career break": "职业中断/休整",
  "Near-miss / accident": "险境/事故",
  "Spiritual awakening": "精神觉醒",
  Reinvention: "人生重塑",
  "Mentor encounter": "遇到关键导师",
  "No single one": "无单一转折点",
  One: "一种",
  Two: "两种",
  Three: "三种",
  "Four+": "四种及以上",
  Polyglot: "多语者",
  "Still there": "仍住在故乡",
  "Visits often": "经常回去",
  "Occasional return": "偶尔回去",
  "Rarely returns": "很少回去",
  "No connection": "与故乡无联系",
};
Object.assign(VALUES, BATCH.VALUES);

/** Same English value, different Chinese by dimension id */
const VALUE_OVERRIDES = {
  demo_birth_order: {
    Middle: "排行中间",
  },
  socioeconomic_band: {
    Middle: "中等",
  },
  demo_marital_status: {
    Engaged: "已订婚",
  },
};

/** Full-string value patterns — capture groups produce complete Chinese output */
const VALUE_PATTERNS = [
  [/^Pet peeve: (.+) annoys them$/, (m) => `雷点：${entity(m[1])}`],
  [/^Major peeve: (.+)$/, (m) => `主要雷点：${m[1]}`],
];

const LATIN_ALLOW = new Set([
  ...BRAND_NAMES,
  "vs", "C1", "C2", "B1", "B2", "A1", "A2", "TLDR", "TL;DR", "PR", "HR", "VP",
  "UI", "UX", "IDE", "QA", "SRE", "GTM", "STEM", "MMA", "ERP", "CRM", "GIS", "NLP",
  "SEO", "DevOps", "BNPL", "COBOL", "SQL", "PHP", "R", "C", "Go",
]);

const SPECTRUM_TERM = {
  office: "办公室", remote: "远程", team: "团队", solo: "独立", planned: "计划",
  spontaneous: "即兴", city: "城市", nature: "自然", routine: "规律", variety: "多样",
  speed: "速度", accuracy: "准确度", quality: "质量", quantity: "数量", logic: "逻辑",
  intuition: "直觉", save: "储蓄", spend: "消费", saving: "储蓄", spending: "消费",
  lead: "领导", follow: "跟随", indoor: "室内", outdoor: "户外", early: "早期",
  late: "晚期", text: "短信", call: "通话", calls: "通话", texting: "短信",
  group: "群体", novelty: "新奇", familiarity: "熟悉", brief: "简略", detail: "细节",
  competition: "竞争", collaboration: "合作", collab: "合作", stability: "稳定",
  change: "变化", comfort: "舒适", accuracy: "准确度", nature: "自然",
};

function termEn(token) {
  const key = token.toLowerCase().replace(/\s+/g, " ").trim();
  if (SPECTRUM_TERM[key]) return SPECTRUM_TERM[key];
  if (I18N.WORDS[key]) return I18N.WORDS[key];
  const ent = entity(token);
  if (ent !== token) return ent;
  return token;
}

function isAcceptableZh(text) {
  if (!text || !/[A-Za-z]/.test(text)) return true;
  const stripped = text.replace(/（[^）]*）|\([^)]*\)/g, "");
  const tokens = stripped.match(/[A-Za-z+#/.]+/g) || [];
  return tokens.every((t) => LATIN_ALLOW.has(t) || BRAND_NAMES.has(t));
}

function translateSpectrumValue(value) {
  const fixed = {
    Balanced: "平衡", Mixed: "混合", Either: "均可", Hybrid: "混合",
    Planned: "计划", Spontaneous: "即兴", Competitive: "竞争", Collaborative: "合作",
    Mainstream: "主流", "Bleeding edge": "前沿尝鲜", Laggard: "落后采纳者",
    Situational: "视情况而定", "Early adopter": "早期采纳者", "Late adopter": "晚期采纳者",
    "Text only": "仅短信", "Calls only": "仅通话", "One-on-one only": "仅一对一",
    "Every detail": "每个细节", "Just the gist": "只要要点", "Pure logic": "纯逻辑",
    "Pure intuition": "纯直觉", "Hard saver": "重度储蓄", "Free spender": "随意消费",
    "Always leads": "总是领导", "Always novel": "总是追求新奇", "Always familiar": "总是熟悉",
    "Loves big groups": "喜爱大群体", "1-on-1 leaning": "偏向一对一",
    "Highly planned": "高度计划", "Highly spontaneous": "高度即兴",
    "Highly collaborative": "高度合作", "Highly competitive": "高度竞争",
  };
  if (fixed[value]) return fixed[value];

  let m = value.match(/^Very (.+)$/i);
  if (m) return `非常${termEn(m[1])}`;

  m = value.match(/^Strong(ly)? (.+)$/i);
  if (m) return `强烈${termEn(m[2] || m[1])}`;

  m = value.match(/^(.+)-first$/i);
  if (m) return `${termEn(m[1])}优先`;

  m = value.match(/^(.+)-heavy$/i);
  if (m) return `重度${termEn(m[1])}`;

  m = value.match(/^(.+)-driven$/i);
  if (m) return `${termEn(m[1])}驱动`;

  m = value.match(/^(.+)-seeking$/i);
  if (m) return `追求${termEn(m[1])}`;

  m = value.match(/^(.+)-leaning$/i);
  if (m) return `偏向${termEn(m[1])}`;

  m = value.match(/^(.+)-obsessed$/i);
  if (m) return `极度${termEn(m[1])}`;

  m = value.match(/^(.+)-based$/i);
  if (m) return `基于${termEn(m[1])}`;

  m = value.match(/^(.+)-focused$/i);
  if (m) return `专注${termEn(m[1])}`;

  m = value.match(/^Avoids (.+)$/i);
  if (m) return `避开${termEn(m[1])}`;

  m = value.match(/^Uses (.+)$/i);
  if (m) return `使用${termEn(m[1])}`;

  m = value.match(/^(.+) only$/i);
  if (m) return `仅${termEn(m[1])}`;

  m = value.match(/^Highly (.+)$/i);
  if (m) return `高度${termEn(m[1])}`;

  m = value.match(/^Strongly (.+)$/i);
  if (m) return `强烈偏向${termEn(m[1])}`;

  m = value.match(/^(.+) first$/i);
  if (m) return `${termEn(m[1])}优先`;

  m = value.match(/^Prefers (.+)$/i);
  if (m) return `偏向${termEn(m[1])}`;

  m = value.match(/^Craves (.+)$/i);
  if (m) return `强烈渴望${termEn(m[1])}`;

  m = value.match(/^(.+) lover$/i);
  if (m) return `非常喜爱${termEn(m[1])}`;

  m = value.match(/^Leans (.+)$/i);
  if (m) return `偏向${termEn(m[1])}`;

  m = value.match(/^Rarely (.+)$/i);
  if (m) return `很少${termEn(m[1])}`;

  m = value.match(/^Asks (.+)$/i);
  if (m) return `${termEn(m[1])}提问`;

  m = value.match(/^(.+) asks$/i);
  if (m) return `${termEn(m[1])}提问`;

  return null;
}

function isBrandOrAllowedLatin(value) {
  if (BRAND_NAMES.has(value)) return true;
  if (I18N.VALUE_PHRASES[value] === value && /[A-Za-z]/.test(value)) return true;
  // Short acronyms / product tokens (e.g. R, SQL) — keep as-is
  if (/^[A-Z0-9+#./ -]{1,12}$/.test(value) && /[A-Za-z]/.test(value)) return true;
  return false;
}

function translatePhrase(text) {
  if (!text) return text;
  if (I18N.ENTITIES[text]) return I18N.ENTITIES[text];
  if (I18N.VALUE_PHRASES[text]) return I18N.VALUE_PHRASES[text];
  if (I18N.WORDS[text.toLowerCase()]) return I18N.WORDS[text.toLowerCase()];

  const parts = text.split(/\s*(\/|&|—|–|-)\s*/);
  const out = [];
  for (const p of parts) {
    if (["/", "&", "—", "–", "-"].includes(p)) {
      out.push(p === "&" ? "与" : p);
      continue;
    }
    if (I18N.ENTITIES[p]) {
      out.push(I18N.ENTITIES[p]);
      continue;
    }
    const words = p.split(/\s+/);
    const tw = words.map((w) => {
      if (BRAND_NAMES.has(w)) return w;
      if (I18N.ENTITIES[w]) return I18N.ENTITIES[w];
      const lower = w.toLowerCase();
      if (I18N.WORDS[lower]) return I18N.WORDS[lower];
      return w;
    });
    out.push(tw.join(words.length > 1 ? "" : ""));
  }
  const joined = out.join(" ");
  return joined !== text ? joined : null;
}

function entity(name, dim) {
  if (ENTITY[name]) return ENTITY[name];
  if (ENTITY_EXT[name]) return ENTITY_EXT[name];
  const ent = I18N.ENTITIES[name];
  if (ent && isAcceptableZh(ent)) return ent;

  if (dim?.id) {
    const suffix = dim.id.replace(/^[^_]+_/, "").replace(/_/g, " ");
    const fromId = WORD_EXT[suffix.toLowerCase()] || WORD_EXT[suffix.replace(/ /g, "_").toLowerCase()];
    if (fromId && isAcceptableZh(fromId)) return fromId;
  }

  const lower = String(name).toLowerCase();
  if (WORD_EXT[lower]) return WORD_EXT[lower];
  if (I18N.WORDS[lower]) return I18N.WORDS[lower];

  for (const [k, v] of Object.entries({ ...ENTITY, ...I18N.ENTITIES })) {
    if (k.toLowerCase() === lower && isAcceptableZh(v)) return v;
  }

  const phrase = translatePhrase(name);
  if (phrase && isAcceptableZh(phrase)) return phrase;
  if (ent) return ent;
  return name;
}

function translateLabel(dim) {
  if (LABEL_BY_ID[dim.id]) return LABEL_BY_ID[dim.id];
  if (dim.id.startsWith("big5_")) {
    const facet = dim.id.replace("big5_", "");
    return BIG5_FACET[facet] || dim.label;
  }
  const label = dim.label || dim.id;
  if (I18N.VS_LABELS[label]) return I18N.VS_LABELS[label];
  const pair = label.match(/^([^:]+):\s*(.+)$/);
  if (pair) {
    const prefix = PREFIX_LABEL[pair[1].trim()] || pair[1].trim();
    return `${prefix}：${entity(pair[2].trim(), dim)}`;
  }
  if (dim.id.startsWith("peeve_")) {
    const subject = label.replace(/^Pet peeve:\s*/i, "").replace(/\s*annoys them$/i, "");
    return `雷点：${entity(subject, dim)}`;
  }
  if (dim.id.startsWith("habit_")) {
    const subject = label.replace(/^Habit:\s*/i, "");
    return `习惯：${entity(subject, dim)}`;
  }
  return translatePhrase(label) || label;
}

function translateDescription(dim) {
  if (DESC_BY_ID[dim.id]) return DESC_BY_ID[dim.id];
  const d = (dim.description || "").trim();
  const labelZh = translateLabel(dim);

  const rules = [
    [/^Life-age band of the persona\.$/, "persona 所处的年龄段。"],
    [/^World region the persona is based in\.$/, "persona 主要所在的世界区域。"],
    [/^Self-identified gender\.$/, "自我认同的性别。"],
    [/^Settlement density of where they live\.$/, "居住环境的城镇化/人口密度。"],
    [/^Relative income\/wealth band\.$/, "相对收入与财富层级。"],
    [/^Default speech register\.$/, "默认的语言风格（方言/语体）。"],
    [/^Stance toward traditional gender roles\.$/, "对传统性别角色分工的态度。"],
    [/^Cultural frame of reference\.$/, "文化参照框架与背景。"],
    [/^Stance toward immigration\.$/, "对移民与人口流动的态度。"],
    [/^First \/ dominant language\.$/, "第一语言或最常用语言。"],
    [/^Command of English \(the eval lingua franca\)\.$/, "英语使用能力（评测通用语）。"],
    [/^Number of working languages\.$/, "可实际用于工作/交流的语言数量。"],
    [/^Marital status\.$/, "婚姻状况。"],
    [/^Children\.$/, "子女数量/情况。"],
    [/^Household income band\.$/, "家庭收入区间。"],
    [/^Employment status\.$/, "就业状态。"],
    [/^Housing status\.$/, "住房状况。"],
    [/^Household size\.$/, "家庭同住人数。"],
    [/^General health\.$/, "总体健康状况。"],
    [/^Energy level\.$/, "日常精力水平。"],
    [/^Sleep quality\.$/, "睡眠质量。"],
    [/^Chronic pain\.$/, "慢性疼痛程度。"],
    [/^Medication use\.$/, "用药频率与强度。"],
    [/^Dietary restriction\.$/, "饮食限制类型。"],
    [/^Neurodivergence\.$/, "神经多样性相关情况。"],
    [/^Caregiver status\.$/, "是否承担照护职责。"],
    [/^Health literacy\.$/, "健康信息理解与应用能力。"],
    [/^Insurance status\.$/, "医疗保险覆盖情况。"],
    [/^Exercise frequency\.$/, "锻炼/运动频率。"],
    [/^Level of interest in (.+)\.$/, (m) => `对「${entity(m[1], dim)}」的兴趣程度。`],
    [/^Engagement with (.+)\.$/, (m) => `对「${entity(m[1], dim)}」的参与/投入程度。`],
    [/^Familiarity with (.+) culture\.$/, (m) => `对${entity(m[1], dim)}文化的熟悉程度。`],
    [/^Familiarity with (.+)\.$/, (m) => `对「${entity(m[1], dim)}」的熟悉程度。`],
    [/^Spoken proficiency in (.+)\.$/, (m) => `「${entity(m[1], dim)}」口语熟练度。`],
    [/^Openness facet — (.+)\.$/, (m) => `大五人格·开放性：${entity(m[1], dim)}。`],
    [/^Conscientiousness facet — (.+)\.$/, (m) => `大五人格·尽责性：${entity(m[1], dim)}。`],
    [/^Extraversion facet — (.+)\.$/, (m) => `大五人格·外向性：${entity(m[1], dim)}。`],
    [/^Agreeableness facet — (.+)\.$/, (m) => `大五人格·宜人性：${entity(m[1], dim)}。`],
    [/^Neuroticism facet — (.+)\.$/, (m) => `大五人格·神经质：${entity(m[1], dim)}。`],
    [/^How often the persona engages in (.+)\.$/, (m) => `参与「${entity(m[1], dim)}」的频率。`],
    [/^Reaction to (.+)\.$/, (m) => `对「${entity(m[1], dim)}」的反应/容忍度。`],
    [/^(.+) vs (.+)\.$/, (m) => {
      const key = `${m[1]} vs ${m[2]}`;
      const vs = I18N.VS_LABELS[key] || `${translatePhrase(m[1]) || m[1]} vs ${translatePhrase(m[2]) || m[2]}`;
      return `${vs}偏好。`;
    }],
    [/^(.+) well the persona knows (.+)\.$/, (m) => `对「${entity(m[2], dim)}」的熟悉程度。`],
    [/^(.+) proficiency in (.+)\.$/, (m) => `「${entity(m[2], dim)}」熟练度。`],
    [/^(.+) with (.+) culture\.$/, (m) => `对${entity(m[2], dim)}文化的熟悉程度。`],
    [/^(.+) with (.+)\.$/, (m) => `对「${entity(m[2], dim)}」的相关程度。`],
    [/^(.+) for (.+) cuisine\.$/, (m) => `对${entity(m[2], dim)}菜系的偏好。`],
    [/^(.+) for (.+) music\.$/, (m) => `对${entity(m[2], dim)}音乐的偏好。`],
    [/^(.+) in (.+)\.$/, (m) => `在「${entity(m[2], dim)}」方面的相关情况。`],
    [/^BFI-2 (.+) facet construct: (.+)\.$/, (m) => `大五人格·${translatePhrase(m[1]) || m[1]}：${entity(m[2], dim)}。`],
    [/^BFI-2 (.+) domain construct: (.+)\.$/, (m) => `大五人格·${translatePhrase(m[1]) || m[1]}：${entity(m[2], dim)}。`],
    [/^(.+)\.$/, () => `${labelZh}的相关说明。`],
  ];

  for (const [re, out] of rules) {
    const m = d.match(re);
    if (!m) continue;
    return typeof out === "function" ? out(m) : out;
  }
  return labelZh;
}

function translateValue(value) {
  if (VALUES[value]) return VALUES[value];
  const spectrum = translateSpectrumValue(value);
  if (spectrum) return spectrum;
  if (VALUE_EXT[value] && isAcceptableZh(VALUE_EXT[value])) return VALUE_EXT[value];
  if (I18N.VALUE_PHRASES[value] && isAcceptableZh(I18N.VALUE_PHRASES[value])) {
    return I18N.VALUE_PHRASES[value];
  }
  if (isBrandOrAllowedLatin(value)) return value;
  for (const [re, fn] of VALUE_PATTERNS) {
    const m = value.match(re);
    if (m) return fn(m);
  }
  if (/^\d/.test(value) || value.includes("$") || /^\d+[\-–]\d+/.test(value)) return value;
  const phrase = translatePhrase(value);
  if (phrase && isAcceptableZh(phrase)) return phrase;
  if (VALUE_EXT[value]) return VALUE_EXT[value];
  return null;
}

const out = {
  schemaVersion: "1.0",
  locale: "zh-CN",
  note: "Display-only Chinese. Exported attribute values remain English canonical keys.",
  categories: CATEGORIES,
  dimensions: {},
  values: { ...VALUES },
  valueOverrides: VALUE_OVERRIDES,
  meta: {
    generatedAt: new Date().toISOString(),
    dimensionCount: dimensions.length,
    untranslatedValues: [],
  },
};

for (const dim of dimensions) {
  out.dimensions[dim.id] = {
    label: translateLabel(dim),
    description: translateDescription(dim),
  };
  for (const v of dim.values || []) {
    if (out.values[v]) continue;
    const zh = translateValue(v);
    if (zh) out.values[v] = zh;
    else if (!out.meta.untranslatedValues.includes(v)) out.meta.untranslatedValues.push(v);
  }
}

out.meta.untranslatedValueCount = out.meta.untranslatedValues.length;
out.meta.translatedValueCount = Object.keys(out.values).length;

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");

console.log(`Wrote ${OUT_PATH}`);
console.log(`Dimensions: ${out.meta.dimensionCount}`);
console.log(`Values translated: ${out.meta.translatedValueCount}`);
console.log(`Values untranslated: ${out.meta.untranslatedValueCount}`);
