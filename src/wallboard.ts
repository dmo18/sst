export type WallboardScreen = 'heads-up' | 'providers' | 'sources';
export type WallboardDensity = 'comfortable' | 'compact';
export interface WallboardSettings { view: 'operator' | 'wallboard'; screen: WallboardScreen; rotateSeconds: number; density: WallboardDensity }
export interface GridDimensions { columns: number; rows: number; capacity: number }

const screens = new Set<WallboardScreen>(['heads-up', 'providers', 'sources']);
export function parseWallboardSettings(search: string): WallboardSettings {
  const query = new URLSearchParams(search);
  const screen = query.get('screen') as WallboardScreen;
  const rawRotate = Number(query.get('rotate'));
  return {
    view: query.get('view') === 'wallboard' ? 'wallboard' : 'operator',
    screen: screens.has(screen) ? screen : 'heads-up',
    rotateSeconds: Number.isFinite(rawRotate) ? Math.min(3600, Math.max(0, Math.round(rawRotate))) : 0,
    density: query.get('density') === 'compact' ? 'compact' : 'comfortable'
  };
}

export function gridDimensions(width: number, height: number, density: WallboardDensity): GridDimensions {
  let columns: number, rows: number;
  if (width >= 3000 && height >= 1800) [columns, rows] = density === 'compact' ? [10, 6] : [8, 5];
  else if (width >= 1800 && height >= 900) [columns, rows] = density === 'compact' ? [8, 5] : [6, 4];
  else if (width >= 1300 && height >= 700) [columns, rows] = density === 'compact' ? [6, 4] : [5, 3];
  else if (width >= 900) [columns, rows] = density === 'compact' ? [5, 3] : [4, 3];
  else [columns, rows] = width < 500 ? [2, 4] : [3, 3];
  return { columns, rows, capacity: columns * rows };
}

export function paginate<T>(items: T[], capacity: number): T[][] {
  if (capacity < 1) return [];
  return Array.from({ length: Math.ceil(items.length / capacity) }, (_, index) => items.slice(index * capacity, (index + 1) * capacity));
}

export function dataAge(generatedAt: string, now = Date.now()): { minutes: number; level: 'current' | 'warning' | 'critical' } {
  const timestamp = Date.parse(generatedAt);
  const minutes = Number.isFinite(timestamp) ? Math.max(0, Math.floor((now - timestamp) / 60000)) : Number.POSITIVE_INFINITY;
  return { minutes, level: minutes >= 60 ? 'critical' : minutes >= 40 ? 'warning' : 'current' };
}

export function rotationEnabled(seconds: number, reducedMotion: boolean): boolean {
  return seconds > 0 && !reducedMotion;
}
