import type { ActionItem } from './statusViewModel';

export const COMPACT_PAGE_SIZE = 4;
export const COMPACT_PAGE_MS = 8000;

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
