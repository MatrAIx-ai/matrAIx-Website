document.addEventListener('DOMContentLoaded', () => {
  const advisorProfiles = [
    ['Professor / Research Lead · Institution TBD', 'User studies · Evaluation methodology'],
    ['Professor / Research Lead · Institution TBD', 'Population modeling · Behavioral validity'],
    ['Research Scientist / Faculty · Institution TBD', 'Agent architecture · Tool use'],
    ['Policy / Research Lead · Institution TBD', 'Privacy · Representation · Governance'],
    ['Professor / Research Lead · Institution TBD', 'Identity modeling · Persona adherence'],
    ['Professor / Research Lead · Institution TBD', 'Decision science · Human behavior'],
    ['Research Scientist / Faculty · Institution TBD', 'Foundation models · Adaptation'],
    ['Benchmark Lead / Faculty · Institution TBD', 'Metrics · Reproducibility · Validation'],
    ['Data Lead / Faculty · Institution TBD', 'Provenance · Curation · Data quality'],
    ['Professor / Research Lead · Institution TBD', 'HCI · Interactive evaluation'],
    ['Research Scientist / Faculty · Institution TBD', 'Coordination · Emergent behavior'],
    ['Policy / Research Lead · Institution TBD', 'Consent · Safety · Data governance'],
    ['Engineering / Research Lead · Company TBD', 'Developer experience · AI tooling'],
    ['Product / Research Lead · Company TBD', 'Experimentation · Product metrics'],
    ['Clinical / Research Lead · Institution TBD', 'Patient experience · Digital health'],
    ['Industry / Research Lead · Company TBD', 'Trust · Compliance · Financial AI'],
    ['Industry / Research Lead · Company TBD', 'Recommendations · Consumer behavior'],
    ['Open-source Maintainer · Organization TBD', 'Community systems · Reproducibility'],
    ['Infrastructure Lead · Organization TBD', 'Distributed systems · Simulation scale'],
    ['Education / Community Lead · Institution TBD', 'Curriculum · Public engagement']
  ];
  document.querySelectorAll('.advisor-grid .person').forEach((card, index) => {
    const profile = advisorProfiles[index];
    if (!profile) return;
    const details = document.createElement('div');
    details.className = 'advisor-details';
    details.innerHTML = `<p class="advisor-affiliation">${profile[0]}</p><span class="advisor-focus">${profile[1]}</span><p class="advisor-credential">Selected role, project, or credential · TBD</p>`;
    card.appendChild(details);
  });

  const rows = document.querySelectorAll('.affiliation-row');
  const academicCloud = rows[0]?.querySelector('.logo-cloud');
  const cloud = rows[1]?.querySelector('.logo-cloud');
  if (!academicCloud || !cloud) return;

  const addAffiliation = (container, name, domain) => {
    if ([...container.querySelectorAll('.affiliation-chip')].some(chip => chip.textContent.trim() === name)) return;
    const chip = document.createElement('span');
    chip.className = 'affiliation-chip';
    chip.textContent = name;
    const logo = document.createElement('img');
    logo.src = `https://www.google.com/s2/favicons?sz=64&domain_url=https://${domain}`;
    logo.alt = '';
    logo.loading = 'lazy';
    logo.decoding = 'async';
    logo.addEventListener('error', () => logo.remove());
    chip.prepend(logo);
    container.appendChild(chip);
  };

  addAffiliation(academicCloud, 'U of Toronto', 'utoronto.ca');
  addAffiliation(academicCloud, 'OSU', 'osu.edu');
  addAffiliation(academicCloud, 'ASU', 'asu.edu');
  addAffiliation(academicCloud, 'UCSC', 'ucsc.edu');
  addAffiliation(academicCloud, 'UPenn', 'upenn.edu');
  addAffiliation(academicCloud, 'JHU', 'jhu.edu');
  addAffiliation(academicCloud, 'Caltech', 'caltech.edu');

  const cambridge = [...academicCloud.querySelectorAll('.affiliation-chip')]
    .find(chip => chip.textContent.trim() === 'Cambridge');
  if (cambridge) {
    const logo = cambridge.querySelector('img');
    if (logo) {
      logo.loading = 'eager';
      logo.src = 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Coat_of_Arms_of_the_University_of_Cambridge.svg';
    }
    cambridge.classList.add('cambridge-affiliation');

    if (![...academicCloud.querySelectorAll('.affiliation-chip')].some(chip => chip.textContent.trim() === 'USC')) {
      const usc = document.createElement('span');
      usc.className = 'affiliation-chip';
      usc.textContent = 'USC';
      const uscLogo = document.createElement('img');
      uscLogo.src = 'https://www.usc.edu/favicon.ico';
      uscLogo.alt = '';
      uscLogo.loading = 'lazy';
      uscLogo.decoding = 'async';
      uscLogo.addEventListener('error', () => uscLogo.remove());
      usc.prepend(uscLogo);
      cambridge.insertAdjacentElement('afterend', usc);
    }
  }

  const academicChips = Object.fromEntries(
    [...academicCloud.querySelectorAll('.affiliation-chip')].map(chip => [chip.textContent.trim(), chip])
  );
  ['ETH Zürich', 'Tsinghua', 'Peking University'].forEach(name => academicChips[name]?.remove());

  let chips = Object.fromEntries(
    [...cloud.querySelectorAll('.affiliation-chip')].map(chip => [chip.textContent.trim(), chip])
  );

  [
    'Stripe', 'Airbnb', 'Intel', 'Oracle', 'Tencent',
    'IBM', 'Alibaba', 'Salesforce', 'Uber', 'Databricks'
  ].forEach(name => chips[name]?.remove());
  chips = Object.fromEntries(
    [...cloud.querySelectorAll('.affiliation-chip')].map(chip => [chip.textContent.trim(), chip])
  );

  const washington = chips['University of Washington'];
  if (washington) {
    const logo = washington.querySelector('img');
    washington.textContent = 'U of Washington';
    if (logo) washington.prepend(logo);
  }

  let xai = chips.xAI;
  if (!xai) {
    xai = document.createElement('span');
    xai.className = 'affiliation-chip';
    xai.textContent = 'xAI';
    const logo = document.createElement('img');
    logo.src = 'https://www.google.com/s2/favicons?sz=64&domain_url=https://x.ai';
    logo.alt = '';
    logo.loading = 'lazy';
    logo.decoding = 'async';
    logo.addEventListener('error', () => logo.remove());
    xai.prepend(logo);
  }

  let snap = chips.Snap;
  if (!snap) {
    snap = document.createElement('span');
    snap.className = 'affiliation-chip';
    snap.textContent = 'Snap';
    const logo = document.createElement('img');
    logo.src = 'https://www.google.com/s2/favicons?sz=64&domain_url=https://snap.com';
    logo.alt = '';
    logo.loading = 'lazy';
    logo.decoding = 'async';
    logo.addEventListener('error', () => logo.remove());
    snap.prepend(logo);
    cloud.appendChild(snap);
  }

  const orderedFirst = [
    chips.Google,
    chips['Google DeepMind'],
    chips.Microsoft,
    chips.Anthropic,
    chips.OpenAI,
    chips.Meta,
    xai
  ];
  orderedFirst.forEach(chip => chip?.remove());
  const anchor = cloud.firstChild;
  orderedFirst.forEach(chip => {
    if (chip) cloud.insertBefore(chip, anchor);
  });

  const bytedanceLogo = chips.ByteDance?.querySelector('img');
  if (bytedanceLogo) {
    bytedanceLogo.src = 'Assets/logos/logo-bytedance-symbol.svg';
  }

    const cornell = [...academicCloud.querySelectorAll('.affiliation-chip')]
      .find(chip => chip.textContent.trim() === 'Cornell');
    const cornellLogo = cornell?.querySelector('img');
    if (cornellLogo) {
      cornellLogo.src = 'https://www.cornell.edu/favicon.ico';
      cornell.classList.add('cornell-affiliation');
    }

    const nvidiaLogo = chips.NVIDIA?.querySelector('img');
    if (nvidiaLogo) {
      nvidiaLogo.src = 'https://www.nvidia.com/favicon.ico';
      chips.NVIDIA.classList.add('nvidia-affiliation');
    }
});
