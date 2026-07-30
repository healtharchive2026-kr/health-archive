(() => {
  const chapterDefinitions = [
    {
      ids: ['precheck', 'devmap', 'material-dev', 'whitespace'],
      theme: 'development',
      number: '01',
      eyebrow: 'Discovery & Development',
      title: '개발검토',
      description: '자연 유래 원료의 출발점과 개발 가능성을 먼저 검토합니다.',
      image: 'assets/chapter-development.webp'
    },
    {
      ids: ['ingredients', 'foodraw', 'temp-approval', 'safety-db', 'blocked', 'gmo-ingredients', 'products'],
      theme: 'database',
      number: '02',
      eyebrow: 'Ingredient Archive',
      title: '원료·제품 DB',
      description: '원료의 정체성, 인정 이력, 안전성과 제품 적용 현황을 연결합니다.',
      image: 'assets/chapter-database.webp'
    },
    {
      ids: ['laws', 'nifds', 'minutes', 'gmo-minutes', 'overseas-approval'],
      theme: 'regulatory',
      number: '03',
      eyebrow: 'Regulatory Affairs',
      title: '규제·인허가',
      description: '국내외 규제 기준과 심의 기록을 제출 가능한 근거로 정리합니다.',
      image: 'assets/chapter-regulatory.webp'
    },
    {
      ids: ['compare', 'biomarkers', 'trials', 'daily-reports'],
      theme: 'research',
      number: '04',
      eyebrow: 'Evidence Design',
      title: '연구설계',
      description: '작용기전부터 평가변수와 임상 프로토콜까지 근거의 구조를 설계합니다.',
      image: 'assets/chapter-research.webp'
    },
    {
      ids: ['market', 'stats', 'funding', 'news', 'events'],
      theme: 'market',
      number: '05',
      eyebrow: 'Market Intelligence',
      title: '시장·동향',
      description: '생산실적, 제품, 연구과제와 산업 신호를 개발 의사결정에 연결합니다.',
      image: 'assets/chapter-market.webp'
    }
  ];

  const createChapterCover = definition => {
    const cover = document.createElement('header');
    cover.className = `section-chapter section-chapter-${definition.theme}`;
    cover.setAttribute('aria-label', `${definition.title} 섹션`);

    const image = document.createElement('img');
    image.className = 'section-chapter-image';
    image.src = definition.image;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.width = 1600;
    image.height = 747;

    const shade = document.createElement('span');
    shade.className = 'section-chapter-shade';
    shade.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('div');
    copy.className = 'section-chapter-copy';

    const eyebrow = document.createElement('span');
    eyebrow.className = 'section-chapter-eyebrow';
    eyebrow.textContent = `${definition.number} / ${definition.eyebrow}`;

    const title = document.createElement('h2');
    title.textContent = definition.title;

    const description = document.createElement('p');
    description.textContent = definition.description;

    const index = document.createElement('div');
    index.className = 'section-chapter-index';
    index.setAttribute('aria-hidden', 'true');
    index.innerHTML = `<span>Chapter</span><strong>${definition.number}</strong>`;

    copy.append(eyebrow, title, description);
    cover.append(image, shade, copy, index);
    return cover;
  };

  const workspace = document.getElementById('workspace-start');
  const workspaceCommand = workspace?.querySelector('.home-command');
  if (workspace && workspaceCommand && !workspace.querySelector('.home-chapter-rail')) {
    const rail = document.createElement('nav');
    rail.className = 'home-chapter-rail';
    rail.setAttribute('aria-label', '대분류 바로가기');

    const destinations = ['precheck', 'ingredients', 'laws', 'biomarkers', 'market'];
    chapterDefinitions.forEach((definition, index) => {
      const link = document.createElement('a');
      link.className = `home-chapter-link home-chapter-link-${definition.theme}`;
      link.href = `#${destinations[index]}`;
      link.dataset.goto = destinations[index];

      const image = document.createElement('img');
      image.src = definition.image;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.width = 1600;
      image.height = 747;

      const number = document.createElement('span');
      number.textContent = definition.number;

      const label = document.createElement('strong');
      label.textContent = definition.title;

      link.append(image, number, label);
      rail.append(link);
    });

    workspace.insertBefore(rail, workspaceCommand);
  }

  chapterDefinitions.forEach(definition => {
    definition.ids.forEach(id => {
      const section = document.getElementById(id);
      if (!section || section.querySelector(':scope > .section-chapter')) return;

      section.dataset.chapterTheme = definition.theme;
      section.insertBefore(createChapterCover(definition), section.firstChild);
    });
  });
})();
