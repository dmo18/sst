const WALLBOARD_IDLE_MS = 2200;
const SIGNAL_ADVANCE_MS = 6500;

let idleTimer = 0;
let enhancementTimer = 0;
let signalTimer = 0;
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

function setupSignalRotation(section: HTMLElement): void {
  window.clearInterval(signalTimer);
  signalTimer = 0;
  section.scrollTo({ top: 0, behavior: 'auto' });
  const rows = priorityRows(section);
  if (rows.length < 2 || section.scrollHeight <= section.clientHeight + 8) return;

  let index = 0;
  signalTimer = window.setInterval(() => {
    const currentRows = priorityRows(section);
    if (!currentRows.length) return;
    index = (index + 1) % currentRows.length;
    const target = currentRows[index];
    const top = target.offsetTop - (section.querySelector('h2')?.clientHeight || 0) - 8;
    if (index === 0 || top >= section.scrollHeight - section.clientHeight - 4) {
      section.scrollTo({ top: index === 0 ? 0 : top, behavior: 'smooth' });
    } else {
      section.scrollTo({ top, behavior: 'smooth' });
    }
  }, SIGNAL_ADVANCE_MS);
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
    setupSignalRotation(priority);
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
