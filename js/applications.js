const taskDetails = {
  "Candy Land Price Sensitivity": {
    summary: "Hasbro is considering a price change for Candy Land and wants to understand the likely market response before rollout. This survey measures purchase intent at different price points and identifies which customer segments are most price-sensitive.",
    audience: "Adults in the United States who purchase board games for children, families, classrooms, or gifts. The population varies by age, household income, parental status, shopping habits, and familiarity with Candy Land.",
    metric: ">55% acceptance",
    metricNote: "At least 55% of likely buyers retain purchase intent at the proposed new price."
  },
  "Annual Checkup Habits": {
    summary: "A healthcare organization wants to understand why some adults schedule annual checkups while others delay or avoid them. The survey examines access, cost, trust, convenience, health beliefs, and prior care experiences.",
    audience: "Adults with varied health status, insurance coverage, income, geography, healthcare access, and relationships with primary-care providers. The sample includes regular patients and people who rarely seek preventive care.",
    metric: ">60% intent",
    metricNote: "More than 60% report an intention to schedule a checkup after the proposed intervention."
  },
  "Meal Planning Nutrition Assistant": {
    summary: "A digital-health team wants to evaluate a conversational nutrition assistant that creates practical meal plans. Users provide dietary goals, allergies, budgets, time constraints, and food preferences through multi-turn conversations.",
    audience: "Adults who plan meals for themselves or their households, including users with allergies, dietary restrictions, fitness goals, chronic-health considerations, and limited cooking time or budgets.",
    metric: ">85% useful plans",
    metricNote: "At least 85% receive a feasible plan that respects every stated dietary and safety constraint."
  },
  "OpenBB Delisted-Quote Research": {
    summary: "A finance research team wants to test whether an OpenBB assistant can investigate a missing or delisted stock quote. The assistant must clarify the ticker, locate credible evidence, explain the listing status, and distinguish facts from uncertainty.",
    audience: "Retail investors, financial analysts, students, and researchers using market-data tools. Personas vary in financial expertise, research goals, risk tolerance, and familiarity with delistings and corporate actions.",
    metric: ">90% accurate",
    metricNote: "At least 90% of responses identify the correct status and cite adequate supporting evidence without fabrication."
  },
  "Notion Plan Comparison": {
    summary: "Notion wants to evaluate whether prospective customers can understand and compare its available plans. Users review features, limits, collaboration needs, and pricing before selecting the best plan for a realistic scenario.",
    audience: "Individuals, students, small teams, startups, and business administrators considering Notion. The audience varies by team size, budget, collaboration requirements, security needs, and prior workspace-tool experience.",
    metric: ">85% correct choice",
    metricNote: "More than 85% select the plan that best matches their stated needs and accurately explain the key tradeoffs."
  },
  "MIT OpenCourseWare Course Choice": {
    summary: "MIT OpenCourseWare wants to understand whether learners can find a suitable course among many options. Users search, compare prerequisites and materials, and select a course aligned with their goals and current knowledge.",
    audience: "Independent learners, high-school and university students, educators, and working professionals. Personas vary by subject interest, educational background, language proficiency, available study time, and learning goals.",
    metric: ">80% suitable choice",
    metricNote: "At least 80% choose a course appropriate to their goals and prerequisite knowledge without assistance."
  },
  "News+ Subscription Decision": {
    summary: "A news app wants to evaluate how users decide whether to subscribe to News+. Users explore the offer, assess content value, interpret trial and renewal terms, and make a subscription decision.",
    audience: "Mobile news readers with different reading frequency, topic interests, household arrangements, subscription histories, price sensitivity, and trust in news brands.",
    metric: ">65% informed decisions",
    metricNote: "More than 65% can accurately explain the price, renewal terms, and included value before deciding."
  },
  "Stocks Sentiment": {
    summary: "A finance app wants to test how investors interpret a stock-sentiment feature. Users review sentiment signals alongside market context and decide whether the information changes their confidence or intended action.",
    audience: "Retail investors ranging from beginners to active traders, with varied portfolios, financial literacy, risk tolerance, investment horizons, and familiarity with sentiment indicators.",
    metric: ">80% comprehension",
    metricNote: "At least 80% interpret the sentiment signal correctly without treating it as guaranteed investment advice.",
    supportingImage1: "Assets/media/application_demo/type_4_app/MU Stock/MU Stock Report.png",
    supportingImage2: "Assets/media/application_demo/type_4_app/MU Stock/MU Report Demo.gif"
  }
};

const nav = document.querySelector('.mx-nav');
const menu = document.querySelector('.mx-menu');
const dialog = document.querySelector('#taskDialog');
const closeButton = dialog.querySelector('.task-dialog-close');
const supportingImageContainers = [...dialog.querySelectorAll('.task-image-placeholder')].slice(1);
const supportingImages = supportingImageContainers.map(container => {
  const image = document.createElement('img');
  image.className = 'task-supporting-image';
  image.hidden = true;
  container.prepend(image);
  return image;
});
let triggerCard = null;

menu.addEventListener('click', () => nav.classList.toggle('open'));

document.querySelectorAll('.task-filter').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.task-filter').forEach(item => item.classList.toggle('active', item === button));
    document.querySelectorAll('.task-card').forEach(card => {
      card.hidden = button.dataset.filter !== 'all' && card.dataset.type !== button.dataset.filter;
    });
  });
});

function openTask(card) {
  const title = card.querySelector('h3').textContent;
  const detail = taskDetails[title];
  if (!detail) return;
  triggerCard = card;
  document.querySelector('#taskDialogType').textContent = card.querySelector('.task-meta span').textContent;
  document.querySelector('#taskDialogCover').dataset.type = card.dataset.type;
  const cardCover = card.querySelector('.task-cover-image');
  const dialogCover = document.querySelector('#taskDialogCoverImage');
  if (cardCover) {
    dialogCover.src = cardCover.src;
    dialogCover.alt = cardCover.alt;
    dialogCover.className = cardCover.classList.contains('contain') ? 'contain' : '';
    dialogCover.hidden = false;
  } else {
    dialogCover.removeAttribute('src');
    dialogCover.alt = '';
    dialogCover.className = '';
    dialogCover.hidden = true;
  }
  document.querySelector('#taskDialogTitle').textContent = title;
  document.querySelector('#taskDialogSummary').textContent = detail.summary;
  document.querySelector('#taskDialogAudience').textContent = detail.audience;
  document.querySelector('#taskDialogPopulation').textContent = '100,000 personas';
  document.querySelector('#taskDialogMetric').textContent = detail.metric;
  document.querySelector('#taskDialogMetricNote').textContent = detail.metricNote;
  supportingImages.forEach((image, index) => {
    const source = detail[`supportingImage${index + 1}`];
    const container = supportingImageContainers[index];
    if (source) {
      image.src = source;
      image.alt = `${title} ${index === 0 ? 'evaluation report' : 'report demo'}`;
      image.hidden = false;
      container.classList.add('has-image');
    } else {
      image.removeAttribute('src');
      image.alt = '';
      image.hidden = true;
      container.classList.remove('has-image');
    }
  });
  dialog.showModal();
}

document.querySelectorAll('.task-card').forEach(card => {
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-haspopup', 'dialog');
  card.addEventListener('click', () => openTask(card));
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openTask(card);
    }
  });
});

closeButton.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener('close', () => triggerCard?.focus());
dialog.querySelectorAll('a[aria-disabled="true"]').forEach(link => {
  link.addEventListener('click', event => event.preventDefault());
});
