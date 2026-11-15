import { useEffect, useState } from 'react';
import { utcTextToEastern } from './easternTime.ts';

/**
 * Supplementary Microsoft 365 workload advisories, relayed by a third party
 * for its own tenant (see scripts/collect-m365-advisories.mjs). They are shown
 * as extra reading only. Nothing here may change a service state.
 */
export interface MicrosoftAdvisory {
  id: string;
  title: string;
  service: string;
  classification: 'incident' | 'advisory';
  startedAt: string;
  lastUpdated: string;
  userImpact: string;
  currentStatus: string;
}

export interface MicrosoftAdvisories {
  publisher: string;
  sourceUrl: string;
  fetchedAt: string;
  items: MicrosoftAdvisory[];
}

/** The supplement is dropped, not shown stale, once it is this old. */
export const ADVISORIES_MAX_AGE_MS = 60 * 60 * 1000;

function text(value: unknown, max = 800): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** Accept only a well-formed, ok, recent document. Anything else is no supplement at all. */
export function readMicrosoftAdvisories(raw: unknown, now: number): MicrosoftAdvisories | null {
  if (!raw || typeof raw !== 'object') return null;
  const document = raw as Record<string, unknown>;
  if (document.schema !== 1 || document.kind !== 'supplement' || document.ok !== true || !Array.isArray(document.items)) return null;
  const fetchedAt = text(document.fetched_at, 40);
  const fetchedMs = Date.parse(fetchedAt);
  if (!Number.isFinite(fetchedMs) || now - fetchedMs > ADVISORIES_MAX_AGE_MS || fetchedMs - now > 10 * 60 * 1000) return null;
  const sourceUrl = text(document.source_url, 300);
  if (!/^https:\/\//.test(sourceUrl)) return null;
  const items: MicrosoftAdvisory[] = [];
  for (const entry of document.items.slice(0, 40)) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const id = text(item.id, 20);
    const classification = item.classification === 'incident' ? 'incident' : item.classification === 'advisory' ? 'advisory' : null;
    const startedAt = text(item.started_at, 40);
    const lastUpdated = text(item.last_updated, 40) || startedAt;
    if (!/^[A-Z]{2}\d{5,8}$/.test(id) || !classification || !Number.isFinite(Date.parse(startedAt))) continue;
    items.push({
      id,
      classification,
      startedAt,
      lastUpdated,
      title: utcTextToEastern(text(item.title, 300), lastUpdated),
      service: text(item.service, 120),
      userImpact: utcTextToEastern(text(item.user_impact), lastUpdated),
      currentStatus: utcTextToEastern(text(item.current_status), lastUpdated)
    });
  }
  return { publisher: text(document.publisher, 120) || 'a third party', sourceUrl, fetchedAt, items };
}

export function useMicrosoftAdvisories(refreshKey: string): MicrosoftAdvisories | null {
  const [advisories, setAdvisories] = useState<MicrosoftAdvisories | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}m365-advisories.json?ts=${Date.now()}`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(raw => { if (!cancelled) setAdvisories(readMicrosoftAdvisories(raw, Date.now())); })
      .catch(() => { if (!cancelled) setAdvisories(null); });
    return () => { cancelled = true; };
  }, [refreshKey]);
  return advisories;
}
