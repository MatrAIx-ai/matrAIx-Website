(function () {
  const article = document.querySelector('.article');
  const toc = document.querySelector('.article-toc');
  const list = toc && toc.querySelector('ol');
  if (!article || !toc || !list) return;

  const headings = Array.from(article.querySelectorAll('h2'));
  headings.forEach((heading, index) => {
    if (!heading.id) heading.id = `section-${index + 1}`;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    item.appendChild(link);
    list.appendChild(item);
  });

  if (!headings.length) {
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
    let current = headings[0];
    headings.forEach(heading => {
      if (heading.getBoundingClientRect().top <= 190) current = heading;
    });
    activate(current.id);
  };

  links.forEach((link, index) => {
    link.addEventListener('click', () => activate(headings[index].id));
  });
  window.addEventListener('scroll', () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(updateActive);
  }, { passive: true });
  updateActive();
})();
