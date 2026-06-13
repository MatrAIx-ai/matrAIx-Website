/* ============================================================
   matrAIx — dimension schema generator
   Keeps the curated core dimensions and expands the flat persona
   space toward 1,000 via families of genuinely meaningful axes
   (familiarity, proficiency, attitude, interest, ...).
   Run:  node generate-dimensions.js
   ============================================================ */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'dimensions.json');
const existing = JSON.parse(fs.readFileSync(FILE, 'utf8'));

// Family id prefixes — used to strip previously generated dims so re-running is idempotent.
const PREFIXES = ['fam_', 'skill_', 'tool_', 'topic_', 'lang_', 'att_', 'ind_', 'cult_',
  'musg_', 'filmg_', 'bookg_', 'cuis_', 'sport_', 'prog_', 'big5_', 'lstyle_', 'cog_', 'health_',
  'hob_', 'acad_', 'peeve_', 'trait_', 'val_', 'habit_', 'pref_', 'demo_', 'lifex_'];

const core = existing.dimensions.filter(d => !PREFIXES.some(p => d.id.startsWith(p)));

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const out = [...core];
const seen = new Set(out.map(d => d.id));
function push(id, label, category, description, values) {
  if (seen.has(id)) return;
  seen.add(id);
  out.push({ id, label, category, description, values });
}

/* ---- shared value scales ---- */
const FAM   = ['Expert', 'Proficient', 'Familiar', 'Aware', 'None'];
const SKILL = ['Master', 'Advanced', 'Intermediate', 'Beginner', 'None'];
const TOOL  = ['Power user', 'Regular', 'Occasional', 'Tried it', 'Never used'];
const INT   = ['Passionate', 'Interested', 'Neutral', 'Indifferent', 'Averse'];
const LANG  = ['Native', 'Fluent', 'Conversational', 'Basic', 'None'];
const ATT   = ['Enthusiast', 'Positive', 'Neutral', 'Skeptical', 'Opposed'];
const IND   = ['Veteran', 'Experienced', 'Some exposure', 'None'];
const CULT  = ['Native', 'Lived there', 'Visited', 'Studied', 'Unfamiliar'];
const GENRE = ['Love', 'Like', 'Neutral', 'Dislike'];
const CUIS  = ['Love', 'Like', 'Neutral', 'Avoid'];
const SPORT = ['Play', 'Follow', 'Casual', 'None'];
const PROG  = ['Expert', 'Proficient', 'Familiar', 'None'];
const BIG5  = ['Very high', 'High', 'Average', 'Low', 'Very low'];
const FREQ  = ['Daily', 'Weekly', 'Monthly', 'Rarely', 'Never'];
const LEVEL = ['Very high', 'High', 'Moderate', 'Low', 'None'];
const IMP   = ['Core value', 'Important', 'Moderate', 'Minor', 'Irrelevant'];
const STR   = ['Signature', 'Strong', 'Moderate', 'Slight', 'Absent'];

/* ---- subject lists ---- */
const DOMAINS = ['Machine learning', 'Deep learning', 'Statistics', 'Data science', 'Cardiology', 'Neurology',
  'Oncology', 'Pediatrics', 'Psychiatry', 'Radiology', 'Surgery', 'Immunology', 'Constitutional law',
  'Contract law', 'Criminal law', 'Tax law', 'Intellectual property', 'Corporate finance', 'Quantitative trading',
  'Accounting', 'Auditing', 'Macroeconomics', 'Microeconomics', 'Behavioral economics', 'Curriculum design',
  'Pedagogy', 'Special education', 'Structural engineering', 'Mechanical engineering', 'Electrical engineering',
  'Civil engineering', 'Chemical engineering', 'Aerospace engineering', 'Robotics', 'Control systems',
  'Molecular biology', 'Genetics', 'Biochemistry', 'Organic chemistry', 'Physical chemistry', 'Particle physics',
  'Astrophysics', 'Astronomy', 'Geology', 'Oceanography', 'Climate science', 'Ecology', 'Sociology', 'Psychology',
  'Cognitive science', 'Anthropology', 'Political science', 'International relations', 'Comparative literature',
  'Philosophy', 'Ethics', 'History', 'Archaeology', 'Linguistics', 'Art history', 'Music theory', 'Film studies',
  'Architecture', 'Urban planning', 'Landscape design', 'Agronomy', 'Horticulture', 'Veterinary medicine',
  'Nursing', 'Pharmacology', 'Public health', 'Epidemiology', 'Nutrition', 'Sports science', 'Cybersecurity',
  'Cryptography', 'Computer networking', 'Databases', 'Distributed systems', 'Operating systems', 'Compilers',
  'Cloud infrastructure', 'DevOps', 'Game development', 'Computer graphics', 'Computer vision', 'Natural language processing',
  'Human-computer interaction', 'UX research', 'Graphic design', 'Industrial design', 'Typography', 'Journalism',
  'Public relations', 'Brand marketing', 'Performance marketing', 'SEO', 'Sales engineering', 'Supply chain',
  'Logistics', 'Operations management', 'Lean manufacturing', 'Quality assurance', 'Human resources',
  'Organizational psychology', 'Project management', 'Product management', 'Venture capital', 'Private equity',
  'Real estate', 'Insurance', 'Actuarial science', 'Hospitality management', 'Culinary arts', 'Sommelier knowledge',
  'Fashion design', 'Textiles', 'Photography', 'Cinematography', 'Music production', 'Sound engineering',
  'Animation', '3D modeling', 'Geographic information systems', 'Meteorology', 'Forestry', 'Marine biology',
  'Paleontology', 'Materials science', 'Nanotechnology', 'Renewable energy', 'Nuclear engineering',
  'Petroleum engineering', 'Mining', 'Aviation', 'Maritime navigation', 'Military strategy', 'Diplomacy',
  'Social work', 'Counseling', 'Theology', 'Religious studies', 'Library science'];

const SKILLS = ['Writing', 'Copywriting', 'Editing', 'Storytelling', 'Public speaking', 'Negotiation', 'Coding',
  'Debugging', 'Code review', 'System design', 'Data analysis', 'Data visualization', 'Statistical modeling',
  'Spreadsheet modeling', 'Financial modeling', 'Project management', 'Product strategy', 'Leadership',
  'People management', 'Mentoring', 'Coaching', 'Conflict resolution', 'Time management', 'Prioritization',
  'Research', 'Critical thinking', 'Problem solving', 'Mathematics', 'Mental arithmetic', 'Logical reasoning',
  'Language learning', 'Translation', 'Interpretation', 'Design thinking', 'Prototyping', 'Sketching', 'Drawing',
  'Painting', 'Photography', 'Videography', 'Video editing', 'Audio production', 'Cooking', 'Baking', 'Budgeting',
  'Investing', 'DIY repair', 'Gardening', 'Driving', 'Technical writing', 'Note-taking', 'Speed reading',
  'Memorization', 'Active listening', 'Empathy', 'Persuasion', 'Facilitation', 'Forecasting', 'Estimation',
  'Fact-checking', 'Proofreading', 'Presenting', 'Networking', 'Selling'];

const TOOLS = ['Excel', 'Google Sheets', 'Python', 'R', 'SQL', 'Tableau', 'Power BI', 'Looker', 'Figma', 'Sketch',
  'Photoshop', 'Illustrator', 'InDesign', 'After Effects', 'Premiere Pro', 'Notion', 'Obsidian', 'Jira',
  'Linear', 'Slack', 'Microsoft Teams', 'Salesforce', 'HubSpot', 'SAP', 'Oracle ERP', 'Git', 'GitHub', 'GitLab',
  'Docker', 'Kubernetes', 'Terraform', 'AWS', 'Azure', 'Google Cloud', 'VS Code', 'JetBrains IDEs', 'Vim',
  'Jupyter', 'MATLAB', 'Stata', 'SPSS', 'SAS', 'Word', 'PowerPoint', 'Keynote', 'Canva', 'Blender', 'AutoCAD',
  'SolidWorks', 'Revit', 'Unity', 'Unreal Engine', 'Linux CLI', 'WordPress', 'Webflow', 'Shopify', 'Stripe',
  'QuickBooks', 'Xero', 'Zoom', 'Trello', 'Asana', 'Airtable', 'ChatGPT', 'Claude', 'GitHub Copilot', 'Midjourney',
  'Zapier', 'Postman'];

const TOPICS = ['Politics', 'Sports', 'Fitness', 'Travel', 'Cooking', 'Gaming', 'Fashion', 'Technology', 'Science',
  'Space', 'Personal finance', 'Investing', 'Cryptocurrency', 'Real estate', 'Parenting', 'Pets', 'Gardening',
  'Home improvement', 'Cars', 'Motorcycles', 'Cycling', 'Running', 'Photography', 'Film', 'TV series', 'Anime',
  'Comics', 'Music', 'Live concerts', 'Theater', 'Visual art', 'Literature', 'Poetry', 'History', 'Philosophy',
  'Religion', 'Spirituality', 'Meditation', 'Yoga', 'Hiking', 'Camping', 'Fishing', 'Birdwatching', 'Board games',
  'Tabletop RPGs', 'Puzzles', 'Chess', 'Astrology', 'True crime', 'Podcasts', 'Social media', 'Volunteering',
  'Activism', 'Environment', 'Sustainability', 'Wine', 'Coffee', 'Craft beer', 'Tea', 'Baking', 'Interior design',
  'Architecture', 'Languages', 'Genealogy', 'Collecting', 'Knitting', 'Woodworking', 'Calligraphy', 'Dance',
  'Stand-up comedy', 'Magic tricks', 'Astronomy', 'Robotics', 'Drones', '3D printing', 'Investmentoring',
  'Entrepreneurship', 'Productivity', 'Self-improvement', 'Mindfulness'];

const LANGUAGES = ['English', 'Mandarin', 'Cantonese', 'Spanish', 'Hindi', 'Arabic', 'French', 'Portuguese',
  'Bengali', 'Russian', 'Japanese', 'German', 'Korean', 'Italian', 'Turkish', 'Vietnamese', 'Thai', 'Indonesian',
  'Malay', 'Swahili', 'Dutch', 'Polish', 'Ukrainian', 'Persian', 'Hebrew', 'Greek', 'Czech', 'Hungarian',
  'Romanian', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Tagalog', 'Urdu', 'Tamil', 'Telugu', 'Marathi',
  'Punjabi', 'Gujarati', 'Hausa', 'Yoruba', 'Igbo', 'Amharic', 'Zulu', 'Afrikaans', 'Serbian', 'Croatian',
  'Bulgarian', 'Slovak'];

const ATTITUDES = ['AI', 'Automation', 'Data privacy', 'Social media', 'Remote work', 'Globalization', 'Immigration',
  'Free markets', 'Government regulation', 'Climate action', 'Nuclear energy', 'Renewable energy',
  'Genetic engineering', 'Vaccines', 'Alternative medicine', 'Organized religion', 'Traditional gender roles',
  'Cryptocurrency', 'The gig economy', 'Labor unions', 'Higher education', 'Homeownership', 'Taking on debt',
  'Risk-taking', 'Authority', 'Rapid change', 'New technology', 'Brand loyalty', 'Advertising', 'Influencers',
  'Online reviews', 'Subscription services', 'Open source', 'Surveillance', 'Self-driving cars',
  'Space exploration', 'Universal basic income', 'Minimalism', 'Consumerism', 'Veganism', 'Fast fashion',
  'Gun ownership', 'Capital punishment', 'Free speech', 'Privacy vs security', 'Globalized supply chains',
  'Working from office', 'Four-day work week', 'Performance reviews', 'Standardized testing', 'Tipping culture',
  'Electric vehicles', 'Public transit', 'Urban density', 'Gentrification'];

const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Banking', 'Insurance', 'Retail', 'E-commerce',
  'Manufacturing', 'Automotive', 'Aerospace', 'Energy', 'Oil & gas', 'Utilities', 'Construction', 'Real estate',
  'Hospitality', 'Travel & tourism', 'Restaurants', 'Agriculture', 'Food & beverage', 'Pharmaceuticals',
  'Biotech', 'Telecommunications', 'Media', 'Entertainment', 'Gaming', 'Publishing', 'Advertising', 'Education',
  'Government', 'Defense', 'Nonprofit', 'Logistics', 'Transportation', 'Shipping', 'Mining', 'Chemicals',
  'Textiles', 'Apparel', 'Consumer electronics', 'Semiconductors', 'Legal services', 'Consulting', 'Accounting',
  'Marketing agencies', 'Fitness & wellness', 'Beauty & cosmetics', 'Sports', 'Music', 'Fine art'];

const CULTURES = ['United States', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'United Kingdom', 'France', 'Germany',
  'Italy', 'Spain', 'Netherlands', 'Sweden', 'Poland', 'Russia', 'Turkey', 'Egypt', 'Saudi Arabia', 'UAE',
  'Israel', 'Iran', 'Nigeria', 'Kenya', 'South Africa', 'Ethiopia', 'India', 'Pakistan', 'Bangladesh', 'China',
  'Japan', 'South Korea', 'Vietnam', 'Thailand', 'Indonesia', 'Philippines', 'Australia', 'New Zealand',
  'Singapore', 'Malaysia', 'Greece', 'Portugal'];

const MUSIC = ['Pop', 'Rock', 'Hip-hop', 'R&B', 'Jazz', 'Blues', 'Classical', 'Opera', 'Country', 'Folk', 'Reggae',
  'Reggaeton', 'Electronic', 'House', 'Techno', 'Trance', 'Drum & bass', 'Metal', 'Punk', 'Indie', 'K-pop',
  'J-pop', 'Latin', 'Afrobeats', 'Gospel', 'Soul', 'Funk', 'Disco', 'Ambient', 'Lo-fi', 'Bluegrass', 'Ska',
  'Synthwave', 'Trap', 'Bollywood'];

const FILM = ['Action', 'Adventure', 'Comedy', 'Drama', 'Horror', 'Thriller', 'Sci-fi', 'Fantasy', 'Romance',
  'Documentary', 'Animation', 'Crime', 'Mystery', 'Historical', 'War', 'Western', 'Musical', 'Noir',
  'Superhero', 'Indie film', 'Art house', 'Biopic', 'Comedy-drama', 'Disaster'];

const BOOKS = ['Literary fiction', 'Science fiction', 'Fantasy', 'Mystery', 'Thriller', 'Romance', 'Historical fiction',
  'Horror', 'Biography', 'Memoir', 'Self-help', 'Business', 'Popular science', 'History', 'Philosophy', 'Poetry',
  'Young adult', 'Graphic novels', 'True crime', 'Travel writing', 'Cookbooks', 'Essays'];

const CUISINES = ['Italian', 'French', 'Spanish', 'Greek', 'Mexican', 'Peruvian', 'Brazilian', 'American BBQ',
  'Southern soul food', 'Cajun', 'Chinese', 'Sichuan', 'Cantonese', 'Japanese', 'Korean', 'Thai', 'Vietnamese',
  'Indian', 'Pakistani', 'Middle Eastern', 'Lebanese', 'Turkish', 'Moroccan', 'Ethiopian', 'Nigerian',
  'Caribbean', 'German', 'Scandinavian', 'Russian', 'Spanish tapas', 'Sushi', 'Ramen', 'Vegan', 'Vegetarian',
  'Seafood'];

const SPORTS = ['Soccer', 'Basketball', 'American football', 'Baseball', 'Tennis', 'Golf', 'Cricket', 'Rugby',
  'Hockey', 'Volleyball', 'Swimming', 'Running', 'Cycling', 'Boxing', 'MMA', 'Wrestling', 'Skiing', 'Snowboarding',
  'Surfing', 'Skateboarding', 'Climbing', 'Gymnastics', 'Track & field', 'Badminton', 'Table tennis', 'Squash',
  'Sailing', 'Rowing', 'Martial arts', 'Yoga', 'Pilates', 'CrossFit', 'Weightlifting', 'Esports', 'Darts',
  'Bowling', 'Archery', 'Equestrian', 'Fencing', 'Triathlon'];

const PROGRAMMING = ['Python', 'JavaScript', 'TypeScript', 'Java', 'C', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP',
  'Swift', 'Kotlin', 'Objective-C', 'Scala', 'Haskell', 'Elixir', 'Erlang', 'Clojure', 'Lua', 'Perl', 'R',
  'Julia', 'MATLAB', 'SQL', 'Bash', 'PowerShell', 'Dart', 'F#', 'OCaml', 'Assembly', 'COBOL', 'Fortran',
  'Solidity', 'GraphQL'];

const BIGFIVE = [
  ['Imagination', 'Openness'], ['Artistic interest', 'Openness'], ['Emotionality', 'Openness'],
  ['Adventurousness', 'Openness'], ['Intellect', 'Openness'], ['Liberalism', 'Openness'],
  ['Self-efficacy', 'Conscientiousness'], ['Orderliness', 'Conscientiousness'], ['Dutifulness', 'Conscientiousness'],
  ['Achievement-striving', 'Conscientiousness'], ['Self-discipline', 'Conscientiousness'], ['Cautiousness', 'Conscientiousness'],
  ['Friendliness', 'Extraversion'], ['Gregariousness', 'Extraversion'], ['Assertiveness', 'Extraversion'],
  ['Activity level', 'Extraversion'], ['Excitement-seeking', 'Extraversion'], ['Cheerfulness', 'Extraversion'],
  ['Trust', 'Agreeableness'], ['Morality', 'Agreeableness'], ['Altruism', 'Agreeableness'],
  ['Cooperation', 'Agreeableness'], ['Modesty', 'Agreeableness'], ['Sympathy', 'Agreeableness'],
  ['Anxiety', 'Neuroticism'], ['Anger', 'Neuroticism'], ['Depression', 'Neuroticism'],
  ['Self-consciousness', 'Neuroticism'], ['Immoderation', 'Neuroticism'], ['Vulnerability', 'Neuroticism'],
];

/* ---- custom families: lifestyle / cognition / health ---- */
const LIFESTYLE = [
  ['sleep_schedule', 'Sleep schedule', ['Early bird', 'Night owl', 'Irregular', 'Flexible', 'Shift-based']],
  ['exercise_freq', 'Exercise frequency', FREQ],
  ['diet_type', 'Diet type', ['Omnivore', 'Flexitarian', 'Vegetarian', 'Vegan', 'Pescatarian', 'Keto/low-carb']],
  ['alcohol_use', 'Alcohol use', ['Never', 'Rarely', 'Socially', 'Regularly', 'Heavily']],
  ['smoking', 'Smoking / vaping', ['Never', 'Former', 'Occasional', 'Regular']],
  ['caffeine', 'Caffeine intake', ['None', 'Low', 'Moderate', 'High']],
  ['cooking_freq', 'Cooking frequency', FREQ],
  ['shopping_style', 'Shopping style', ['Researcher', 'Impulse buyer', 'Bargain hunter', 'Brand loyal', 'Minimalist']],
  ['travel_freq', 'Travel frequency', ['Frequent flyer', 'A few trips/yr', 'Occasional', 'Rare', 'Homebody']],
  ['commute_mode', 'Commute mode', ['Car', 'Public transit', 'Bike', 'Walk', 'Remote', 'Rideshare']],
  ['pet_ownership', 'Pet ownership', ['Dog', 'Cat', 'Multiple pets', 'Other', 'None']],
  ['household_size', 'Household size', ['Lives alone', '2 people', '3–4 people', '5+ people', 'Communal']],
  ['work_schedule', 'Work schedule', ['9-to-5', 'Flexible hours', 'Shift work', 'On-call', 'Freelance', 'Unemployed']],
  ['screen_time', 'Daily screen time', ['<2 hrs', '2–4 hrs', '4–8 hrs', '8+ hrs']],
  ['social_battery', 'Social battery', ['Strong introvert', 'Introvert', 'Ambivert', 'Extrovert', 'Strong extrovert']],
  ['planning_horizon', 'Planning horizon', ['Day-to-day', 'Weekly', 'Monthly', 'Yearly', 'Multi-year']],
  ['punctuality', 'Punctuality', ['Always early', 'On time', 'Usually late', 'Unpredictable']],
  ['tidiness', 'Tidiness', ['Spotless', 'Tidy', 'Lived-in', 'Cluttered', 'Chaotic']],
  ['frugality', 'Spending vs saving', ['Frugal saver', 'Balanced', 'Spender', 'Splurger']],
  ['giving', 'Charitable giving', ['Regular donor', 'Occasional', 'Rare', 'Never']],
  ['news_freq', 'News consumption', ['Constant', 'Daily', 'Weekly', 'Rarely', 'Avoids news']],
  ['reading_freq', 'Reading frequency', FREQ],
  ['gaming_freq', 'Gaming frequency', FREQ],
  ['streaming_hours', 'Streaming hours/week', ['0–2', '3–7', '8–15', '16+']],
  ['music_listening', 'Music listening', ['All day', 'Daily', 'Sometimes', 'Rarely']],
  ['podcast_listening', 'Podcast listening', FREQ],
  ['primary_social', 'Primary social platform', ['Instagram', 'TikTok', 'X / Twitter', 'Facebook', 'LinkedIn', 'YouTube', 'Reddit', 'None']],
  ['primary_messenger', 'Primary messenger', ['WhatsApp', 'iMessage', 'WeChat', 'Telegram', 'Signal', 'Messenger', 'SMS']],
  ['device_ecosystem', 'Device ecosystem', ['Apple', 'Android/Google', 'Windows', 'Mixed', 'Linux']],
  ['browser', 'Primary browser', ['Chrome', 'Safari', 'Firefox', 'Edge', 'Brave', 'Other']],
  ['payment_pref', 'Payment preference', ['Credit card', 'Debit card', 'Mobile wallet', 'Cash', 'BNPL', 'Crypto']],
  ['banking_style', 'Banking style', ['Traditional bank', 'Neobank', 'Credit union', 'Mostly cash', 'Unbanked']],
  ['investment_style', 'Investment style', ['Index investor', 'Active trader', 'Crypto-heavy', 'Real estate', 'Cash saver', 'None']],
  ['subscription_count', 'Active subscriptions', ['0–2', '3–5', '6–10', '10+']],
  ['coffee_ritual', 'Coffee ritual', ['Home brew', 'Café regular', 'Office coffee', 'Tea instead', 'None']],
  ['fashion_sense', 'Fashion sense', ['Trend-setter', 'Trend-follower', 'Classic', 'Practical', 'Indifferent']],
  ['hobby_intensity', 'Hobby intensity', ['Obsessive', 'Dedicated', 'Casual', 'Dabbler', 'None']],
  ['vacation_style', 'Vacation style', ['Adventure', 'Relaxation', 'Culture', 'Luxury', 'Budget backpacking', 'Staycation']],
  ['morning_routine', 'Morning routine', ['Highly structured', 'Loosely structured', 'Rushed', 'Slow', 'None']],
  ['volunteering', 'Volunteering', FREQ],
];

const COGNITION = [
  ['verbosity', 'Verbosity', ['Terse', 'Concise', 'Balanced', 'Wordy', 'Rambling']],
  ['formality', 'Formality', ['Very formal', 'Formal', 'Neutral', 'Casual', 'Slangy']],
  ['directness', 'Directness', ['Blunt', 'Direct', 'Balanced', 'Indirect', 'Evasive']],
  ['humor', 'Humor style', ['Dry', 'Sarcastic', 'Playful', 'Wholesome', 'Serious']],
  ['detail_orientation', 'Detail orientation', LEVEL],
  ['abstraction', 'Abstract vs concrete', ['Highly abstract', 'Abstract', 'Balanced', 'Concrete', 'Very concrete']],
  ['optimism', 'Optimism', LEVEL],
  ['patience', 'Patience', LEVEL],
  ['curiosity', 'Curiosity', LEVEL],
  ['skepticism', 'Skepticism', LEVEL],
  ['open_mindedness', 'Open-mindedness', LEVEL],
  ['assertiveness', 'Assertiveness', LEVEL],
  ['emotional_expressiveness', 'Emotional expressiveness', LEVEL],
  ['conflict_approach', 'Conflict approach', ['Confronting', 'Collaborative', 'Compromising', 'Avoidant', 'Accommodating']],
  ['feedback_receptiveness', 'Feedback receptiveness', LEVEL],
  ['ambiguity_tolerance', 'Ambiguity tolerance', LEVEL],
  ['perfectionism', 'Perfectionism', LEVEL],
  ['procrastination', 'Procrastination tendency', LEVEL],
  ['multitasking', 'Multitasking', ['Heavy multitasker', 'Some', 'Prefers single-task', 'Strict monotasker']],
  ['attention_span', 'Attention span', ['Very long', 'Long', 'Average', 'Short', 'Very short']],
  ['learning_pace', 'Learning pace', ['Very fast', 'Fast', 'Average', 'Deliberate', 'Slow']],
  ['question_asking', 'Question-asking', ['Asks constantly', 'Asks often', 'Sometimes', 'Rarely asks']],
  ['decision_speed', 'Decision speed', ['Snap decisions', 'Quick', 'Balanced', 'Deliberate', 'Agonizes']],
  ['confidence_calibration', 'Confidence calibration', ['Overconfident', 'Confident', 'Well-calibrated', 'Cautious', 'Underconfident']],
  ['numeracy_comfort', 'Numeracy comfort', LEVEL],
  ['reading_vs_watching', 'Reading vs watching', ['Strongly prefers reading', 'Prefers reading', 'No preference', 'Prefers video', 'Strongly prefers video']],
  ['visual_vs_verbal', 'Visual vs verbal thinking', ['Strongly visual', 'Visual', 'Mixed', 'Verbal', 'Strongly verbal']],
  ['big_picture_vs_detail', 'Big-picture vs detail', ['Big-picture only', 'Big-picture', 'Both', 'Detail', 'Detail-obsessed']],
  ['risk_framing', 'Risk framing', ['Opportunity-focused', 'Balanced', 'Threat-focused']],
  ['empathy_expression', 'Empathy expression', LEVEL],
  ['storytelling', 'Storytelling tendency', LEVEL],
  ['precision_of_language', 'Precision of language', ['Very precise', 'Precise', 'Average', 'Loose', 'Vague']],
  ['use_of_jargon', 'Use of jargon', ['Heavy', 'Moderate', 'Light', 'Avoids jargon']],
  ['emoji_use', 'Emoji / emoticon use', ['Heavy', 'Moderate', 'Rare', 'Never']],
  ['politeness', 'Politeness', ['Very polite', 'Polite', 'Neutral', 'Brusque', 'Rude']],
];

const HEALTH = [
  ['general_health', 'General health', ['Excellent', 'Good', 'Fair', 'Poor']],
  ['chronic_condition', 'Chronic condition', ['None', 'Managed', 'Multiple', 'Undiagnosed concerns']],
  ['mobility', 'Mobility', ['Full', 'Mild limitation', 'Moderate limitation', 'Uses mobility aid']],
  ['vision', 'Vision', ['Normal', 'Corrected', 'Low vision', 'Blind']],
  ['hearing', 'Hearing', ['Normal', 'Mild loss', 'Moderate loss', 'Deaf / hard of hearing']],
  ['color_vision', 'Color vision', ['Typical', 'Color-blind']],
  ['dexterity', 'Manual dexterity', ['Full', 'Reduced', 'Limited', 'Assistive needed']],
  ['mental_health', 'Mental health', ['Thriving', 'Stable', 'Struggling', 'In crisis']],
  ['stress_level', 'Stress level', LEVEL],
  ['energy_level', 'Energy level', LEVEL],
  ['sleep_quality', 'Sleep quality', ['Excellent', 'Good', 'Fair', 'Poor']],
  ['pain_level', 'Chronic pain', ['None', 'Mild', 'Moderate', 'Severe']],
  ['medication_use', 'Medication use', ['None', 'Occasional', 'Daily', 'Multiple daily']],
  ['dietary_restriction', 'Dietary restriction', ['None', 'Allergy', 'Religious', 'Medical', 'Ethical']],
  ['neurodivergence', 'Neurodivergence', ['Neurotypical', 'ADHD', 'Autistic', 'Dyslexic', 'Other']],
  ['caregiver_status', 'Caregiver status', ['Not a caregiver', 'Child caregiver', 'Elder caregiver', 'Both']],
  ['health_literacy', 'Health literacy', LEVEL],
  ['insurance_status', 'Insurance status', ['Comprehensive', 'Basic', 'Minimal', 'Uninsured']],
  ['fitness_level', 'Fitness level', ['Athlete', 'Fit', 'Average', 'Sedentary']],
  ['cognitive_load_capacity', 'Cognitive load capacity', LEVEL],
  ['contrast_need', 'High-contrast need', ['No', 'Prefers', 'Requires']],
  ['text_size_need', 'Large-text need', ['No', 'Prefers', 'Requires']],
  ['assistive_tech', 'Assistive technology', ['None', 'Screen reader', 'Switch control', 'Voice control', 'Magnifier']],
  ['motion_sensitivity', 'Motion sensitivity', ['None', 'Mild', 'Strong (reduced motion)']],
  ['attention_condition', 'Attention condition', ['None', 'Mild', 'Diagnosed']],
];

const HOBBIES = ['Knitting', 'Crocheting', 'Pottery', 'Woodworking', 'Metalworking', 'Leatherworking',
  'Candle making', 'Origami', 'Calligraphy', 'Scrapbooking', 'Quilting', 'Embroidery', 'Jewelry making',
  'Model building', 'Coin collecting', 'Stamp collecting', 'Antiquing', 'Vegetable gardening', 'Bonsai',
  'Aquariums', 'Beekeeping', 'Birdwatching', 'Stargazing', 'Geocaching', 'Rock climbing', 'Bouldering',
  'Kayaking', 'Paddleboarding', 'Scuba diving', 'Snorkeling', 'Skydiving', 'Paragliding', 'Horseback riding',
  'Foraging', 'Bread baking', 'Home brewing', 'Winemaking', 'Cheesemaking', 'Karaoke', 'Ballroom dance',
  'Salsa dancing', 'Improv', 'Stand-up comedy', 'Juggling', 'Whittling', 'Letterpress', 'Urban sketching',
  'Genealogy', 'Metal detecting', 'Cosplay'];
const HOBBY = ['Avid', 'Active', 'Occasional', 'Curious', 'Never'];

const ACADEMICS = ['Algebra', 'Geometry', 'Calculus', 'Statistics', 'Physics', 'Chemistry', 'Biology',
  'Earth science', 'Computer science', 'Economics', 'Psychology', 'Sociology', 'World history', 'Geography',
  'Civics', 'Literature', 'Creative writing', 'Foreign languages', 'Philosophy', 'Visual art', 'Music',
  'Drama', 'Physical education', 'Health science', 'Business studies', 'Environmental science', 'Logic',
  'Astronomy', 'Anthropology', 'Political theory'];

const PEEVES = ['Typos', 'Being interrupted', 'Lateness', 'Loud chewing', 'Slow walkers', 'Spam',
  'Clickbait', 'Unexplained jargon', 'Condescension', 'Micromanagement', 'Forced small talk', 'Cold calls',
  'Pop-up ads', 'Auto-play video', 'Paywalls'];
const PEEVE = ['Major peeve', 'Annoys', 'Neutral', 'Fine'];

/* ---- character strengths (VIA-style) — rated by how present the trait is ---- */
const STRENGTHS = ['Curiosity', 'Creativity', 'Love of learning', 'Open-mindedness', 'Perspective',
  'Bravery', 'Perseverance', 'Honesty', 'Zest', 'Capacity for love', 'Kindness', 'Social intelligence',
  'Teamwork', 'Fairness', 'Leadership', 'Forgiveness', 'Humility', 'Prudence', 'Self-regulation',
  'Appreciation of beauty', 'Gratitude', 'Hope / optimism', 'Playfulness', 'Spirituality', 'Ambition',
  'Empathy', 'Resilience', 'Discipline', 'Generosity', 'Loyalty', 'Competitiveness', 'Adaptability'];

/* ---- core values — rated by how much the persona prioritizes each ---- */
const VALUES = ['Family', 'Career success', 'Wealth', 'Health', 'Personal freedom', 'Security & stability',
  'Adventure', 'Tradition', 'Power & influence', 'Achievement', 'Creativity & self-expression', 'Community',
  'Spirituality / faith', 'Knowledge & truth', 'Social status', 'Independence', 'Justice & fairness',
  'Loyalty', 'Sustainability', 'Recognition', 'Helping others', 'Personal growth', 'Fun & enjoyment',
  'Integrity & honesty', 'Beauty & aesthetics', 'Order & structure', 'Patriotism', 'Equality', 'Privacy'];

/* ---- recurring habits — rated by how often the persona does them ---- */
const HABITS = ['Journaling', 'Meditation', 'To-do lists', 'Goal setting', 'Daily reflection', 'Budget tracking',
  'Meal prepping', 'Stretching / mobility', 'Morning walk', 'Phone-free downtime', 'Gratitude practice',
  'Reading before bed', 'Naps', 'Power-snoozing alarm', 'Skipping breakfast', 'Late-night snacking',
  'Nail-biting / fidgeting', 'Doomscrolling', 'Multitab browsing', 'Inbox-zero discipline', 'Saving receipts',
  'Pre-trip overpacking', 'Talking to oneself', 'Humming / whistling', 'Cold showers', 'Step counting',
  'Hydration tracking', 'Backing up files', 'Re-reading texts before sending', 'Procrasti-cleaning'];

/* ---- preference spectrums (id, label, 5-point scale) ---- */
const PREFERENCES = [
  ['work_location', 'Office vs remote', ['Strongly office', 'Office-leaning', 'Hybrid', 'Remote-leaning', 'Strongly remote']],
  ['team_vs_solo', 'Team vs solo work', ['Strongly team', 'Team-leaning', 'Mixed', 'Solo-leaning', 'Strongly solo']],
  ['plan_vs_spontaneous', 'Planned vs spontaneous', ['Highly planned', 'Planned', 'Balanced', 'Spontaneous', 'Highly spontaneous']],
  ['city_vs_nature', 'City vs nature', ['City lover', 'Prefers city', 'Either', 'Prefers nature', 'Nature lover']],
  ['routine_vs_variety', 'Routine vs variety', ['Craves routine', 'Routine-leaning', 'Balanced', 'Variety-leaning', 'Craves variety']],
  ['speed_vs_accuracy', 'Speed vs accuracy', ['Speed first', 'Speed-leaning', 'Balanced', 'Accuracy-leaning', 'Accuracy first']],
  ['quality_vs_quantity', 'Quality vs quantity', ['Quality first', 'Quality-leaning', 'Balanced', 'Quantity-leaning', 'Quantity first']],
  ['logic_vs_intuition', 'Logic vs intuition', ['Pure logic', 'Logic-leaning', 'Balanced', 'Intuition-leaning', 'Pure intuition']],
  ['save_vs_spend', 'Save vs spend', ['Hard saver', 'Saver-leaning', 'Balanced', 'Spender-leaning', 'Free spender']],
  ['lead_vs_follow', 'Lead vs follow', ['Always leads', 'Leans lead', 'Situational', 'Leans support', 'Prefers to follow']],
  ['indoor_vs_outdoor', 'Indoor vs outdoor', ['Strongly indoor', 'Indoor-leaning', 'Either', 'Outdoor-leaning', 'Strongly outdoor']],
  ['early_vs_late', 'Early vs late adopter', ['Bleeding edge', 'Early adopter', 'Mainstream', 'Late adopter', 'Laggard']],
  ['text_vs_call', 'Texting vs calling', ['Text only', 'Prefers text', 'Either', 'Prefers calls', 'Calls only']],
  ['big_group_vs_one_on_one', 'Big group vs one-on-one', ['Loves big groups', 'Group-leaning', 'Either', '1-on-1 leaning', 'One-on-one only']],
  ['novelty_vs_familiarity', 'Novelty vs familiarity', ['Always novel', 'Novelty-leaning', 'Balanced', 'Comfort-leaning', 'Always familiar']],
  ['detail_brief_vs_full', 'Brief vs full detail', ['Just the gist', 'Brief-leaning', 'Balanced', 'Detail-leaning', 'Every detail']],
  ['competition_vs_collab', 'Competition vs collaboration', ['Highly competitive', 'Competitive', 'Balanced', 'Collaborative', 'Highly collaborative']],
  ['stability_vs_change', 'Stability vs change', ['Craves stability', 'Stability-leaning', 'Balanced', 'Change-leaning', 'Craves change']],
];

/* ---- additional demographic facts (id, label, values) ---- */
const DEMOGRAPHICS = [
  ['marital_status', 'Marital status', ['Single', 'In a relationship', 'Married', 'Domestic partnership', 'Separated', 'Divorced', 'Widowed']],
  ['children_count', 'Children', ['None', 'Expecting', '1 child', '2 children', '3+ children', 'Adult children']],
  ['household_income', 'Household income band', ['<$25k', '$25k–50k', '$50k–100k', '$100k–200k', '$200k+']],
  ['employment_status', 'Employment status', ['Full-time', 'Part-time', 'Self-employed', 'Gig / freelance', 'Student', 'Unemployed', 'Retired', 'Homemaker']],
  ['housing_status', 'Housing status', ['Own outright', 'Mortgage', 'Renting', 'Living with family', 'Shared housing', 'Temporary / transitional']],
  ['generation', 'Generational cohort', ['Gen Alpha', 'Gen Z', 'Millennial', 'Gen X', 'Boomer', 'Silent']],
  ['religion_affiliation', 'Religious affiliation', ['Christian', 'Muslim', 'Hindu', 'Buddhist', 'Jewish', 'Sikh', 'Folk / traditional', 'Spiritual but unaffiliated', 'Atheist / agnostic', 'None']],
  ['sexual_orientation', 'Sexual orientation', ['Heterosexual', 'Gay / lesbian', 'Bisexual', 'Pansexual', 'Asexual', 'Queer', 'Prefer not to say']],
  ['citizenship_status', 'Citizenship status', ['Citizen by birth', 'Naturalized citizen', 'Permanent resident', 'Visa holder', 'Dual national', 'Undocumented']],
  ['ethnicity_broad', 'Ethnic background', ['White / European', 'Black / African', 'Hispanic / Latino', 'East Asian', 'South Asian', 'Southeast Asian', 'Middle Eastern', 'Indigenous', 'Pacific Islander', 'Multiracial']],
  ['disability_status', 'Disability status', ['No disability', 'Physical', 'Sensory', 'Cognitive', 'Chronic illness', 'Multiple', 'Prefers not to say']],
  ['veteran_status', 'Veteran status', ['Civilian', 'Active duty', 'Reserve / guard', 'Veteran', 'Military family']],
  ['birth_order', 'Birth order', ['Only child', 'Eldest', 'Middle', 'Youngest', 'Twin / multiple']],
  ['home_language', 'Language at home', ['Same as primary', 'Bilingual home', 'Heritage language', 'Mixed languages']],
  ['political_engagement', 'Political engagement', ['Activist', 'Engaged voter', 'Occasional voter', 'Disengaged', 'Non-voter']],
  ['parental_status', 'Parenthood', ['Not a parent', 'New parent', 'Parent of minors', 'Parent of adults', 'Grandparent', 'Step / foster parent']],
  ['relationship_length', 'Relationship length', ['Not in one', 'Under 1 year', '1–5 years', '5–15 years', '15+ years']],
  ['driver_status', 'Driving status', ['Daily driver', 'Occasional driver', 'Licensed, rarely drives', 'Non-driver', 'Cannot drive']],
];

/* ---- life-experience / biography axes (id, label, values) ---- */
const LIFE_EXPERIENCE = [
  ['childhood_environment', 'Childhood environment', ['Stable & secure', 'Modest but steady', 'Turbulent', 'Privileged', 'Hardship', 'Frequently uprooted']],
  ['geographic_mobility', 'Geographic mobility', ['Never left hometown', 'Moved within region', 'Moved nationally', 'Moved internationally', 'Serial relocator']],
  ['travel_breadth', 'Travel breadth', ['Never left country', 'A few countries', 'Well-traveled', 'Lived abroad', 'Global nomad']],
  ['career_path_shape', 'Career path shape', ['Linear climb', 'Pivoted once', 'Multiple pivots', 'Entrepreneurial', 'Portfolio / patchwork', 'Just starting']],
  ['education_journey', 'Education journey', ['Traditional track', 'Returned as adult', 'Largely self-taught', 'Dropped out', 'Advanced degrees', 'Vocational / trade']],
  ['financial_trajectory', 'Financial trajectory', ['Steady upward', 'Stable', 'Volatile', 'Downward', 'Rebuilt after setback', 'Inherited wealth']],
  ['adversity_level', 'Adversity faced', ['Sheltered', 'Minor setbacks', 'Significant struggles', 'Overcame major hardship', 'Ongoing hardship']],
  ['immigration_generation', 'Immigration generation', ['First-generation immigrant', 'Second-generation', 'Third+ generation', 'Native multi-generational', 'Returnee / repatriate']],
  ['military_history', 'Military history', ['Never served', 'Served briefly', 'Career veteran', 'Combat veteran', 'Military family']],
  ['entrepreneurship_history', 'Entrepreneurship history', ['Never considered', 'Considered it', 'Side hustle', 'Founded once', 'Serial founder', 'Exited a company']],
  ['relationship_history', 'Relationship history', ['Limited', 'A few relationships', 'Long-term partnership', 'Married once', 'Remarried', 'Widowed']],
  ['parenting_journey', 'Parenting journey', ['No children', 'Young children', 'Teenagers', 'Grown children', 'Empty nester', 'Raising grandchildren']],
  ['health_journey', 'Health journey', ['No major events', 'Recovered from illness', 'Manages chronic condition', 'Major surgery / injury', 'Mental health journey', 'Caregiving for others']],
  ['loss_experience', 'Experience of loss', ['No major loss', 'Lost a grandparent', 'Lost a parent', 'Lost a partner / child', 'Multiple bereavements']],
  ['faith_journey', 'Faith journey', ['Lifelong faith', 'Converted', 'Lapsed / left faith', 'Always secular', 'Still searching', 'Returned to faith']],
  ['cultural_exposure', 'Cross-cultural exposure', ['Monocultural', 'Some exposure', 'Multicultural upbringing', 'Lived across cultures', 'Third-culture kid']],
  ['formative_decade', 'Formative decade', ['1960s–70s', '1980s', '1990s', '2000s', '2010s', '2020s']],
  ['public_recognition', 'Public recognition', ['Private life', 'Locally known', 'Industry-recognized', 'Publicly notable', 'Famous']],
  ['service_history', 'Community / service history', ['None', 'Occasional volunteer', 'Long-term volunteer', 'Activist / organizer', 'Public office']],
  ['turning_point', 'Defining turning point', ['Career break', 'Near-miss / accident', 'Spiritual awakening', 'Reinvention', 'Mentor encounter', 'No single one']],
  ['languages_lifetime', 'Languages learned over life', ['One', 'Two', 'Three', 'Four+', 'Polyglot']],
  ['hometown_tie', 'Tie to hometown', ['Still there', 'Visits often', 'Occasional return', 'Rarely returns', 'No connection']],
];

/* ---- assemble families ---- */
DOMAINS.forEach(d => push('fam_' + slug(d), 'Familiarity: ' + d, 'Expertise', `How well the persona knows ${d}.`, FAM));
SKILLS.forEach(s => push('skill_' + slug(s), 'Skill: ' + s, 'Skills', `Proficiency in ${s.toLowerCase()}.`, SKILL));
TOOLS.forEach(t => push('tool_' + slug(t), 'Tool: ' + t, 'Tools', `Experience with ${t}.`, TOOL));
TOPICS.forEach(t => push('topic_' + slug(t), 'Interest: ' + t, 'Interests', `Level of interest in ${t.toLowerCase()}.`, INT));
LANGUAGES.forEach(l => push('lang_' + slug(l), 'Language: ' + l, 'Languages', `Spoken proficiency in ${l}.`, LANG));
ATTITUDES.forEach(a => push('att_' + slug(a), 'Attitude: ' + a, 'Attitudes', `Stance toward ${a.toLowerCase()}.`, ATT));
INDUSTRIES.forEach(i => push('ind_' + slug(i), 'Industry: ' + i, 'Industry', `Work experience in ${i.toLowerCase()}.`, IND));
CULTURES.forEach(c => push('cult_' + slug(c), 'Culture: ' + c, 'Cultural', `Familiarity with ${c} culture.`, CULT));
MUSIC.forEach(m => push('musg_' + slug(m), 'Music: ' + m, 'Music', `Taste for ${m} music.`, GENRE));
FILM.forEach(f => push('filmg_' + slug(f), 'Film: ' + f, 'Film', `Taste for ${f.toLowerCase()} films.`, GENRE));
BOOKS.forEach(b => push('bookg_' + slug(b), 'Books: ' + b, 'Books', `Taste for ${b.toLowerCase()}.`, GENRE));
CUISINES.forEach(c => push('cuis_' + slug(c), 'Cuisine: ' + c, 'Food', `Taste for ${c} cuisine.`, CUIS));
SPORTS.forEach(s => push('sport_' + slug(s), 'Sport: ' + s, 'Sports', `Relationship to ${s.toLowerCase()}.`, SPORT));
PROGRAMMING.forEach(p => push('prog_' + slug(p), 'Programming: ' + p, 'Programming', `Proficiency in ${p}.`, PROG));
BIGFIVE.forEach(([facet, group]) => push('big5_' + slug(facet), facet, 'Personality', `${group} facet — ${facet.toLowerCase()}.`, BIG5));
LIFESTYLE.forEach(([id, label, vals]) => push('lstyle_' + id, label, 'Lifestyle', label + '.', vals));
COGNITION.forEach(([id, label, vals]) => push('cog_' + id, label, 'Cognition', label + '.', vals));
HEALTH.forEach(([id, label, vals]) => push('health_' + id, label, 'Health', label + '.', vals));
HOBBIES.forEach(h => push('hob_' + slug(h), 'Hobby: ' + h, 'Hobbies', `Engagement with ${h.toLowerCase()}.`, HOBBY));
ACADEMICS.forEach(a => push('acad_' + slug(a), 'Subject: ' + a, 'Academics', `Interest in ${a.toLowerCase()}.`, INT));
PEEVES.forEach(p => push('peeve_' + slug(p), 'Pet peeve: ' + p, 'Triggers', `Reaction to ${p.toLowerCase()}.`, PEEVE));
STRENGTHS.forEach(s => push('trait_' + slug(s), 'Character: ' + s, 'Character', `How present ${s.toLowerCase()} is in the persona.`, STR));
VALUES.forEach(v => push('val_' + slug(v), 'Value: ' + v, 'Values', `How strongly the persona prioritizes ${v.toLowerCase()}.`, IMP));
HABITS.forEach(h => push('habit_' + slug(h), 'Habit: ' + h, 'Habits', `How often the persona engages in ${h.toLowerCase()}.`, FREQ));
PREFERENCES.forEach(([id, label, vals]) => push('pref_' + id, label, 'Preferences', label + '.', vals));
DEMOGRAPHICS.forEach(([id, label, vals]) => push('demo_' + id, label, 'Demographic', label + '.', vals));
LIFE_EXPERIENCE.forEach(([id, label, vals]) => push('lifex_' + id, label, 'Life Experience', label + '.', vals));

/* ---- write ---- */
const result = {
  schemaVersion: '2.0',
  name: existing.name,
  headlineBehaviors: existing.headlineBehaviors,
  targetDimensions: 1000,
  note: existing.note,
  dimensions: out,
};
fs.writeFileSync(FILE, JSON.stringify(result, null, 2) + '\n');

const totalValues = out.reduce((s, d) => s + d.values.length, 0);
const cats = [...new Set(out.map(d => d.category))];
console.log(`dimensions: ${out.length}  (core ${core.length} + generated ${out.length - core.length})`);
console.log(`total values: ${totalValues}`);
console.log(`categories: ${cats.length} — ${cats.join(', ')}`);
