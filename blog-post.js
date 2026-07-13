(function () {
  const article = document.querySelector('.article');
  const toc = document.querySelector('.article-toc');
  const list = toc && toc.querySelector('ol');
  if (!article || !toc || !list) return;

  const headings = Array.from(article.querySelectorAll('h2, h3'));
  let currentH2Item = null;
  let currentSubList = null;

  headings.forEach((heading, index) => {
    if (!heading.id) {
      const slug = heading.textContent
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      heading.id = slug || `section-${index + 1}`;
    }

    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    item.appendChild(link);

    if (heading.tagName === 'H2') {
      list.appendChild(item);
      currentH2Item = item;
      currentSubList = null;
    } else if (heading.tagName === 'H3' && currentH2Item) {
      if (!currentSubList) {
        currentSubList = document.createElement('ol');
        currentH2Item.appendChild(currentSubList);
      }
      currentSubList.appendChild(item);
    } else {
      list.appendChild(item);
    }
  });

  const tocHeadings = Array.from(article.querySelectorAll('h2, h3'));
  if (!tocHeadings.length) {
    toc.hidden = true;
    return;
  }

  const links = Array.from(list.querySelectorAll('a'));
  const activate = id => {
    links.forEach(link => {
      const active = link.hash === `#${id}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };

  let scheduled = false;
  const updateActive = () => {
    scheduled = false;
    let current = tocHeadings[0];
    tocHeadings.forEach(heading => {
      if (heading.getBoundingClientRect().top <= 190) current = heading;
    });
    activate(current.id);
  };

  links.forEach(link => {
    link.addEventListener('click', () => {
      const id = link.hash.slice(1);
      activate(id);
    });
  });
  window.addEventListener('scroll', () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(updateActive);
  }, { passive: true });
  updateActive();
})();