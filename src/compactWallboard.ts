import type { ActionItem } from './statusViewModel';

/** Presentation-only ordering. Never changes incident inclusion or vendor truth. */
export function compactSignals(signals: readonly ActionItem[]): ActionItem[] {
  const rank: Record<string, number> = { critical: 0, action: 1, watch: 2, informational: 3 };
  return [...signals].sort((a, b) => (rank[a.attention] ?? 3) - (rank[b.attention] ?? 3)
    || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    || a.provider.localeCompare(b.provider)
    || a.id.localeCompare(b.id));
}

/** Use vendor wording, not an invented/AI summary, for generic incident headings. */
export function compactHeadline(item: Pick<ActionItem, 'title' | 'detail'>): string {
  const title = item.title.replace(/\s+/g, ' ').trim();
  const generic = /^(investigating|investigation|identified|monitoring|update|degraded performance|partial outage|service disruption|incident)([\s:–—-]+(degraded performance|partial outage|service disruption|update))?[.!]?$/i;
  if (generic.test(title) && item.detail.trim()) {
    return item.detail.replace(/\s+/g, ' ').trim();
  }
  return title || item.detail.replace(/\s+/g, ' ').trim();
}

/** Brief verbatim vendor excerpt; never invent missing incident details. */
export function compactDescription(item: Pick<ActionItem, 'title' | 'detail'>): string {
  const detail = item.detail.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!detail || detail === item.title.replace(/\s+/g, ' ').trim()) return '';
  if (detail.length <= 360) return detail;
  const excerpt = detail.slice(0, 357);
  return `${excerpt.slice(0, excerpt.lastIndexOf(' ') > 280 ? excerpt.lastIndexOf(' ') : 357)}…`;
}

export function compactCountdown(target: number | null, now: number): string {
  if (target === null || !Number.isFinite(target)) return 'unknown';
  const seconds = Math.ceil((target - now) / 1000);
  if (seconds <= 0) return 'due / waiting';
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}
