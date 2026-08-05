(() => {
  const DEFAULT_WINDOW = '24h';
  const COLLAPSE_DELAY_MS = 7000;
  const options = [
    ['6h', 'Last 6 hours'],
    ['12h', 'Last 12 hours'],
    ['24h', 'Last 24 hours'],
    ['48h', 'Last 48 hours'],
    ['7d', 'Last 7 days'],
    ['all', 'All alerts']
  ];

  let collapseTimer = 0;
  let applying = false;

  const parseWindowMs = value => {
    if (value === 'all') return Number.POSITIVE_INFINITY;
    const match = /^(\d+)(h|d)$/.exec(value || '');
    if (!match) return 24 * 60 * 60 * 1000;
    const amount = Number(match[1]);
    return amount * (match[2] === 'd' ? 24 : 1) * 60 * 60 * 1000;
  };

  const parseRelativeAgeMs = text => {
    const value = String(text || '').trim().toLowerCase();
    if (!value || value.includes('just now')) return 0;
    const match = /(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)/.exec(value);
    if (!match) return Number.POSITIVE_INFINITY;
    const amount = Number(match[1]);
    const unit = match[2];
    if (unit.startsWith('s')) return amount * 1000;
    if (unit.startsWith('m')) return amount * 60 * 1000;
    if (unit.startsWith('h')) return amount * 60 * 60 * 1000;
    if (unit.startsWith('d')) return amount * 24 * 60 * 60 * 1000;
    return amount * 7 * 24 * 60 * 60 * 1000;
  };

  const selectedWindow = () => {
    const value = new URLSearchParams(location.search).get('alerts') || DEFAULT_WINDOW;
    return options.some(([key]) => key === value) ? value : DEFAULT_WINDOW;
  };

  const updateUrl = value => {
    const params = new URLSearchParams(location.search);
    if (value === DEFAULT_WINDOW) params.delete('alerts');
    else params.set('alerts', value);
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
  };

  const ensureStyles = () => {
    if (document.getElementById('wallboard-runtime-controls-style')) return;
    const style = document.createElement('style');
    style.id = 'wallboard-runtime-controls-style';
    style.textContent = `
      .wallboard-shell > header { transition: max-height .28s ease, opacity .22s ease, padding .28s ease, border-width .28s ease; max-height: 180px; overflow: hidden; }
      .wallboard-shell[data-header-collapsed="true"] > header { max-height: 0; opacity: 0; padding-top: 0 !important; padding-bottom: 0 !important; border-width: 0 !important; pointer-events: none; }
      .wallboard-runtime-filter { display: flex; align-items: center; gap: 8px; }
      .wallboard-runtime-filter label { color: #8f9bad; font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
      .wallboard-runtime-filter select { width: auto; min-width: 138px; height: 34px; }
      .wallboard-show-header { position: fixed; z-index: 200; top: 10px; right: 10px; min-height: 32px; border: 1px solid #334155; border-radius: 6px; padding: 0 10px; color: #d3dae4; background: rgba(21,28,37,.94); cursor: pointer; font-weight: 700; }
      .wallboard-shell:not([data-header-collapsed="true"]) .wallboard-show-header { display: none; }
      .wallboard-filter-summary { border-top: 1px solid #263140; padding: 10px 18px; color: #8f9bad; font-size: .72rem; }
    `;
    document.head.appendChild(style);
  };

  const resetCollapseTimer = shell => {
    window.clearTimeout(collapseTimer);
    shell.dataset.headerCollapsed = 'false';
    collapseTimer = window.setTimeout(() => {
      shell.dataset.headerCollapsed = 'true';
    }, COLLAPSE_DELAY_MS);
  };

  const ensureHeaderControls = shell => {
    const header = shell.querySelector(':scope > header');
    if (!header) return;

    let controls = header.querySelector('.wallboard-runtime-filter');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'wallboard-runtime-filter';
      const label = document.createElement('label');
      label.textContent = 'Alert window';
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'Wallboard alert lookback window');
      for (const [value, text] of options) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        select.appendChild(option);
      }
      select.addEventListener('change', () => {
        updateUrl(select.value);
        apply();
        resetCollapseTimer(shell);
      });
      controls.append(label, select);
      header.insertBefore(controls, header.lastElementChild);
    }
    controls.querySelector('select').value = selectedWindow();

    let showButton = shell.querySelector('.wallboard-show-header');
    if (!showButton) {
      showButton = document.createElement('button');
      showButton.className = 'wallboard-show-header';
      showButton.type = 'button';
      showButton.textContent = 'Show controls';
      showButton.addEventListener('click', () => resetCollapseTimer(shell));
      shell.appendChild(showButton);
    }
  };

  const filterAndSortAlerts = shell => {
    const list = shell.querySelector('.wallboard-priority');
    if (!list) return;
    const limit = parseWindowMs(selectedWindow());
    const alerts = [...list.querySelectorAll(':scope > article')];
    const ranked = alerts.map(article => ({
      article,
      age: parseRelativeAgeMs(article.querySelector('time')?.textContent)
    })).sort((a, b) => a.age - b.age);

    let visible = 0;
    for (const item of ranked) {
      const show = item.age <= limit;
      item.article.hidden = !show;
      if (show) {
        visible += 1;
        list.appendChild(item.article);
        const index = item.article.querySelector(':scope > span');
        if (index) index.textContent = String(visible).padStart(2, '0');
      }
    }

    let summary = list.querySelector('.wallboard-filter-summary');
    if (!summary) {
      summary = document.createElement('div');
      summary.className = 'wallboard-filter-summary';
      list.appendChild(summary);
    }
    const hidden = ranked.length - visible;
    summary.textContent = visible
      ? `${visible} newest signal${visible === 1 ? '' : 's'} shown${hidden ? `, ${hidden} older signal${hidden === 1 ? '' : 's'} hidden` : ''}.`
      : `No signals fall within ${options.find(([value]) => value === selectedWindow())?.[1].toLowerCase() || 'the selected window'}.`;
  };

  const apply = () => {
    if (applying) return;
    const shell = document.querySelector('.wallboard-shell');
    if (!shell) return;
    applying = true;
    try {
      ensureStyles();
      ensureHeaderControls(shell);
      filterAndSortAlerts(shell);
      if (!shell.dataset.wallboardControlsReady) {
        shell.dataset.wallboardControlsReady = 'true';
        resetCollapseTimer(shell);
      }
    } finally {
      applying = false;
    }
  };

  const observer = new MutationObserver(() => window.requestAnimationFrame(apply));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('popstate', apply);
  apply();
})();
