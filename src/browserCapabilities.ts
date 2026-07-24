export function fullscreenSupported(doc: Document = document): boolean { return typeof doc.documentElement.requestFullscreen === 'function' && typeof doc.exitFullscreen === 'function'; }
export function wakeLockSupported(nav: Navigator = navigator): boolean { return 'wakeLock' in nav && typeof (nav as Navigator & { wakeLock?: { request?: unknown } }).wakeLock?.request === 'function'; }
