const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MAX_ALERT_WINDOW_MS = 30 * DAY_MS;

export interface WallboardRouteState {
  wallboardMode: boolean;
  alertWindowMs: number | null;
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

export function readWallboardRoute(search: string): WallboardRouteState {
  const params = new URLSearchParams(search);
  return {
    wallboardMode: params.get('view') === 'wallboard',
    alertWindowMs: parseAlertWindowMs(params.get('alerts'))
  };
}

export function isAlertWithinWindow(updatedAt: string, now: number, alertWindowMs: number | null): boolean {
  if (alertWindowMs === null) return true;
  const updatedAtMs = Date.parse(updatedAt);
  return Number.isFinite(updatedAtMs) && updatedAtMs >= now - alertWindowMs;
}
