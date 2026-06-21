# 因果图 — Causal Diagram & Relationships

## 1. Core Causal Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT LANGUAGE ABILITY                        │
│           (Native: Chinese | Limited: English | None: Spanish)   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
         ┌──────────▼──────────┐  ┌──▼──────────────────┐
         │ BOOK SEARCH TASK    │  │ LANGUAGE EXAM TASKS │
         │ (Chinese UI)        │  │ (English/Spanish)   │
         └──────────┬──────────┘  └──┬──────────────────┘
                    │                 │
         ┌──────────▼──────────┐  ┌──▼──────────────────┐
         │ HIGH SUCCESS RATE   │  │ LOW SUCCESS RATE    │
         │ (Chinese native)    │  │ (Non-native)        │
         └──────────┬──────────┘  └──┬──────────────────┘
                    │                 │
         ┌──────────▼──────────┐  ┌──▼──────────────────┐
         │ FAST COMPLETION     │  │ SLOW COMPLETION     │
         │ (2-3 min per task)  │  │ (5-8 min per Q)     │
         └────────────────────┘  └──────────────────────┘
```

---

## 2. Detailed Causal Chains

### Chain 1: Language Proficiency → Task Performance

```
Native Chinese Proficiency
    ↓
    ├─→ [Fluent UI comprehension]
    │       ↓
    │       ├─→ [Fast navigation]
    │       └─→ [Correct decision-making]
    │
    └─→ [Book search success]
            ↓
            └─→ [Task completion: 100%]

Limited/No English Proficiency
    ↓
    ├─→ [Slow reading speed]
    │   (Re-reading required: 2-3 times)
    │       ↓
    │       ├─→ [High cognitive load]
    │       └─→ [Increased completion time]
    │
    ├─→ [Vocabulary gaps]
    │       ↓
    │       └─→ [Guessing on answers (low accuracy)]
    │
    ├─→ [Grammar confusion]
    │       ↓
    │       └─→ [Failed sentence parsing]
    │
    └─→ [Writing section struggle]
            ↓
            └─→ [Minimal/no output in free-form writing]
                    ↓
                    └─→ [Task completion: 25-45%]

Zero Spanish Proficiency
    ↓
    ├─→ [Complete UI non-comprehension]
    │       ↓
    │       └─→ [Navigation uncertainty]
    │
    ├─→ [Vocabulary: ~0% recognition]
    │       ↓
    │       └─→ [Cognate matching as only strategy]
    │
    ├─→ [Random guessing on all questions]
    │       ↓
    │       └─→ [Success rate: ~25% (random chance)]
    │
    └─→ [Writing sections: Skip or produce gibberish]
            ↓
            └─→ [Task completion: 15-30%]
```

---

## 3. System Usability Impact Chain

```
Language Barrier (English/Spanish)
    ↓
    ├─→ [Increased cognitive load]
    │       ↓
    │       ├─→ [User fatigue]
    │       └─→ [Reduced focus on exam content]
    │
    ├─→ [UI incomprehension]
    │       ↓
    │       ├─→ [Navigation errors]
    │       ├─→ [Form submission failures]
    │       └─→ [Lost progress (no auto-save)]
    │
    ├─→ [Time pressure]
    │       ↓
    │       └─→ [Rush to finish → Lower answer quality]
    │
    └─→ [Frustration accumulation]
            ↓
            ├─→ [Task abandonment (esp. Spanish)]
            └─→ [Negative user experience rating]
```

---

## 4. Exam Performance Prediction Chain

```
Agent Enters English Exam
    ↓
    ├─→ [Reading Comprehension Section]
    │   ├─→ Q1.1 (Easy): ~70% success (basic words recognizable)
    │   ├─→ Q1.2 (Medium): ~40% success (inferential reading required)
    │   └─→ Q1.3 (Difficult): ~20% success (nuanced understanding needed)
    │       └─→ [Section avg: ~43%]
    │
    ├─→ [Vocabulary & Grammar Section]
    │   ├─→ Q2.1 (Easy): ~60% success (tense pattern recognized)
    │   ├─→ Q2.2 (Medium): ~30% success (multiple clauses confusing)
    │   └─→ Q2.3 (Difficult): ~10% success (advanced structures unfamiliar)
    │       └─→ [Section avg: ~33%]
    │
    └─→ [Writing Section]
        ├─→ Q3.1 (Easy): ~40% completion (some attempt)
        │   └─→ [Minimal output, basic sentences]
        ├─→ Q3.2 (Medium): ~20% completion (very short responses)
        │   └─→ [Possibly incomplete, fragments]
        └─→ Q3.3 (Difficult): ~5% completion (likely skipped)
            └─→ [Section avg: ~22%]

Overall English Exam Score: ~33% (FAIL, threshold 67%)
```

---

## 5. Error & Friction Point Causation

```
FRICTION POINT: Slow English reading
    Root Cause: Limited vocabulary + unfamiliar grammar
    Effects:
    ├─→ Time spent per question: 5-8 min (vs. 2-3 min for Chinese)
    ├─→ Incomplete exam sections due to time running out
    └─→ User frustration & fatigue

FRICTION POINT: Writing section paralysis
    Root Cause: Zero confidence in English writing ability
    Effects:
    ├─→ Agent avoids writing sections
    ├─→ Blank responses or random key-smashing
    └─→ Score collapse in writing sections (0-10 points)

FRICTION POINT: Spanish exam abandonment
    Root Cause: Complete language incomprehension
    Effects:
    ├─→ Agent skips reading passages entirely
    ├─→ Random guessing (25% by chance)
    └─→ Possible early test termination (user gives up)

FRICTION POINT: Navigation in English UI
    Root Cause: UI labels and instructions are in English
    Effects:
    ├─→ Confusion on which button to click
    ├─→ Accidental form submission
    ├─→ Lost progress if page refreshes
    └─→ Requires manual recovery or task restart
```

---

## 6. Success Factor Dependency Tree

```
SUCCESS in Book Search Task depends on:
├─→ Chinese UI availability ✓ (ENABLED)
├─→ Functional search API ✓ (ASSUMED)
├─→ Clear navigation labels ✓ (ASSUMED)
└─→ Agent can read Chinese ✓ (GUARANTEED)
        └─→ OUTCOME: HIGH SUCCESS EXPECTED ✓

SUCCESS in English Exam depends on:
├─→ Agent English proficiency ✗ (LIMITED - agent has none/minimal)
├─→ Clear question text ✓ (PROVIDED)
├─→ Adequate time allocation ✗ (LIKELY INSUFFICIENT)
├─→ Support for answer correction ✓ (ASSUMED)
└─→ Clear submission UI ✗ (IN ENGLISH - NOT COMPREHENSIBLE)
        └─→ OUTCOME: LOW SUCCESS EXPECTED (25-45%) ✗

SUCCESS in Spanish Exam depends on:
├─→ Agent Spanish proficiency ✗ (ZERO - agent is Chinese speaker)
├─→ Clear question text ✓ (PROVIDED but IN SPANISH)
├─→ Adequate time allocation ✗ (INSUFFICIENT)
├─→ Cognate matching available ✗ (MINIMAL - few Spanish-Chinese cognates)
└─→ Clear submission UI ✗ (IN SPANISH - NOT COMPREHENSIBLE)
        └─→ OUTCOME: VERY LOW SUCCESS EXPECTED (15-30%) ✗
```

---

## 7. Feedback Loop & Learning Effects

```
ITERATION 1: First Exam Attempt
└─→ Agent experiences English difficulty
    └─→ Learns: "This language is hard for me"
        └─→ ITERATION 2: Approaches Spanish with lower expectations
            └─→ Agent experiences Spanish difficulty (worse)
                └─→ Learns: "This is even harder, might skip"
                    └─→ Possible: Early abandonment of Spanish exam

ALTERNATIVE: With Feedback/Support
└─→ Agent receives encouragement to retry
    └─→ Possible slight improvement on second attempt
    └─→ But: Without language knowledge, improvement limited
        └─→ Still expect: 30-50% success (below passing)
```

---

## 8. System Design Implications

```
OBSERVATION: Language barrier causes cascading failures

Primary Path:
Language incomprehension → Slow processing → Time pressure → Low quality → Exam failure

Secondary Paths:
Language incomprehension → Navigation confusion → Form errors → Lost data → Task restart

Mitigation Opportunities:
├─→ [Offer language selection before exam]
│   └─→ Can reduce UI friction by 30-40%
│
├─→ [Extend time limits for non-native speakers]
│   └─→ Can improve completion rate by 20-30%
│
├─→ [Provide glossary/translation support]
│   └─→ Can improve comprehension by 30-50%
│
└─→ [Auto-detect language proficiency]
    └─→ Can warn user of mismatch before starting
```

---

## 9. Metric Causation Map

```
Language Proficiency (Chinese)
    ↓
    ├─→ UI Comprehension Speed ← Navigation Errors
    │       ↓
    │       └─→ Task Completion Time
    │
    ├─→ Vocabulary Recognition Rate ← Exam Score
    │       ↓
    │       └─→ Accuracy on Multiple Choice
    │
    ├─→ Grammar Parsing Success ← Sentence Complexity
    │       ↓
    │       └─→ Reading Comprehension Accuracy
    │
    └─→ Free-form Writing Quality ← Fluency Level
            ↓
            └─→ Writing Section Score
```

---

## 10. Causal Relationships Summary Table

| Cause | Effect | Strength | Mitigation |
|-------|--------|----------|-----------|
| Native Chinese proficiency | Book search success | Very Strong ✓ | N/A |
| Limited English | Slow reading | Strong ✗ | Glossary, extra time |
| Zero Spanish | Random guessing | Very Strong ✗ | Language selection warning |
| Language barriers | Navigation errors | Moderate ✗ | Clear UI labels, translations |
| Time pressure | Incomplete exams | Strong ✗ | Extended time limits |
| Fatigue accumulation | Lower writing quality | Moderate ✗ | Breaks between sections |
| Cognitive load | Exam abandonment | Moderate ✗ | Simplified UI, support |
| UI incomprehension | Form submission errors | Moderate ✗ | Tooltip help, language support |
