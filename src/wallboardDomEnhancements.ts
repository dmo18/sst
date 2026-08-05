const WALLBOARD_IDLE_MS = 2200;
const SIGNAL_PAGE_MS = 7000;
const SIGNAL_FADE_MS = 220;

let idleTimer = 0;
let enhancementTimer = 0;
let signalTimer = 0;
let signalPage = 0;
let lastBrowserCheckAt = 0;
let generatedAt = 0;

function normalize(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function removeLegacyControlButtons(shell: HTMLElement): void {
  for (const button of shell.querySelectorAll<HTMLButtonElement>('button')) {
    if (/show controls/i.test(button.textContent || '')) button.remove();
  }
}

function relativeAgeMilliseconds(value: string | null | undefined): number {
  const text = normalize(value);
  if (!text || text === 'now' || text.includes('just now')) return 0;
  const match = text.match(/([\d.]+)\s*(second|minute|hour|day|week|month|year|s|m|h|d|w)/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit.startsWith('second') || unit === 's' ? 1000
    : unit.startsWith('minute') || unit === 'm' ? 60_000
      : unit.startsWith('hour') || unit === 'h' ? 3_600_000
        : unit.startsWith('day') || unit === 'd' ? 86_400_000
          : unit.startsWith('week') || unit === 'w' ? 604_800_000
            : unit.startsWith('month') ? 2_629_800_000
              : 31_557_600_000;
  return amount * multiplier;
}

function priorityRows(section: HTMLElement): HTMLElement[] {
  return [...section.querySelectorAll<HTMLElement>(':scope > article')];
}

function sortPriorityRows(section: HTMLElement): HTMLElement[] {
  const rows = priorityRows(section).sort((a, b) => {
    const ageDelta = relativeAgeMilliseconds(a.querySelector('time')?.textContent) - relativeAgeMilliseconds(b.querySelector('time')?.textContent);
    if (ageDelta) return ageDelta;
    return normalize(a.querySelector('h3')?.textContent).localeCompare(normalize(b.querySelector('h3')?.textContent));
  });
  for (const row of rows) section.appendChild(row);
  return rows;
}

function replacePriorityNumbers(shell: HTMLElement): void {
  const icons = new Map<string, HTMLImageElement>();
  for (const row of shell.querySelectorAll<HTMLElement>('.wallboard-providers article')) {
    const name = normalize(row.querySelector('b')?.textContent);
    const icon = row.querySelector<HTMLImageElement>('img.provider-logo, img');
    if (name && icon) icons.set(name, icon);
  }

  for (const row of shell.querySelectorAll<HTMLElement>('.wallboard-priority > article')) {
    const providerName = row.querySelector('div > b')?.textContent || 'Provider';
    const first = row.firstElementChild;
    const source = icons.get(normalize(providerName));
    if (!first || !source || first.classList.contains('priority-provider-icon')) continue;
    const icon = source.cloneNode(true) as HTMLImageElement;
    icon.classList.add('priority-provider-icon');
    icon.alt = `${providerName} icon`;
    first.replaceWith(icon);
  }
}

function rowsPerPage(section: HTMLElement, rows: HTMLElement[]): number {
  const heading = section.querySelector<HTMLElement>('h2');
  const available = Math.max(1, section.clientHeight - (heading?.offsetHeight || 0));
  let used = 0;
  let count = 0;
  for (const row of rows) {
    const height = Math.max(1, row.getBoundingClientRect().height);
    if (count && used + height > available) break;
    used += height;
    count += 1;
  }
  return Math.max(1, count);
}

function showSignalPage(section: HTMLElement, rows: HTMLElement[], page: number, perPage: number): void {
  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  const normalizedPage = page % pageCount;
  const start = normalizedPage * perPage;
  const end = start + perPage;
  rows.forEach((row, index) => row.classList.toggle('wallboard-signal-hidden', index < start || index >= end));
  signalPage = normalizedPage;
}

function setupSignalPagination(section: HTMLElement): void {
  window.clearInterval(signalTimer);
  signalTimer = 0;
  section.classList.remove('wallboard-signals-fading');
  const rows = priorityRows(section);
  rows.forEach(row => row.classList.remove('wallboard-signal-hidden'));
  if (rows.length < 2) return;

  const perPage = rowsPerPage(section, rows);
  const pageCount = Math.ceil(rows.length / perPage);
  if (pageCount <= 1) return;
  signalPage = 0;
  showSignalPage(section, rows, signalPage, perPage);

  signalTimer = window.setInterval(() => {
    section.classList.add('wallboard-signals-fading');
    window.setTimeout(() => {
      showSignalPage(section, rows, signalPage + 1, perPage);
      section.classList.remove('wallboard-signals-fading');
    }, SIGNAL_FADE_MS);
  }, SIGNAL_PAGE_MS);
}

function ageLabel(timestamp: number): string {
  if (!timestamp) return 'unknown';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function ensureTelemetry(shell: HTMLElement): void {
  let telemetry = shell.querySelector<HTMLElement>('.wallboard-mini-telemetry');
  if (!telemetry) {
    telemetry = document.createElement('aside');
    telemetry.className = 'wallboard-mini-telemetry';
    telemetry.setAttribute('aria-label', 'Wallboard freshness telemetry');
    shell.appendChild(telemetry);
  }
  telemetry.innerHTML = `<span>Payload <b>${ageLabel(generatedAt)}</b></span><span>Browser <b>${ageLabel(lastBrowserCheckAt)}</b></span>`;
}

function enhanceWallboard(): void {
  const shell = document.querySelector<HTMLElement>('.wallboard-shell');
  if (!shell) {
    window.clearInterval(signalTimer);
    signalTimer = 0;
    return;
  }
  removeLegacyControlButtons(shell);
  const priority = shell.querySelector<HTMLElement>('.wallboard-priority');
  if (priority) {
    sortPriorityRows(priority);
    replacePriorityNumbers(shell);
    setupSignalPagination(priority);
  }
  ensureTelemetry(shell);
}

function scheduleEnhancement(): void {
  window.clearTimeout(enhancementTimer);
  enhancementTimer = window.setTimeout(enhanceWallboard, 100);
}

function revealControls(): void {
  const shell = document.querySelector<HTMLElement>('.wallboard-shell');
  if (!shell) return;
  shell.classList.add('wallboard-controls-visible');
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => shell.classList.remove('wallboard-controls-visible'), WALLBOARD_IDLE_MS);
}

window.addEventListener('sst:browser-check', event => {
  const detail = (event as CustomEvent<{ checkedAt?: number; generatedAt?: string }>).detail;
  lastBrowserCheckAt = Number(detail?.checkedAt || Date.now());
  generatedAt = Date.parse(detail?.generatedAt || '') || generatedAt;
  const shell = document.querySelector<HTMLElement>('.wallboard-shell');
  if (shell) ensureTelemetry(shell);
});

const observer = new MutationObserver(scheduleEnhancement);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('pointermove', revealControls, { passive: true });
window.addEventListener('pointerdown', revealControls, { passive: true });
window.addEventListener('keydown', revealControls);
window.addEventListener('resize', scheduleEnhancement, { passive: true });
window.setInterval(() => {
  const shell = document.querySelector<HTMLElement>('.wallboard-shell');
  if (shell) ensureTelemetry(shell);
}, 1000);
queueMicrotask(enhanceWallboard);
