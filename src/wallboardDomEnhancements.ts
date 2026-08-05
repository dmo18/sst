let lastBrowserCheckAt = 0;
let generatedAt = 0;
let controlsTimer = 0;

function ageLabel(timestamp: number): string {
  if (!timestamp) return 'unknown';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function wallboardShell(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.wallboard-shell');
}

function revealControls(): void {
  const shell = wallboardShell();
  if (!shell) return;
  shell.classList.add('wallboard-controls-visible');
  window.clearTimeout(controlsTimer);
  controlsTimer = window.setTimeout(() => {
    wallboardShell()?.classList.remove('wallboard-controls-visible');
  }, 3200);
}

function ensureTelemetry(): void {
  const shell = wallboardShell();
  if (!shell) return;

  let telemetry = shell.querySelector<HTMLElement>('.wallboard-mini-telemetry');
  if (!telemetry) {
    telemetry = document.createElement('aside');
    telemetry.className = 'wallboard-mini-telemetry';
    telemetry.setAttribute('aria-label', 'Wallboard freshness telemetry');
    shell.appendChild(telemetry);
    revealControls();
  }

  telemetry.replaceChildren();
  const payload = document.createElement('span');
  payload.append('Payload ');
  const payloadAge = document.createElement('b');
  payloadAge.textContent = ageLabel(generatedAt);
  payload.appendChild(payloadAge);

  const browser = document.createElement('span');
  browser.append('Browser ');
  const browserAge = document.createElement('b');
  browserAge.textContent = ageLabel(lastBrowserCheckAt);
  browser.appendChild(browserAge);

  telemetry.append(payload, browser);
}

window.addEventListener('pointermove', revealControls, { passive: true });
window.addEventListener('pointerdown', revealControls, { passive: true });
window.addEventListener('keydown', revealControls);
window.addEventListener('sst:browser-check', event => {
  const detail = (event as CustomEvent<{ checkedAt?: number; generatedAt?: string }>).detail;
  lastBrowserCheckAt = Number(detail?.checkedAt || Date.now());
  generatedAt = Date.parse(detail?.generatedAt || '') || generatedAt;
  ensureTelemetry();
});

window.setInterval(ensureTelemetry, 1000);
queueMicrotask(ensureTelemetry);
