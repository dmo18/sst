const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MAX_ALERT_WINDOW_MS = 30 * DAY_MS;
const MIN_BROWSER_REFRESH_MS = 15 * SECOND_MS;
const MAX_BROWSER_REFRESH_MS = HOUR_MS;

export const DEFAULT_BROWSER_REFRESH_MS = MINUTE_MS;

export interface WallboardRouteState {
  wallboardMode: boolean;
  alertWindowMs: number | null;
  refreshIntervalMs: number;
}

export function parseAlertWindowMs(value: string | null): number | null {
  const normalized = (value || '').trim().toLowerCase();
  const match = /^(\d+(?:\.\d+)?)(m|h|d)$/.exec(normalized);
  if (!match) return null;

  const amount = Number(match[1]);
  const multiplier = match[2] === 'm' ? MINUTE_MS : match[2] === 'h' ? HOUR_MS : DAY_MS;
  const windowMs = Math.round(amount * multiplier);

  if (!Number.isFinite(windowMs) || windowMs < MINUTE_MS || windowMs > MAX_ALERT_WINDOW_MS) return null;
  return windowMs;
}

export function parseRefreshIntervalMs(value: string | null): number {
  const normalized = (value || '').trim().toLowerCase();
  const match = /^(\d+(?:\.\d+)?)(s|m|h)$/.exec(normalized);
  if (!match) return DEFAULT_BROWSER_REFRESH_MS;

  const amount = Number(match[1]);
  const multiplier = match[2] === 's' ? SECOND_MS : match[2] === 'm' ? MINUTE_MS : HOUR_MS;
  const refreshMs = Math.round(amount * multiplier);

  if (!Number.isFinite(refreshMs) || refreshMs < MIN_BROWSER_REFRESH_MS || refreshMs > MAX_BROWSER_REFRESH_MS)
    return DEFAULT_BROWSER_REFRESH_MS;
  return refreshMs;
}

export function readWallboardRoute(search: string): WallboardRouteState {
  const params = new URLSearchParams(search);
  return {
    wallboardMode: params.get('view') === 'wallboard',
    alertWindowMs: parseAlertWindowMs(params.get('alerts')),
    refreshIntervalMs: parseRefreshIntervalMs(params.get('refresh'))
  };
}

export function isAlertWithinWindow(updatedAt: string, now: number, alertWindowMs: number | null): boolean {
  if (alertWindowMs === null) return true;
  const updatedAtMs = Date.parse(updatedAt);
  return Number.isFinite(updatedAtMs) && updatedAtMs >= now - alertWindowMs;
}
