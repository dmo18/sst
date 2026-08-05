const WALLBOARD_IDLE_MS = 2200;
const SIGNAL_SCROLL_PIXELS_PER_SECOND = 18;

let idleTimer = 0;
let enhancementTimer = 0;
let signalAnimation: Animation | null = null;

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
  return [...section.querySelectorAll<HTMLElement>('article:not([data-wallboard-clone="true"])')];
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

  for (const row of shell.querySelectorAll<HTMLElement>('.wallboard-priority article:not([data-wallboard-clone="true"])')) {
    const providerName = row.querySelector('div > b')?.textContent || 'Provider';
    const provider = normalize(providerName);
    const first = row.firstElementChild;
    const source = icons.get(provider);
    if (!first || !source || first.classList.contains('priority-provider-icon')) continue;
    const icon = source.cloneNode(true) as HTMLImageElement;
    icon.classList.add('priority-provider-icon');
    icon.alt = `${providerName} icon`;
    first.replaceWith(icon);
  }
}

function clearSignalLoop(section: HTMLElement): void {
  signalAnimation?.cancel();
  signalAnimation = null;
  const viewport = section.querySelector<HTMLElement>(':scope > .wallboard-signal-viewport');
  if (!viewport) return;
  const originals = [...viewport.querySelectorAll<HTMLElement>('article:not([data-wallboard-clone="true"])')];
  for (const row of originals) section.appendChild(row);
  viewport.remove();
}

function setupSignalLoop(section: HTMLElement): void {
  clearSignalLoop(section);
  const rows = sortPriorityRows(section);
  if (rows.length < 2) return;

  const viewport = document.createElement('div');
  viewport.className = 'wallboard-signal-viewport';
  const track = document.createElement('div');
  track.className = 'wallboard-signal-track';
  viewport.appendChild(track);
  for (const row of rows) track.appendChild(row);
  section.appendChild(viewport);

  requestAnimationFrame(() => {
    const availableHeight = viewport.clientHeight;
    const originalHeight = track.scrollHeight;
    if (availableHeight <= 0 || originalHeight <= availableHeight + 8) return;

    for (const row of rows) {
      const clone = row.cloneNode(true) as HTMLElement;
      clone.dataset.wallboardClone = 'true';
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    }

    const duration = Math.max(18_000, originalHeight / SIGNAL_SCROLL_PIXELS_PER_SECOND * 1000);
    signalAnimation = track.animate(
      [{ transform: 'translateY(0)' }, { transform: `translateY(-${originalHeight}px)` }],
      { duration, iterations: Infinity, easing: 'linear' }
    );
  });
}

function enhanceWallboard(): void {
  const shell = document.querySelector<HTMLElement>('.wallboard-shell');
  if (!shell) {
    signalAnimation?.cancel();
    signalAnimation = null;
    return;
  }
  removeLegacyControlButtons(shell);
  const priority = shell.querySelector<HTMLElement>('.wallboard-priority');
  if (!priority) return;
  clearSignalLoop(priority);
  sortPriorityRows(priority);
  replacePriorityNumbers(shell);
  setupSignalLoop(priority);
}

function scheduleEnhancement(): void {
  window.clearTimeout(enhancementTimer);
  enhancementTimer = window.setTimeout(enhanceWallboard, 80);
}

function revealControls(): void {
  const shell = document.querySelector<HTMLElement>('.wallboard-shell');
  if (!shell) return;
  shell.classList.add('wallboard-controls-visible');
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => shell.classList.remove('wallboard-controls-visible'), WALLBOARD_IDLE_MS);
}

const observer = new MutationObserver(scheduleEnhancement);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('pointermove', revealControls, { passive: true });
window.addEventListener('pointerdown', revealControls, { passive: true });
window.addEventListener('keydown', revealControls);
window.addEventListener('resize', scheduleEnhancement, { passive: true });
queueMicrotask(enhanceWallboard);
