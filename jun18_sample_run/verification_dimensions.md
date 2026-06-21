# 要验证哪些维度以及怎么去验证的文本 — Verification Dimensions & Methodology

## 1. Overview: What to Verify & How

This document defines **6 key dimensions** to validate the system's performance with a Chinese-only speaking agent attempting multilingual tasks. Each dimension has:
- **Definition**: What we're measuring
- **Hypothesis**: Expected behavior
- **Verification Method**: How to measure it
- **Success Criteria**: What counts as passing

---

## 2. Dimension 1: Native Language Task Success (Chinese)

### Definition
Agent's ability to complete information-seeking tasks in their native language (Chinese book search).

### Hypothesis
Chinese-native speaker should achieve high success rate on Chinese UI with proper book searches.

### Expected Behavior
- Find specific Chinese books by title
- Find books by Chinese authors
- Read and understand search results
- Navigate UI without errors
- Complete task in 2-3 minutes per search

### Verification Methods

#### Method 1.1: Task Completion Rate
```
Metric: (Successful searches / Total search attempts) × 100

Procedure:
1. Count total book search attempts
2. Count successful searches (book found & displayed)
3. Calculate completion percentage

Success Criteria:
- Chinese book search: ≥90% success rate
- Author search: ≥85% success rate
- Overall: ≥87% combined success rate

Tool: Automated API logging (count GET /search requests vs. 200 responses)
```

#### Method 1.2: Search Query Accuracy
```
Metric: Relevance score of search queries to expected results

Procedure:
1. Log all search queries sent by agent
2. Compare against expected queries for books
3. Evaluate query variations (fuzzy matching, typos, etc.)

Success Criteria:
- Exact match or fuzzy match: ≥90%
- Typos allowed: ≤10% queries
- Invalid queries: <5%

Tool: Query analysis dashboard; NLP similarity scoring
```

#### Method 1.3: Navigation Error Rate
```
Metric: (Navigation errors / Total UI interactions) × 100

Errors include:
- Clicking wrong button
- Form submission failures
- Lost session/progress
- Dead-end navigation

Procedure:
1. Track all UI interactions (clicks, form submissions)
2. Identify interactions that resulted in errors
3. Categorize error types

Success Criteria:
- Navigation errors: <5%
- Form submission success: ≥95%
- Session persistence: 100%

Tool: Browser interaction logging; frontend event tracking
```

#### Method 1.4: Time-to-Completion
```
Metric: Time spent per search task (seconds)

Procedure:
1. Record timestamp when task starts
2. Record timestamp when result is displayed
3. Calculate elapsed time
4. Average across multiple attempts

Success Criteria:
- Average time per search: 2-3 minutes
- No unexplained delays (>10 min per search)
- Consistent performance (low variance)

Tool: Server-side timer logging; performance monitoring
```

---

## 3. Dimension 2: Limited Language Exam Performance (English)

### Definition
Agent's ability to comprehend and respond to English-language exam despite limited English proficiency.

### Hypothesis
Chinese-native speaker with no English training should score below 50% on English exam, demonstrating language barrier impact.

### Expected Behavior
- Reading comprehension: 30-50% accuracy
- Vocabulary/grammar: 30-40% accuracy
- Writing sections: 10-30% completion (minimal output)
- Overall score: 25-45% (FAIL - below 67% threshold)

### Verification Methods

#### Method 2.1: Reading Comprehension Accuracy
```
Metric: (Correct answers / Total questions) × 100

Difficulty breakdown:
- Easy (Q1.1): Expected ~70% success
- Medium (Q1.2): Expected ~40% success
- Difficult (Q1.3): Expected ~20% success

Procedure:
1. Record agent's multiple-choice selections
2. Compare against answer key
3. Calculate accuracy per difficulty level
4. Analyze if agent struggles correlate with difficulty

Success Criteria (for demonstrating language barrier):
- Easy: 50-80% accuracy
- Medium: 20-50% accuracy
- Difficult: 10-30% accuracy
- Pattern: Clear degradation with difficulty ✓

Tool: Exam submission log; answer comparison script
```

#### Method 2.2: Vocabulary & Grammar Accuracy
```
Metric: (Correct answers / Total questions) × 100

Question types:
- Q2.1 (Easy): Simple past tense
- Q2.2 (Medium): Conditional tense
- Q2.3 (Difficult): Advanced vocabulary + structures

Procedure:
1. Evaluate each answer against rubric
2. Score: 1 point correct, 0 points incorrect
3. Aggregate per difficulty level
4. Note patterns (e.g., all tense questions wrong?)

Success Criteria (for demonstrating language barrier):
- Easy: 40-70% accuracy
- Medium: 20-40% accuracy
- Difficult: 5-20% accuracy
- Pattern: Tense understanding limited ✓

Tool: Answer key comparison; grammar error analysis
```

#### Method 2.3: Writing Quality Assessment
```
Metric: Writing score (0-5 points per question, 3 questions)
        Total writing points possible: 15
        Rubric dimensions:
        - Grammar correctness (0-5)
        - Vocabulary richness (0-5)
        - Content completeness (0-5)
        - Organization/coherence (0-5)

Procedure:
1. Retrieve agent's written responses
2. Evaluate against 5-point rubric for each question
3. Score each dimension independently
4. Aggregate to total writing score

Grading Guidelines:
- Q3.1 (Easy): Expect 1-2 points (minimal attempt)
- Q3.2 (Medium): Expect 0-1 points (very incomplete)
- Q3.3 (Difficult): Expect 0 points (skip/gibberish)

Success Criteria (for demonstrating language barrier):
- Writing completion rate: <50%
- Grammar errors: >70% of sentences
- Vocabulary use: Minimal/elementary level
- Average score: <2 out of 5 ✓

Tool: Manual rubric evaluation; response samples review
```

#### Method 2.4: Time-to-Answer Distribution
```
Metric: Time spent per question (seconds) + time to submission

Procedure:
1. Log timestamp for each question viewed
2. Log timestamp for answer submitted
3. Calculate time per question
4. Identify outliers (very long times = struggle)

Expected Patterns:
- Easy Q (Q1.1, Q2.1): 1-3 minutes per question
- Medium Q (Q1.2, Q2.2): 3-5 minutes per question (re-reading)
- Difficult Q (Q1.3, Q2.3): 5-8+ minutes per question (struggle)
- Writing Q (Q3.1-3.3): 5-10+ minutes per question

Success Criteria (for demonstrating language barrier):
- Time variance: High (5-10x across questions)
- Time increase with difficulty: Positive correlation ✓
- Time spent on writing: Disproportionately long or very short (skip)

Tool: Exam timer logging; time-per-question analytics
```

#### Method 2.5: Answer Certainty (Confidence Markers)
```
Metric: Uncertainty indicators in responses

Procedure:
1. Identify patterns indicating uncertainty:
   - Multiple answer changes (showing doubt)
   - Long hesitation periods (>5 min on single Q)
   - Incomplete responses (blanks submitted)
   - Random-looking answers (low confidence)

2. Count uncertainty indicators

Success Criteria (for demonstrating language barrier):
- Multiple answer changes: >20% of questions
- Blank submissions: >10% of total questions
- Detected struggle: Consistently on harder questions ✓

Tool: Answer change history logging; temporal analysis
```

---

## 4. Dimension 3: No Language Knowledge Exam (Spanish)

### Definition
Agent's performance when facing a language with zero prior knowledge (Spanish).

### Hypothesis
Chinese speaker with zero Spanish training should score near-random (~25%), demonstrating complete language barrier and possible task abandonment.

### Expected Behavior
- Random guessing strategy (no comprehension)
- Possible task abandonment (especially on writing)
- Overall score: 15-30% (near-random 25%, possibly lower due to giving up)

### Verification Methods

#### Method 3.1: Task Abandonment Rate
```
Metric: (Questions skipped / Total questions) × 100

Procedure:
1. Count total questions in Spanish exam (9 questions)
2. Count blank/skipped submissions
3. Calculate abandonment rate

Success Criteria (for demonstrating extreme language barrier):
- Abandonment rate: >30% (agent skips some sections)
- Writing sections: >70% skipped (expected)
- Overall: >20% abandonment ✓ (shows frustration/giving up)

Tool: Submission log analysis; blank answer detection
```

#### Method 3.2: Random Guessing Detection
```
Metric: Answer pattern analysis to identify random guessing

Procedure:
1. Analyze multiple-choice answers for patterns:
   - All A's, all B's (systematic random)
   - Alternating patterns (pseudo-random)
   - High variance (real random)

2. Compare against expected distribution:
   - Random should be ~25% accuracy
   - Guided guessing might be 30-35% (cognates)

3. Use statistical test (chi-square) to verify randomness

Success Criteria (for demonstrating language barrier):
- Accuracy rate: 20-35% (not better than random)
- Answer pattern: Statistically random distribution ✓
- No evidence of language comprehension

Tool: Statistical analysis tool; answer distribution dashboard
```

#### Method 3.3: Comprehension Markers
```
Metric: Evidence of language comprehension attempts

Procedure:
1. Identify if agent attempts comprehension:
   - Looking for cognates (pizza = pizza-like Spanish)
   - Attempting translations
   - Partial sentence understanding

2. Count attempts vs. blank responses

Success Criteria (for demonstrating language barrier):
- No cognate matching (Spanish-Chinese very different)
- No translation attempts detected
- Blank or gibberish responses: >80% of writing
- Zero comprehension signals ✓

Tool: Response content analysis; manual review of written answers
```

#### Method 3.4: Exam Duration & Completion Time
```
Metric: Time spent on Spanish exam vs. English exam

Procedure:
1. Record total time for Spanish exam
2. Compare to English exam duration
3. Analyze time per question

Expected Pattern:
- Spanish should be either:
  a) SHORTER (quick random guessing, no effort)
  b) LONGER (extreme struggle trying to understand)

Success Criteria (for demonstrating language barrier):
- Either very fast completion (task abandonment)
  OR very slow completion (frustrated struggle)
  Indicates confusion/desperation ✓

Tool: Exam timer logging; duration comparison analysis
```

---

## 5. Dimension 4: System Graceful Degradation

### Definition
System's ability to handle non-native speakers without crashing or losing data.

### Hypothesis
System should gracefully handle language barriers without errors, maintaining data integrity and user recovery options.

### Expected Behavior
- No crashes or 500 errors
- Completed work persists (no data loss)
- Clear error messages (even in English)
- Possible recovery/retry mechanisms

### Verification Methods

#### Method 4.1: System Error Rate
```
Metric: (Error responses / Total requests) × 100

Errors tracked:
- 5xx server errors
- 4xx client errors (invalid submissions)
- Timeouts
- API failures
- Data corruption

Procedure:
1. Monitor HTTP responses during exam
2. Count errors by type
3. Correlate with agent language struggles

Success Criteria (for graceful degradation):
- 5xx errors: 0%
- 4xx errors: <5% (some form validation OK)
- Timeout errors: 0%
- Data loss: 0 incidents
- Session persistence: 100%

Tool: Server logs; error tracking (Sentry, Datadog)
```

#### Method 4.2: Data Persistence
```
Metric: (Responses persisted / Responses submitted) × 100

Procedure:
1. Submit exam answers incrementally
2. Verify each submission is saved
3. Simulate session interruption and recovery
4. Check that all prior answers still exist

Success Criteria (for graceful degradation):
- All submissions persisted: 100%
- No data loss on session restart
- Ability to resume from last saved state
- Clear state indicator to user

Tool: Database audit; answer retrieval verification
```

#### Method 4.3: Language Switching Without Loss
```
Metric: (Successful language switches / Attempted switches) × 100

Procedure:
1. Switch from English to Chinese UI
2. Switch from Spanish back to Chinese
3. Verify no progress is lost
4. Verify no form data is cleared

Success Criteria (for graceful degradation):
- Language switch success: 100%
- Form data persistence: 100%
- Session continuity: 100%

Tool: Language switching test cases; form data comparison
```

#### Method 4.4: Error Message Clarity
```
Metric: Qualitative assessment of error messages

Procedure:
1. Collect all error messages shown during exam
2. Evaluate for:
   - Clarity and specificity
   - Language accessibility (even if in English)
   - Actionability (does it tell user what to do?)

Success Criteria (for graceful degradation):
- All error messages: Clear & actionable
- Spanish exam errors: Not shown in Spanish-only (confusing)
- Recovery options: Offered when possible
- User can proceed or retry

Tool: Manual QA review; error message catalog
```

---

## 6. Dimension 5: Language Barrier Incident Metrics

### Definition
Quantification of specific language-related friction points and their impact.

### Hypothesis
Specific language barriers (reading, vocabulary, writing) cause measurable delays and reduced task success.

### Expected Behavior
- Reading speed degrades with English difficulty
- Vocabulary gaps cause wrong answers
- Writing sections cause maximum friction
- Cumulative frustration leads to lower engagement

### Verification Methods

#### Method 5.1: Reading Speed Degradation
```
Metric: Words read per minute (WPM) by language/difficulty

Procedure:
1. For English exam reading sections:
   - Q1.1 (Easy): Count words in passage (~300)
   - Q1.2 (Medium): Count words (~400)
   - Q1.3 (Difficult): Count words (~400)

2. Calculate time spent reading each (from exam logs)

3. Calculate WPM = (word count) / (time in minutes)

4. Compare to Chinese search task (baseline native language speed)

Expected Pattern:
- Chinese (native): ~200-300 WPM
- English Q1.1 (easy): ~80-120 WPM (30-50% of native)
- English Q1.2 (medium): ~60-100 WPM (20-40% of native)
- English Q1.3 (difficult): ~40-80 WPM (15-30% of native)

Success Criteria (for demonstrating language barrier):
- Clear speed degradation with difficulty ✓
- English reading 50-70% slower than native
- Speed correlates with vocabulary difficulty

Tool: Passage word count + reading time logging; WPM calculation
```

#### Method 5.2: Vocabulary Comprehension Gap
```
Metric: Success rate on vocabulary questions vs. content questions

Procedure:
1. Separate questions into categories:
   - Vocabulary-dependent (Q2.1, Q2.2, Q2.3)
   - Content-dependent (Q1.1, Q1.2, Q1.3)

2. Calculate success rate per category

3. Compare to identify which causes more failure

Expected Pattern:
- Vocabulary questions: Lower success
- Content questions: Slightly higher (can infer from context)

Success Criteria (for demonstrating language barrier):
- Vocabulary accuracy: 20-40%
- Content accuracy: 30-50%
- Vocabulary is bottleneck ✓

Tool: Question categorization + answer analysis
```

#### Method 5.3: Writing Avoidance/Failure Metrics
```
Metric: Writing section completion and quality

Procedure:
1. Track if agent attempts writing questions:
   - Q3.1: Attempt rate
   - Q3.2: Attempt rate
   - Q3.3: Attempt rate

2. For attempted questions, measure:
   - Word count
   - Sentence count
   - Grammar error percentage

Expected Pattern:
- Q3.1 (easy): ~50% attempt, ~30 words, ~40% errors
- Q3.2 (medium): ~20% attempt, ~10 words, ~60% errors
- Q3.3 (difficult): ~5% attempt, ~5 words, ~80% errors

Success Criteria (for demonstrating language barrier):
- Writing completion: <30% overall
- Quality degradation: Clear with difficulty ✓
- Word count decline: Sharp drop in difficult questions

Tool: Response content analysis; word count + error detection
```

#### Method 5.4: Cumulative Frustration Indicator
```
Metric: Behavioral signals of increasing frustration

Indicators:
- Time between questions decreasing (rushing)
- Answer changes increasing (uncertainty)
- Error rates rising (less careful)
- Blank submissions increasing (giving up)

Procedure:
1. Track temporal patterns across exam progression
2. Identify if metrics get worse over time
3. Correlate with question difficulty

Success Criteria (for demonstrating language barrier):
- Clear trend: Early careful, late careless
- Blank submissions: Increase through exam ✓
- Answer quality: Degrades (less thought per question)
- Frustration signal: Statistically significant

Tool: Temporal analysis; trend detection
```

---

## 7. Dimension 6: User Experience & Engagement Metrics

### Definition
Overall user experience and engagement despite language barriers.

### Hypothesis
Language barriers should reduce engagement, satisfaction, and willingness to continue.

### Expected Behavior
- Lower satisfaction scores
- Early task abandonment (especially Spanish)
- Desire to switch to native language
- Lower engagement in challenging sections

### Verification Methods

#### Method 6.1: User Satisfaction Survey
```
Metric: Self-reported satisfaction (1-5 scale)

Questions:
1. "How comfortable were you with the interface?" (1-5)
2. "How clear were the instructions?" (1-5)
3. "How supported did you feel during challenges?" (1-5)
4. "Would you take this exam again?" (Yes/No)
5. "In which language was the exam easiest?" (Multiple choice)

Expected Results:
- Interface comfort: 2-3 (low, due to English)
- Instruction clarity: 2-3 (low, language barrier)
- Support feeling: 1-2 (minimal, no translator offered)
- Retake willingness: NO (80%+ response)
- Easiest language: Chinese (100% response)

Success Criteria (for demonstrating language barrier):
- Satisfaction: Below 3/5 average ✓
- Retake: <30% willing to retake
- Clear language preference: Chinese

Tool: Post-exam survey; feedback form
```

#### Method 6.2: Task Abandonment Rate
```
Metric: (Tasks abandoned / Tasks started) × 100

Procedure:
1. Track which exam sections agent starts
2. Track which sections are completed
3. Count incomplete sections

Expected Pattern:
- English exam: 80-90% completion (difficult but try)
- Spanish exam: 50-70% completion (very difficult, more likely to skip)

Success Criteria (for demonstrating language barrier):
- Spanish abandonment rate: >30%
- Writing section abandonment: >40%
- Clear inverse correlation with difficulty ✓

Tool: Exam completion tracking; section submission logs
```

#### Method 6.3: Request for Language Support
```
Metric: (Requests for translation / Total interactions) × 100

Procedure:
1. If UI offers language switching, track requests
2. If help/glossary is available, track access
3. Count user attempts to get support

Expected Pattern:
- Chinese search task: 0% support requests
- English exam: 5-15% support requests
- Spanish exam: 20-40% support requests

Success Criteria (for demonstrating language barrier):
- Support request trend: Increases with language difficulty ✓
- Spanish: High request rate shows effort despite struggle

Tool: UI interaction logging; help resource access tracking
```

#### Method 6.4: Engagement Level Over Time
```
Metric: Engagement score (time spent, interaction frequency, etc.)

Procedure:
1. Divide exam into 3 phases: Early (Q1-3), Middle (Q4-6), Late (Q7-9)
2. Calculate engagement per phase:
   - Time per question
   - Interactions per question
   - Error rate per question

Expected Pattern:
- Early phase: High engagement (fresh, hopeful)
- Middle phase: Moderate engagement (getting frustrated)
- Late phase: Low engagement (frustrated, rushing/giving up)

Success Criteria (for demonstrating language barrier):
- Engagement decline: Statistically significant ✓
- Late phase speed: 2-3x faster than early (rushing)
- Late phase errors: 2-3x higher (less careful)

Tool: Temporal engagement tracking; phase analysis
```

---

## 8. Verification Workflow

```
START: Agent begins test
   │
   ├─→ [Dimension 1: Chinese Task] ✓ HIGH SUCCESS EXPECTED
   │   └─→ Verify: >87% completion, <5% errors, 2-3 min per task
   │
   ├─→ [Dimension 2: English Exam] ✗ LOW SUCCESS EXPECTED
   │   └─→ Verify: 25-45% score, clear difficulty degradation
   │       └─→ Sub-dimensions:
   │           ├─ Reading: 30-50% accuracy ✗
   │           ├─ Vocabulary: 30-40% accuracy ✗
   │           └─ Writing: <30% completion ✗
   │
   ├─→ [Dimension 3: Spanish Exam] ✗ VERY LOW SUCCESS EXPECTED
   │   └─→ Verify: 15-30% score, >30% abandonment
   │       └─→ Sub-dimensions:
   │           ├─ Random guessing: ~25% accuracy ✓
   │           ├─ Task abandonment: >30% ✓
   │           └─ Comprehension: 0% signals ✓
   │
   ├─→ [Dimension 4: System Stability] ✓ GRACEFUL DEGRADATION EXPECTED
   │   └─→ Verify: 0 crashes, 100% data persistence, <5% errors
   │
   ├─→ [Dimension 5: Language Barriers] ✗ FRICTION EXPECTED
   │   └─→ Verify: Reading 50-70% slower, writing failed, cumulative frustration
   │
   └─→ [Dimension 6: User Experience] ✗ POOR UX EXPECTED
       └─→ Verify: <3/5 satisfaction, >30% Spanish abandonment, support requests
END: Generate report
```

---

## 9. Success Criteria Summary

| Dimension | Metric | Target | Status |
|-----------|--------|--------|--------|
| 1. Native Language | Chinese task success | ≥87% | PASS |
| 1. Native Language | Navigation errors | <5% | PASS |
| 2. English Exam | Overall score | 25-45% (FAIL threshold) | PASS ✓ |
| 2. English Exam | Writing completion | <30% | PASS ✓ |
| 3. Spanish Exam | Abandonment rate | >30% | PASS ✓ |
| 3. Spanish Exam | Random guessing | ~25% accuracy | PASS ✓ |
| 4. System Stability | Error rate | <5% | PASS |
| 4. System Stability | Data loss | 0 incidents | PASS |
| 5. Language Barriers | Reading degradation | 50-70% slower | PASS ✓ |
| 5. Language Barriers | Frustration signal | Statistically significant | PASS ✓ |
| 6. User Experience | Satisfaction | <3/5 average | PASS ✓ |
| 6. User Experience | Willingness to retake | <30% | PASS ✓ |

---

## 10. Failure Criteria (What Would Be a Problem)

| Issue | Concern | Mitigation |
|-------|---------|-----------|
| Chinese task fails | System broken, not language issue | Fix navigation/API |
| English/Spanish score too HIGH | Language barriers not real | Validate exam difficulty |
| System crashes on language switch | Graceful degradation failed | Fix language handling |
| Data loss occurs | System unreliable for all users | Fix persistence layer |
| No difference in performance | Persona not realistic | Adjust test design |
| User doesn't attempt non-native exams | Persona not realistic | Adjust persona instructions |
