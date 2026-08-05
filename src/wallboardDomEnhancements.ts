let lastBrowserCheckAt = 0;
let generatedAt = 0;
let controlsTimer = 0;
let restoreTimer = 0;

type HeaderMode = 'auto' | 'open' | 'closed';

const HEADER_MODE_KEY = 'sst-wallboard-header-mode';

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

function readHeaderMode(): HeaderMode {
  const value = localStorage.getItem(HEADER_MODE_KEY);
  return value === 'open' || value === 'closed' ? value : 'auto';
}

function applyHeaderMode(shell: HTMLElement, mode: HeaderMode): void {
  shell.dataset.headerMode = mode;
  shell.classList.toggle('wallboard-controls-pinned-open', mode === 'open');
  shell.classList.toggle('wallboard-controls-pinned-closed', mode === 'closed');
  if (mode === 'open') shell.classList.add('wallboard-controls-visible');
  if (mode === 'closed') shell.classList.remove('wallboard-controls-visible');
}

function setHeaderMode(mode: HeaderMode): void {
  localStorage.setItem(HEADER_MODE_KEY, mode);
  const shell = wallboardShell();
  if (!shell) return;
  window.clearTimeout(controlsTimer);
  applyHeaderMode(shell, mode);
  ensureHeaderControls(shell);
  if (mode === 'auto') revealControls();
}

function revealRestoreControl(shell: HTMLElement): void {
  const restore = shell.querySelector<HTMLElement>('.wallboard-overlay-restore');
  if (!restore) return;
  restore.classList.add('is-visible');
  window.clearTimeout(restoreTimer);
  restoreTimer = window.setTimeout(() => restore.classList.remove('is-visible'), 2400);
}

function revealControls(): void {
  const shell = wallboardShell();
  if (!shell) return;
  const mode = readHeaderMode();
  applyHeaderMode(shell, mode);

  if (mode === 'closed') {
    revealRestoreControl(shell);
    return;
  }

  shell.classList.add('wallboard-controls-visible');
  window.clearTimeout(controlsTimer);
  if (mode === 'auto') {
    controlsTimer = window.setTimeout(() => {
      wallboardShell()?.classList.remove('wallboard-controls-visible');
    }, 3200);
  }
}

function ensureHeaderControls(shell: HTMLElement): void {
  const header = shell.querySelector<HTMLElement>(':scope > header');
  if (!header) return;

  let controls = header.querySelector<HTMLElement>('.wallboard-overlay-actions');
  if (!controls) {
    controls = document.createElement('div');
    controls.className = 'wallboard-overlay-actions';

    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'wallboard-overlay-action wallboard-overlay-pin';
    pin.addEventListener('click', () => setHeaderMode(readHeaderMode() === 'open' ? 'auto' : 'open'));

    const minimize = document.createElement('button');
    minimize.type = 'button';
    minimize.className = 'wallboard-overlay-action';
    minimize.textContent = 'Minimize';
    minimize.addEventListener('click', () => setHeaderMode('closed'));

    controls.append(pin, minimize);
    header.insertBefore(controls, header.lastElementChild);
  }

  const pin = controls.querySelector<HTMLButtonElement>('.wallboard-overlay-pin');
  const mode = readHeaderMode();
  if (pin) {
    pin.textContent = mode === 'open' ? 'Auto hide' : 'Pin open';
    pin.setAttribute('aria-pressed', String(mode === 'open'));
  }

  let restore = shell.querySelector<HTMLButtonElement>('.wallboard-overlay-restore');
  if (!restore) {
    restore = document.createElement('button');
    restore.type = 'button';
    restore.className = 'wallboard-overlay-restore';
    restore.textContent = 'Show header';
    restore.addEventListener('click', () => setHeaderMode('auto'));
    shell.appendChild(restore);
  }

  applyHeaderMode(shell, mode);
}

function ensureTelemetry(): void {
  const shell = wallboardShell();
  if (!shell) return;
  ensureHeaderControls(shell);

  const heading = shell.querySelector<HTMLElement>('.wallboard-priority > h2');
  if (!heading) return;

  let telemetry = heading.querySelector<HTMLElement>('.wallboard-mini-telemetry');
  if (!telemetry) {
    telemetry = document.createElement('span');
    telemetry.className = 'wallboard-mini-telemetry';
    telemetry.setAttribute('aria-label', 'Wallboard freshness telemetry');
    heading.appendChild(telemetry);
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
