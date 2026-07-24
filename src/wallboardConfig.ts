export const WALLBOARD_SCREENS = ['heads-up', 'providers', 'sources'] as const;
export type WallboardScreen = typeof WALLBOARD_SCREENS[number];
export type ViewMode = 'operator' | 'wallboard';
export type Density = 'comfortable' | 'compact';
export const DEFAULT_SCREEN: WallboardScreen = 'heads-up';
export const DEFAULT_ROTATION_SECONDS = 30;
export const MIN_ROTATION_SECONDS = 20;
export const MAX_ROTATION_SECONDS = 300;
export const STALE_WARNING_MS = 40 * 60 * 1000;
export const STALE_CRITICAL_MS = 60 * 60 * 1000;
export const SCREEN_LABELS: Record<WallboardScreen, string> = {
  'heads-up': 'Heads Up', providers: 'All Providers', sources: 'Source Health'
};
export interface WallboardSettings { view: ViewMode; screen: WallboardScreen; rotateSeconds: number; density: Density; }
const one = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => allowed.includes(value as T) ? value as T : fallback;
export function parseWallboardSettings(search: string, saved: Partial<WallboardSettings> = {}): WallboardSettings {
  const query = new URLSearchParams(search);
  const savedView = one(saved.view ?? null, ['operator', 'wallboard'], 'operator');
  const savedScreen = one(saved.screen ?? null, WALLBOARD_SCREENS, DEFAULT_SCREEN);
  const savedDensity = one(saved.density ?? null, ['comfortable', 'compact'], 'comfortable');
  const view = one(query.get('view'), ['operator', 'wallboard'], savedView);
  const screen = one(query.get('screen'), WALLBOARD_SCREENS, savedScreen);
  const density = one(query.get('density'), ['comfortable', 'compact'], savedDensity);
  const raw = query.get('rotate');
  let rotateSeconds = Number.isFinite(saved.rotateSeconds) ? Math.min(MAX_ROTATION_SECONDS, Math.max(0, Number(saved.rotateSeconds))) : DEFAULT_ROTATION_SECONDS;
  if (raw !== null) {
    const parsed = Number(raw);
    rotateSeconds = parsed === 0 ? 0 : Number.isFinite(parsed) ? Math.min(MAX_ROTATION_SECONDS, Math.max(MIN_ROTATION_SECONDS, Math.round(parsed))) : DEFAULT_ROTATION_SECONDS;
  }
  return { view, screen, density, rotateSeconds };
}
export function providerPageSize(width: number, height: number, density: Density): number {
  if (width >= 3000) return density === 'compact' ? 60 : 48;
  if (height <= 740) return density === 'compact' ? 30 : 24;
  if (width >= 1800) return density === 'compact' ? 40 : 30;
  return density === 'compact' ? 30 : 24;
}
export function paginate<T>(items: T[], size: number): T[][] { const pages: T[][] = []; for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size)); return pages.length ? pages : [[]]; }
export function rotationAllowed(seconds: number, paused: boolean, reducedMotion: boolean, explicitlyEnabled: boolean): boolean {
  return seconds >= MIN_ROTATION_SECONDS && !paused && (!reducedMotion || explicitlyEnabled);
}
export type DataAgeState = 'normal' | 'warning' | 'critical' | 'invalid';
export function dataAge(generatedAt: string, now = Date.now()): { state: DataAgeState; ageMs: number | null } {
  const generated = Date.parse(generatedAt); if (!Number.isFinite(generated) || generated > now + 5 * 60 * 1000) return { state: 'invalid', ageMs: null };
  const ageMs = Math.max(0, now - generated);
  return { state: ageMs > STALE_CRITICAL_MS ? 'critical' : ageMs >= STALE_WARNING_MS ? 'warning' : 'normal', ageMs };
}
export function formatAge(ageMs: number | null): string { if (ageMs === null) return 'unknown age'; const minutes = Math.floor(ageMs / 60000); return minutes < 1 ? 'less than 1 minute old' : `${minutes} minute${minutes === 1 ? '' : 's'} old`; }
