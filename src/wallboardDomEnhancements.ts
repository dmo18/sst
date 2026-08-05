const WALLBOARD_IDLE_MS = 2200;

function normalize(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function removeLegacyControlButtons(shell: HTMLElement): void {
  for (const button of shell.querySelectorAll<HTMLButtonElement>('button')) {
    if (/show controls/i.test(button.textContent || '')) button.remove();
  }
}

function replacePriorityNumbers(shell: HTMLElement): void {
  const icons = new Map<string, HTMLImageElement>();
  for (const row of shell.querySelectorAll<HTMLElement>('.wallboard-providers article')) {
    const name = normalize(row.querySelector('b')?.textContent);
    const icon = row.querySelector<HTMLImageElement>('img.provider-logo, img');
    if (name && icon) icons.set(name, icon);
  }

  for (const row of shell.querySelectorAll<HTMLElement>('.wallboard-priority article')) {
    const provider = normalize(row.querySelector('div > b')?.textContent);
    const first = row.firstElementChild;
    const source = icons.get(provider);
    if (!first || !source || first.classList.contains('priority-provider-icon')) continue;
    const icon = source.cloneNode(true) as HTMLImageElement;
    icon.classList.add('priority-provider-icon');
    icon.alt = `${row.querySelector('div > b')?.textContent || 'Provider'} icon`;
    first.replaceWith(icon);
  }
}

function enhanceWallboard(): void {
  const shell = document.querySelector<HTMLElement>('.wallboard-shell');
  if (!shell) return;
  removeLegacyControlButtons(shell);
  replacePriorityNumbers(shell);
}

let idleTimer = 0;
function revealControls(): void {
  const shell = document.querySelector<HTMLElement>('.wallboard-shell');
  if (!shell) return;
  shell.classList.add('wallboard-controls-visible');
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => shell.classList.remove('wallboard-controls-visible'), WALLBOARD_IDLE_MS);
}

const observer = new MutationObserver(enhanceWallboard);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('pointermove', revealControls, { passive: true });
window.addEventListener('pointerdown', revealControls, { passive: true });
window.addEventListener('keydown', revealControls);
queueMicrotask(enhanceWallboard);
