# MatrAIx Website Presentation Plan / 网站展示规划

> **Status:** Information Architecture + Positioning Proposal  
> **Primary Identity:** Open-source Research Community  
> **Core Direction:** Persona-conditioned Agents for Human/User Behavior Simulation  
> **Primary Application:** Product & AI System Evaluation  
> **Source Alignment:** MatrAIx README + Persona / Environment / Application Team Plans

---

## 0. Executive Decision / 核心结论

MatrAIx 网站第一阶段建议采用 **6 个核心页面**：

1. **Home**
2. **Research**
3. **Personas**
4. **Applications**
5. **Playground**
6. **Community**

另外保留两个导航动作：

- **GitHub** — External link，不需要单独制作营销页面
- **Join Us** — Header 右侧 Primary CTA，跳转到 Community

推荐的主导航：

```text
Home · Research · Personas · Applications · Playground · Community     GitHub  [Join Us]
```

### 为什么是这 6 个页面？

它们分别回答用户最重要的六个问题：

| Page | Visitor Question | 中文解释 |
|---|---|---|
| **Home** | What is MatrAIx? | 你们是谁，解决什么问题，整体愿景是什么？ |
| **Research** | What are you studying and publishing? | 研究问题、论文、数据、benchmark 和技术进展是什么？ |
| **Personas** | Who is being simulated? | Persona 如何构建、ground、验证和使用？ |
| **Applications** | What can be simulated and evaluated? | 可以做哪些 task、scenario 和 product evaluation？ |
| **Playground** | Can I see or run it? | 能不能实际体验 simulation pipeline？ |
| **Community** | Who is building it and how can I join? | 三个 Team 在做什么，我应该加入哪里？ |

网站不应该一开始就像 SaaS 产品官网，也不应该只像论文列表。理想状态是：

> **A research community with a clear vision, an inspectable methodology, working prototypes, open artifacts, and concrete ways to contribute.**

---

# Part I — Positioning / 项目定位

## 1. One-sentence Definition

推荐统一使用：

> **MatrAIx is an open-source research project building persona populations, persona-conditioned agents, environments, and evaluation tools for simulating human behavior before real-world deployment.**

中文解释：

> MatrAIx 是一个开源研究项目，目标是构建 Persona Population、Persona-conditioned Agent、Simulation Environment 和 Evaluation Tool，用于在真实部署前模拟不同用户的行为与反馈。

## 2. Project Philosophy / 项目哲学

项目现有的 slogan 应作为长期、稳定的品牌表达：

> **Simulate before reality.**

这个 slogan 比较适合：

- Logo 下方或 Footer
- GitHub README
- Research paper / poster
- Community identity
- Social media profile

## 3. Homepage Campaign Headline

首页可以使用更完整、更具传播性的 headline：

> **Before you release to the world, simulate the world.**

它与首页 globe 视觉直接对应，也解释了 `Simulate before reality` 的具体含义。

推荐组合：

```text
Eyebrow:
OPEN RESEARCH COMMUNITY · PERSONA-CONDITIONED AGENTS

Headline:
Before you release to the world,
simulate the world.

Philosophy:
Simulate before reality.

Subheadline:
MatrAIx is an open-source research project building persona populations,
agent environments, and evaluation scenarios to study how diverse simulated
users behave before systems meet the real world.
```

## 4. Research Descriptor

在 paper、Research page、SEO description 等更正式的场景中使用：

> **World-Scale User Simulation for Human-Centered Evaluation**

可保留的其他表达：

- **Simulating the World** — Research program / paper subtitle
- **Simulate users. Evaluate systems. Understand differences.**
- **Beyond the average user.**
- **From benchmarks to populations.**
- **The missing human layer in AI evaluation.**
- **User simulation at population scale.**

不要在一个页面同时使用太多 slogan。建议：

- Brand slogan：`Simulate before reality.`
- Homepage headline：`Before you release to the world, simulate the world.`
- Research descriptor：`World-Scale User Simulation for Human-Centered Evaluation`

---

# Part II — Information Architecture / 网站页面结构

## 5. Primary Navigation / 主导航

```text
Home
Research
Personas
Applications
Playground
Community
                                      GitHub  [Join Us]
```

### Naming Rules

- 原来的 **Blog** 升级为 **Research**。
- 原来的 **Demo** 改为 **Playground**。
- 原来的 **Access / Request Access** 改为 **Community / Join Us**。
- `Persona` 建议在导航中用复数 **Personas**，表示一个研究领域和 population，而不是单个人物档案。
- `Application Tasks` 在导航中简化为 **Applications**。

---

## 6. Home Page / 首页

### Home 的职责

Home 不负责解释所有细节，只负责让访客快速理解：

1. MatrAIx 是什么
2. 为什么需要 User Simulation
3. 整体 research stack 如何工作
4. 当前有哪些真实 artifact
5. 如何体验
6. 如何加入

### Recommended Homepage Sections

#### Section 1 — Hero / Research Vision

保留：

- Interactive globe
- Open Research Community badge
- Strong headline
- Research / Playground CTA

推荐 CTA：

```text
[Explore Research]  [Open Playground]  Join the Community →
```

Primary CTA 建议是 `Explore Research`，而不是直接 `Join Community`，因为新访客通常需要先建立信任。

Globe 应代表：

> **Population coverage and the long-term world-scale vision**

而不是暗示当前正在实时运行 8.3B 个 agent。

推荐 label：

- `Toward 8.3B Personas`
- `Population-scale Persona Space`
- `A World of Simulated Users`

不建议继续使用没有说明的：

- `Live population · 8,300,000,000 agents`

#### Section 2 — Problem

Heading：

> **Products are deployed to populations, but evaluated on averages.**

说明三点：

1. Benchmarks test task completion, not diverse user experience.
2. Small user cohorts miss long-tail needs and failure modes.
3. Average scores hide differences across language, expertise, ability, trust, culture, and context.

Ending question：

> **Who succeeds, who struggles, and why?**

#### Section 3 — Three-layer Research Stack

这一段必须对应项目真实的三个 Team：

| Layer | Core Question | 中文解释 |
|---|---|---|
| **Persona** | Who is simulated? | 模拟谁？Persona 如何构建、ground 和验证？ |
| **Environment** | Where and how do agents act? | Agent 在什么环境中、通过什么 interface 行动？ |
| **Application** | What do we simulate and why? | 测试什么 task、product、system，为什么测试？ |

推荐视觉：

```text
PERSONA / WHO ───────────────┐
                            ├→ ENVIRONMENT / WHERE & HOW
APPLICATION / WHAT & WHY ────┘              ↓
                               TELEMETRY → METRICS → REPORT
```

#### Section 4 — Simulation Pipeline

展示真实 pipeline：

```text
Select Personas
→ Instantiate Persona-conditioned Agents
→ Choose Environment
→ Define Task & Metrics
→ Run Simulation
→ Collect Telemetry
→ Analyze
→ Generate Report / Benchmark Result
```

每一步都应该可以点击进入 Methodology 或对应页面。

#### Section 5 — What We Are Building

不要继续只展示商业服务式卡片：

- Playground access
- Evaluation reports
- Training data
- Custom personas

建议改成真实 research artifacts：

1. **MatrAIxPersona-8B** — Vision / In Progress
2. **MatrAIxPersonaTrain** — Planned Coreset
3. **MatrAIxPersonaBench** — Active Research
4. **Environment Interface & Telemetry** — Active Engineering
5. **Scenario Library** — In Progress
6. **Evaluation Reports** — Prototype

每个卡片必须有 maturity label：

- `Available`
- `Prototype`
- `In Progress`
- `In Validation`
- `Planned`
- `Vision`

#### Section 6 — Concrete Example

Heading：

> **See one product through many users.**

使用一个完整案例说明：

- Target product
- Selected persona population
- Environment
- Task
- 3–4 persona trajectories
- Different outcomes
- Segmented finding
- Limitations

优先顺序建议：

1. Survey scenario — 最容易形成真实 end-to-end reference
2. Chatbot scenario — 当前 Environment / Application priority
3. Web browser case study — 最适合视觉展示

#### Section 7 — Research Principles

Heading：

> **Simulation is a hypothesis, not a human subject.**

简短说明：

- Synthetic users do not replace human studies.
- Plausibility is not the same as representativeness.
- Persona provenance must be documented.
- Persona adherence and drift must be measured.
- Important findings require human calibration.
- Bias, privacy, consent, and stereotypes require governance.

#### Section 8 — Latest Research

展示三篇最新 paper / note / artifact：

- Survey paper
- MatrAIx end-to-end paper
- Persona grounding / PersonaBench / Environment technical note

#### Section 9 — Community

展示三个 Team 的简版入口：

- Persona Team
- Environment Team
- Application Team

CTA：

```text
[Choose a Team]  [View Open Tasks]  [Join Discord]
```

#### Section 10 — Final CTA

> **Before systems meet real users, let them meet a world of simulated ones.**

```text
[Join the Research Community]  [Explore the Playground]
```

---

## 7. Research Page / Research & Publications

### Research Page 的定位

原来的 Blog 不删除，而是升级为 Research，Blog/Updates 成为其中的一个 category。

### Recommended Filters

```text
All
Papers
Datasets
Benchmarks
Technical Notes
Experiments
Community Updates
```

### 每个 Research Card 应包含

- Title
- Research question
- Short abstract
- Authors / Contributors
- Status
- Date
- Paper link
- Code link
- Data link
- Citation / BibTeX
- Limitations

### 两个核心 Publication Track

#### Paper 1 — Survey

主题：

- Persona datasets
- Persona generation
- Persona-conditioned agents
- User simulation
- Evaluation benchmarks
- Applications
- Risks and open challenges

#### Paper 2 — MatrAIx End-to-End System

主题：

- Persona schema
- MatrAIxPersona dataset
- Data filtering and quality
- PersonaBench
- Persona-conditioned agents
- Environments
- Application scenarios
- Human validation

### Research Questions

Research 页面应该公开展示问题，而不只是展示结论：

- How should personas be represented without flattening identity groups?
- Which persona attributes actually change agent behavior?
- How do we measure persona adherence and identity drift?
- Does nominal scale translate into effective behavioral diversity?
- When do simulated distributions reproduce human observations?
- Can simulated users predict product friction later confirmed by humans?
- How should provenance, uncertainty, consent, and representativeness be reported?
- What changes in multi-agent simulation?

---

## 8. Personas Page / Persona Research Layer

### Personas Page 的职责

这个页面不是 Persona Team 的组织页面，而是 Persona research 和 artifact 的展示页面。

### Recommended Sections

1. **What is a Persona?**
2. **Persona Structure**
3. **Grounding & Data Sources**
4. **Persona Explorer**
5. **MatrAIxPersona-8B**
6. **MatrAIxPersonaTrain**
7. **MatrAIxPersonaBench**
8. **Quality & Validation**
9. **Limitations**
10. **Contribute Data / Methods**

### Persona Structure

研究计划目前建议的五个 major aspects：

| Aspect | Examples |
|---|---|
| **Demographics & Background** | age, location, occupation, education, income, household |
| **Psychology & Personality** | traits, risk tolerance, skepticism, motivation, values |
| **Communication & Cognition** | tone, literacy, attention, technical fluency, learning style |
| **Preferences & Interests** | likes, dislikes, price sensitivity, aesthetic taste |
| **Behavior & History** | decision style, usage pattern, churn triggers, memory |

### Quality Pipeline

需要可视化展示：

```text
Data Sources
→ Schema Conformance
→ Conflict Checks
→ Completeness Filtering
→ Deduplication
→ Diversity / Coverage
→ Behavioral Sensitivity
→ Persona Adherence Benchmark
→ Human Validation
```

### 当前需要解决的 Schema 冲突

当前网站展示：

> Flat / Unified 1,000-Dimension Persona Schema

研究计划写的是：

> Organize personas around 4–5 major aspects; exact schema remains an open research question.

建议：

- 在 schema 决定前，将当前 Explorer 标记为 `Early Prototype`。
- 不要把当前 flat schema 表述为最终的 MatrAIxPersona schema。
- 最终 schema 确定后再统一网站、README 和 Explorer。

---

## 9. Applications Page / Task & Scenario Library

### 为什么需要独立 Applications Page？

因为它直接回答：

> **What can MatrAIx actually simulate and evaluate?**

这个页面会把抽象 research 变成具体 use case。

### Application Categories

#### Type 1 — Survey

- Product concept testing
- Messaging evaluation
- UI mockup feedback
- Preference study
- Adoption intent

Status：`Start Here / Priority`

#### Type 2 — Chatbot

- AI tutor evaluation
- Customer support / returns
- Conversational recommender
- Onboarding assistant
- Privacy-sensitive or confused users
- Adversarial user simulation

Status：`Priority`

#### Type 3 — Web

- Landing page
- Checkout flow
- Dashboard
- Forum / social product
- E-commerce browsing

Status：`Next`

#### Type 4 — App / Sandbox

- Mobile app
- Desktop app
- Game prototype
- Coding assistant
- Multi-app task

Status：`Longer-term`

#### Type 5 — Multi-agent / Social

- Social network simulation
- Information diffusion
- Market interaction
- Group decision-making
- Synthetic communities

Status：`Vision / Later Stage`

### Application Task Card Format

每一个 task 使用统一格式：

```text
Task Name
Research Question
Target System
Environment Type
Persona Requirements
Sampling Rule
Task Prompt
Signals / Telemetry
Metrics
Example Run
Sample Report
Known Limitations
Status
```

### Applications 与 Environments 的区别

- **Environment** 是 execution substrate：agent 在哪里、通过什么 interface 行动。
- **Application** 是 research scenario：想测试什么、为什么测试、如何评价。

例如：

```text
Environment: Chatbot
Application: Evaluate whether an AI tutor adapts to low-confidence students
```

或：

```text
Environment: Web Browser
Application: Compare checkout A/B for older mobile users
```

---

## 10. Playground Page / Interactive Demo

### Naming

建议将 `Demo` 正式改为 **Playground**。

Demo 是展示；Playground 强调可以选择、运行、观察和实验。

### Recommended Playground Flow

```text
1. Choose Application Task
2. Choose / Connect Environment
3. Select Persona Population
4. Define Sampling Rule & Sample Size
5. Choose Metrics
6. Run Simulation
7. Inspect Telemetry
8. Generate Report
9. Export Trajectories
```

### Demo 与真实研究结果必须分开

页面应持续显示：

> **Prototype — interface and values are illustrative unless linked to a published experiment.**

区分三个层级：

1. **Illustrative Frontend Simulation**
2. **Actual Research Pipeline**
3. **Published / Validated Results**

不要让 animated metrics 看起来像已经完成的人类校准实验。

### Playground 推荐 Tabs

- Configure
- Population
- Live Run
- Telemetry
- Segments
- Findings
- Report
- Export

---

## 11. Community Page / Teams & Contribution

### 是否单独放一个 Team Page？

建议：

> **单独做一个 Community Page，但暂时不要为每个 Team 再拆一个独立网页。**

原因：

1. 三个 Team 的独立网站内容目前还不够多。
2. Persona 已经有 research/artifact 页面，若再做 Persona Team 页面容易混淆。
3. Community 比 Teams 范围更完整，可以同时容纳 contributors、roadmap、open tasks、Discord 和 governance。
4. 维护一个 Community 页面比维护三个重复页面更容易。

### Community Page Structure

#### Hero

> **Build the simulation layer before reality with us.**

说明 MatrAIx 欢迎：

- Researchers
- Engineers
- Data contributors
- HCI / Social Science researchers
- Product partners
- Students
- Infrastructure supporters

#### Team 1 — Persona

Anchor：`community.html#persona`

```text
Who is simulated?
```

展示：

- Mission
- Current priorities
- Active tasks
- Owners
- Blockers
- Persona README
- Persona PLAN
- Open issues
- Join Persona Team

#### Team 2 — Environment

Anchor：`community.html#environment`

```text
Where and how do agents act?
```

展示：

- Shared environment interface
- Observation / action / tool schema
- Telemetry
- Survey environment
- Chatbot environment
- Web environment
- Current owners and issues

#### Team 3 — Application

Anchor：`community.html#application`

```text
What do we simulate and why?
```

展示：

- Application template
- Survey scenarios
- Chatbot scenarios
- Web scenarios
- Metrics
- Report generation
- Current owners and issues

### Community 其他内容

- Contributors
- Open Tasks
- Roadmap
- Research Questions
- Discord
- GitHub
- Contribution Guide
- Community Meeting Schedule
- Code of Conduct
- Support Compute

### 以后什么时候拆 Team Pages？

出现以下情况时再拆：

- 每个 Team 有 5 个以上 active project
- 有自己的 publication / dataset / documentation
- 页面长度已经影响 Community 浏览
- 每个 Team 有明确 maintainer 和独立 update cadence

未来结构可以是：

```text
/community/
├── index.html
├── persona-team.html
├── environment-team.html
└── application-team.html
```

第一阶段不需要。

---

# Part III — Supporting Pages / 辅助页面

## 12. Environment Page 是否需要独立？

建议：

> **可以制作，但第一阶段不占 Primary Navigation。**

原因：

- 普通访客更容易理解 Applications，不容易理解 Environment abstraction。
- 当前 Environment Team 首要任务是 interface 和 telemetry，还没有大量可展示 environment。
- Application 页面可以先按 Survey / Chatbot / Web / App 分类展示。

Environment 内容可以先放在：

- Home 的 Three-layer Stack
- Methodology Page
- Applications Page 的 Environment Filter
- Community 的 Environment Team Section

等 SDK、Adapter、Environment Interface 成熟后，再将 Environments 提升为 Primary Navigation。

## 13. Methodology Page

不一定放入 Header，但必须存在并被 Home / Research / Personas / Applications 链接。

内容：

- Persona grounding
- Population sampling
- Agent conditioning
- Environment interface
- Episode lifecycle
- Telemetry schema
- Metrics
- LLM-as-a-judge
- Human validation
- Uncertainty
- Reproducibility
- Limitations

## 14. Roadmap Page

对应项目已有四阶段：

1. **Minimal Stack**
2. **Core Dataset & Benchmark**
3. **Environment Expansion**
4. **Simulated Society**

每项使用：

- Status
- Owner
- Dependency
- Expected artifact
- GitHub issue

## 15. Responsible Simulation Page

内容：

- Synthetic users are not real users
- Bias and stereotype risks
- Within-group diversity
- Persona provenance
- Consent and privacy
- Real-person data
- Sensitive attributes
- High-risk applications
- Human validation requirements
- Prohibited use
- Reporting standards

## 16. Footer Pages

Footer 可以包含：

```text
About
Methodology
Roadmap
Responsible Simulation
Documentation
Data
Publications
Contribution Guide
Code of Conduct
Contact
Press
Support Compute
```

---

# Part IV — Truthfulness & Claims / 内容可信度

## 17. Project Maturity Model

所有 artifact 和 claim 使用统一 maturity label：

| Label | Meaning |
|---|---|
| **Available** | 用户现在可以 inspect / download / run |
| **Prototype** | 交互原型或示范，不代表 validated result |
| **In Progress** | Team 正在实现 |
| **In Validation** | 已实现，正在进行 benchmark / human validation |
| **Planned** | 已进入 roadmap，但尚未实现 |
| **Vision** | 长期研究方向 |

## 18. 需要解决的网站与 Research Plan 冲突

### 8.3B Simulated vs Long-term Goal

当前研究 README 将 8.3B 定义为 deliberately ambitious long-term goal。

因此网站不应在没有 methodology 的情况下说：

- `8.3B agents live`
- `8.3B behaviors already simulated`

建议说：

- `Toward 8.3B Personas`
- `An 8.3B-persona vision`
- `Population-scale persona infrastructure`
- `A world-scale target`

### Full Population vs Sampled Population

Application plan 明确说明实际 task 会 sample relevant personas，例如 10K–100K，而不是每次运行整个 8.3B。

网站需要区分：

- Globe = long-term population vision
- Evaluation run = task-relevant sampled population

### Behaves Like Real Users

`Behaves like real users` 目前仍是 research hypothesis，不是已解决结论。

推荐：

> **Agents conditioned to simulate diverse users.**

避免：

> **Agents that behave exactly like real users.**

### 1,000 Dimensions

如果保留该数字，需要解释：

- Dimensions 如何定义
- 是否全部 behaviorally meaningful
- 是否有 provenance
- 如何处理 impossible combinations
- 如何做 behavioral sensitivity
- 与 4–5 major aspects 的关系

### Demo Metrics

任何以下数字都要提供来源：

- 95% human match
- 8.3B simulated
- behaviors per second
- results in hours
- cost reduction
- task success

没有实验来源时必须标记 `Illustrative`。

---

## 19. Terminology / 术语规范

### Recommended Terms

- Persona-conditioned Agent
- Simulated User
- User Behavior Simulation
- Population-aware Evaluation
- Interactive Evaluation
- Environment
- Application Scenario
- Telemetry / Trajectory
- Persona Adherence
- Identity Drift
- Human Validation
- Segmented Outcome

### Definitions

- **Persona** — structured conditioning representation，不等同于真实个人。
- **Agent** — model-driven actor conditioned on persona / goal / memory。
- **Simulated User** — 在 environment 中扮演 user role 的 agent。
- **Environment** — agent 可以观察、行动并接收 state change 的执行空间。
- **Application** — 具体 research question、task、persona selection 和 metrics。
- **Trajectory** — 一个 episode 中的 observation/action/tool/outcome sequence。
- **Population** — 按 distribution 或 sampling rule 构造的 persona group，不只是大量 profile list。

---

# Part V — Visual Storytelling / 视觉展示

## 20. Globe Meaning

Globe 表示：

- world-scale ambition
- persona diversity
- geographic coverage
- sampled population space

建议 legend：

- Blue point — sampled persona
- Amber point — highlighted / active evaluation
- Coastline — global context
- Count — target or indexed population，必须说明定义

## 21. Canonical System Diagram

网站、paper、poster 和 deck 尽量复用同一套 diagram：

```text
Data Sources + Persona Research
                ↓
        Persona Population
                ↓
    Persona-conditioned Agent
                ↓
       Environment + Task
                ↓
 Observation → Action → Tool → Outcome
                ↓
      Telemetry / Trajectory
                ↓
 Segmented Metrics + Uncertainty
                ↓
   Report / Benchmark / Validation
```

## 22. Evidence Priority

视觉内容优先级：

1. Real trajectory
2. Persona comparison
3. Segmented finding
4. Human calibration
5. Coverage / uncertainty
6. Animated system visualization

原则：

> **Dashboard supports evidence; dashboard is not evidence.**

---

# Part VI — Audience Journeys / 用户路径

## 23. Researcher

```text
Home → Research Question → Methodology → Paper → Code/Data → Open Task → Community
```

## 24. Product Builder

```text
Home → Application Example → Playground → Sample Report → Propose Evaluation
```

## 25. Student / Contributor

```text
Home → Community → Choose Team → Open Tasks → GitHub / Discord
```

## 26. HCI / Social Science Researcher

```text
Home → Research Principles → Persona Grounding → Human Validation → Collaboration
```

## 27. Funder / Infrastructure Partner

```text
Home → Vision → Artifacts → Roadmap → Compute Needs → Support
```

## 28. Press / General Audience

```text
Home → Plain-language Thesis → One Story → Limitations → Community → Contact
```

---

# Part VII — Implementation Roadmap / 网站实施顺序

## 29. Phase 1 — Restructure Existing Site

优先做低成本、高影响修改：

1. 确认 6 个 Primary Pages。
2. Blog 改名为 Research。
3. Demo 改名为 Playground。
4. Access 改为 Community / Join Us。
5. Home 加入 Three-layer Stack。
6. Home 加入真实 Simulation Pipeline。
7. 把 service cards 改成 research artifact cards。
8. 所有 demo/claim 加 maturity labels。
9. 将 8.3B 改成 long-term vision 表达。
10. Header 加 GitHub。

## 30. Phase 2 — Build Core Pages

1. 完成 Research landing page。
2. 升级 Personas page。
3. 新建 Applications page。
4. 升级 Playground flow。
5. 将 Access 改造成 Community page。
6. 新建 Methodology page。
7. 新建 Roadmap page。
8. 新建 Responsible Simulation page。

## 31. Phase 3 — Publish Evidence

1. Publish one Survey reference scenario.
2. Publish one Chatbot reference scenario.
3. Publish telemetry schema.
4. Publish sample trajectories.
5. Publish PersonaBench baseline.
6. Add human-validation results.
7. Add marginal/joint fidelity evaluation.
8. Add diversity-collapse evaluation.
9. Add persona adherence and drift metrics.
10. Publish negative results and known limitations.

---

# Part VIII — Final Recommendation / 最终建议

## 32. Recommended Site Map

```text
/
├── index.html                         Home
├── research/
│   ├── index.html                     Research landing
│   ├── papers/
│   ├── datasets/
│   ├── benchmarks/
│   └── updates/
├── personas.html                     Persona research + explorer
├── applications.html                 Task & scenario library
├── playground.html                   Interactive simulation
├── community.html                    Teams + contributors + join
├── methodology.html                  Research methodology
├── roadmap.html                      Project roadmap
└── responsible-simulation.html       Limitations & governance
```

为了兼容现有 URL，可以先保持：

- `persona.html`
- `demo.html`
- `access.html`

但导航文字显示为：

- Personas
- Playground
- Community

后续再决定是否做 redirect。

## 33. Recommended Primary Navigation

```text
MatrAIx

Home
Research
Personas
Applications
Playground
Community

GitHub
[Join Us]
```

## 34. Team Page Decision

最终建议：

> **Community 单独作为 Primary Page；Persona / Environment / Application 三个 Team 暂时作为 Community 内的 sections，不分别占用 Primary Navigation。**

同时保持概念分离：

- Personas Page = research/artifact
- Applications Page = task/scenario
- Community Team Sections = organization/contribution

这能避免内容重复，也能让访问者同时理解研究成果和社区结构。

## 35. Final Positioning

统一项目叙事：

> **MatrAIx is an open-source research project building the infrastructure for persona-based simulation: who is simulated, where and how agents act, what is tested, and how behavior is evaluated before reality.**

品牌 slogan：

> **Simulate before reality.**

首页 headline：

> **Before you release to the world, simulate the world.**

Research descriptor：

> **World-Scale User Simulation for Human-Centered Evaluation**

这套结构能够同时表达：

- Research ambition
- Persona science
- Environment engineering
- Product evaluation applications
- Working playground
- Open-source community
- Long-term world-scale vision

并且不会把尚未完成的 research goal 表述成已经验证的产品能力。
