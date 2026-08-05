const WALLBOARD_IDLE_MS = 2200;

let idleTimer = 0;
let enhancementTimer = 0;
let lastBrowserCheckAt = 0;
let generatedAt = 0;

function removeLegacyControlButtons(shell: HTMLElement): void {
  for (const button of shell.querySelectorAll<HTMLButtonElement>('button')) {
    if (/show controls/i.test(button.textContent || '')) button.remove();
  }
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
  if (!shell) return;
  removeLegacyControlButtons(shell);
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
window.setInterval(() => {
  const shell = document.querySelector<HTMLElement>('.wallboard-shell');
  if (shell) ensureTelemetry(shell);
}, 1000);
queueMicrotask(enhanceWallboard);
