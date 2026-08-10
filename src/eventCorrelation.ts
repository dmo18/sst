import type { Incident } from './types';

export const EVENT_CORRELATION_WINDOW_MS = 20 * 60 * 1000;

export interface EventCorrelation {
  id: string;
  providerIds: string[];
  providers: string[];
  categories: string[];
  incidentIds: string[];
  startedAt: string;
  latestAt: string;
  confidence: 'low' | 'medium';
  label: string;
  rationale: string;
}

function vendorEventTime(incident: Incident): number | null {
  if (incident.evidence_basis === 'current-page') return null;
  for (const value of [incident.first_detected, incident.rawTime, incident.latest_update]) {
    const timestamp = Date.parse(value || '');
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return null;
}

function uniqueProviders(records: Array<{ incident: Incident; time: number }>): Array<{ incident: Incident; time: number }> {
  const seen = new Set<string>();
  return records.filter(record => {
    if (seen.has(record.incident.providerId)) return false;
    seen.add(record.incident.providerId);
    return true;
  });
}

function clusterFrom(records: Array<{ incident: Incident; time: number }>, confidence: 'low' | 'medium', label: string): EventCorrelation {
  const providers = [...new Set(records.map(record => record.incident.provider))].sort();
  const providerIds = [...new Set(records.map(record => record.incident.providerId))].sort();
  const categories = [...new Set(records.map(record => record.incident.category))].sort();
  const incidentIds = records.map(record => record.incident.id).sort();
  const times = records.map(record => record.time).sort((a, b) => a - b);
  const startedAt = new Date(times[0]).toISOString();
  const latestAt = new Date(times.at(-1) as number).toISOString();
  return {
    id: `correlation:${providerIds.join('|')}:${startedAt}`,
    providerIds,
    providers,
    categories,
    incidentIds,
    startedAt,
    latestAt,
    confidence,
    label,
    rationale: `${providerIds.length} active vendor-timed incidents began within 20 minutes across ${categories.length} service categor${categories.length === 1 ? 'y' : 'ies'}. Temporal correlation only; no causal relationship is inferred.`
  };
}

export function buildEventCorrelations(incidents: Incident[]): EventCorrelation[] {
  const records = incidents
    .map(incident => ({ incident, time: vendorEventTime(incident) }))
    .filter((record): record is { incident: Incident; time: number } => record.time !== null)
    .sort((a, b) => a.time - b.time || a.incident.providerId.localeCompare(b.incident.providerId));
  const clusters: EventCorrelation[] = [];
  const signatures = new Set<string>();

  for (let index = 0; index < records.length; index += 1) {
    const seed = records[index];
    const windowRecords = uniqueProviders(records.filter(record => record.time >= seed.time && record.time <= seed.time + EVENT_CORRELATION_WINDOW_MS));
    const byCategory = new Map<string, Array<{ incident: Incident; time: number }>>();
    for (const record of windowRecords) byCategory.set(record.incident.category, [...(byCategory.get(record.incident.category) || []), record]);
    const sameCategory = [...byCategory.entries()]
      .filter(([, group]) => group.length >= 2)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];

    let selected: Array<{ incident: Incident; time: number }> = [];
    let confidence: 'low' | 'medium' = 'low';
    let label = 'Cross-service activity cluster';
    if (sameCategory) {
      selected = sameCategory[1];
      confidence = 'medium';
      label = `${sameCategory[0]} activity cluster`;
    } else if (windowRecords.length >= 3 && new Set(windowRecords.map(record => record.incident.category)).size >= 2) {
      selected = windowRecords;
    } else {
      continue;
    }

    const signature = selected.map(record => record.incident.providerId).sort().join('|');
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    clusters.push(clusterFrom(selected, confidence, label));
  }

  return clusters.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}
