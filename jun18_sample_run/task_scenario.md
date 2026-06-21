# 场景设计 & 环境 — Task Scenario Design & Environment Setup

## 1. Scenario Overview

### Primary Goal
Test how a multilingual system handles non-native speakers across information-seeking and language proficiency evaluation.

### Test Environment
- **Platform**: Library + Exam Platform (staging.library.local)
- **Frontend**: Multilingual UI (English, Spanish, Chinese)
- **Backend**: API-driven book search and exam submission
- **Data**: Synthetic library catalog + exam question bank
- **Isolation**: Network-restricted sandbox, no production data

---

## 2. Task Scenarios

### Scenario 1: Information Seeking (Book Search)

#### Setup
- Agent enters library search interface
- UI language defaults to Chinese (agent's native language)
- System has catalog of ~10,000 books (mixed languages)
- Search functionality: title, author, genre, availability

#### Tasks
1. **Find a specific Chinese book by title**
   - Task: Search for "活着" by Gao Xingjian
   - Expected behavior: Smooth navigation, successful find
   - Environment: Chinese UI, familiar task
   - Duration: 2-3 minutes
   - Success: Book record displayed with metadata

2. **Find books by Chinese author**
   - Task: Search for works by "莫言" (Mo Yan)
   - Expected behavior: Multiple results, agent selects books
   - Environment: Chinese author names, Chinese UI
   - Duration: 3-4 minutes
   - Success: Author profile + book list displayed

#### Environment Details
- **UI Language**: Simplified Chinese (default)
- **Book Metadata**: Title, author, ISBN, publication date, availability
- **Search Features**: Text input, filters, sorting, pagination
- **Feedback**: Result count, relevance score, availability status
- **Error Handling**: Graceful handling of no results, invalid queries

---

### Scenario 2: English Proficiency Exam

#### Setup
- Agent navigates to English exam section
- UI automatically switches to English (test language)
- Exam has 9 questions across 3 sections (reading, vocabulary, writing)
- Time limit: 45-60 minutes
- No access to external resources

#### Test Sections

**Section 1: Reading Comprehension (3 questions)**
- Q1.1 (Easy): Simple passage about a library
- Q1.2 (Medium): Climate change passage with inference required
- Q1.3 (Difficult): AI technology passage with nuanced understanding needed

Environment:
- Text-based passages (300-400 words each)
- Multiple choice answers (A, B, C, D)
- Timing: 2-3 min per question

**Section 2: Vocabulary & Grammar (3 questions)**
- Q2.1 (Easy): Simple past tense fill-in-the-blank
- Q2.2 (Medium): Conditional tense with multiple clauses
- Q2.3 (Difficult): Advanced vocabulary with context-dependent meaning

Environment:
- Single sentence or short phrase for context
- 4 multiple choice options
- Timing: 1-2 min per question

**Section 3: Writing (3 questions)**
- Q3.1 (Easy): Describe your hobby (2-3 sentences)
- Q3.2 (Medium): Describe a memorable experience (3-4 sentences)
- Q3.3 (Difficult): Argue a position on remote work (5-7 sentences)

Environment:
- Free-form text input box
- No spell-check or grammar assistance
- Timing: 5-8 min per question

#### Expected Agent Behavior
- Reading: Frustration, re-reading, pattern matching
- Vocabulary: Random guessing on difficult items
- Writing: Minimal output, possible code-switching to Chinese or gibberish
- Overall: Below 50% score (fail threshold ~67%)

---

### Scenario 3: Spanish Proficiency Exam

#### Setup
- Agent navigates to Spanish exam section
- UI switches to Spanish
- Agent has ZERO prior Spanish knowledge
- Exam has 9 questions (mirroring English structure)
- Time limit: 45-60 minutes

#### Test Sections
(Same 3-section structure as English: Reading, Vocabulary, Writing)
- Preguntas 1.1-1.3: Comprensión de lectura
- Preguntas 2.1-2.3: Vocabulario y gramática
- Preguntas 3.1-3.3: Escritura

#### Expected Agent Behavior
- High confusion: Spanish is completely unfamiliar
- Strategy: Cognate matching, random guessing
- Writing: Likely to skip or produce nonsense
- Overall: Below 30% score (severe fail, tests language barrier impact)

---

## 3. Environment Configuration

### Frontend Environment

```yaml
base_url: "https://staging.library.local"
languages: ["zh-CN", "en-US", "es-ES"]
default_language: "zh-CN"

ui_components:
  header: "Multilingual Library & Exam System"
  navigation: ["Search", "Account", "Exams", "Results"]
  footer: "Language selector, contact info"

search_interface:
  input_field: "Search by title, author, ISBN"
  filters: ["Language", "Genre", "Year Published", "Availability"]
  results_per_page: 20
  sort_by: ["Relevance", "Year", "Author Name"]

exam_interface:
  question_display: "One question per screen"
  submission: "Submit after each section or at end"
  timer: "Progress bar showing time remaining"
  navigation: "Back/Next buttons between questions"
```

### Backend Environment

```yaml
api_base: "https://staging.library.local/api"

endpoints:
  /search: "POST book search query"
  /books/{id}: "GET book details"
  /exams/english: "GET English exam questions"
  /exams/spanish: "GET Spanish exam questions"
  /submit/exam: "POST exam answers"
  /results/{exam_id}: "GET exam score & feedback"

database:
  books: "SQLite table with ~10,000 synthetic books"
  exam_questions: "Question bank with metadata (difficulty, answer)"
  user_submissions: "Exam responses and timestamps"
  metrics: "Language comprehension, time spent, errors"
```

### Data Environment

```yaml
book_catalog:
  total_records: 10000
  chinese_books: 3000
  english_books: 4000
  spanish_books: 2000
  mixed_language: 1000

sample_books:
  - title: "活着"
    author: "高行健"
    language: "zh-CN"
    year: 1993
    
  - title: "莫言作品集"
    author: "莫言"
    language: "zh-CN"
    year: 2012

exam_questions:
  english: 9 questions (3 easy, 3 medium, 3 difficult)
  spanish: 9 questions (3 easy, 3 medium, 3 difficult)
  total_variants: 10 per question (to prevent memorization)
```

### Test Account

```yaml
credentials:
  username: "persona-zh@library.local"
  password: "env:MATRAIX_PERSONA_PW"
  
profile:
  name: "Zhang Ming (张明)"
  language_preference: "zh-CN"
  exam_history: []
  search_history: []
```

---

## 4. Task Flow Timeline

```
T0:00   Agent logs in
T0:05   Navigate to Book Search section
T0:08   Search for "活着" (successful)
T0:13   View book details, initiate another search
T0:18   Search for "莫言" author works (successful)
T0:25   Navigate to English Exam section
T0:27   UI switches to English (first friction point)
T0:30   Begin Reading Comprehension Q1.1 (easy, manageable)
T1:35   Complete Reading Comprehension Q1.3 (difficult, high frustration)
T1:40   Complete Vocabulary & Grammar (with struggles)
T2:15   Begin Writing section (severe difficulty)
T3:00   Submit English exam (partial completion)
T3:05   Navigate to Spanish Exam section
T3:07   UI switches to Spanish (severe friction, near-zero comprehension)
T3:10   Attempt Spanish Reading Q1.1 (random guessing)
T4:00   Likely abandoning or skipping most Spanish questions
T4:30   Submit Spanish exam (minimal completion)
```

---

## 5. Environment Validation Checklist

- [ ] Book database has all required Chinese titles and authors
- [ ] Search functionality works in Chinese UI
- [ ] English exam questions load correctly
- [ ] Spanish exam questions load correctly
- [ ] Language switching does not lose user progress
- [ ] All API endpoints respond within SLA (< 500ms)
- [ ] Error messages display in appropriate language
- [ ] Timer and progress tracking work correctly
- [ ] Exam submissions store responses with metadata (time, attempt count)
- [ ] Metrics logging captures language barrier incidents

---

## 6. Expected System Behaviors

### Graceful Degradation Points
1. **English reading with Chinese-native speaker**: System should show progress even if comprehension is low
2. **Spanish exam with zero knowledge**: System should accept blank/random responses without crashing
3. **Language switching**: No data loss when changing UI language mid-task
4. **Timeouts**: Clear messaging if exam session expires

### Friction Points to Document
- Time spent reading English passages (expect 2-3x longer than Chinese)
- Number of times agent returns to search interface (escape hatch?)
- Error click rates (invalid answers, submission failures)
- Language switching events within same exam
- Response quality degradation (writing sections especially)
