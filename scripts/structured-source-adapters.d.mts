// Type surface of the collector parser that the browser bundle shares.
export interface CollectorComponent { name: string; status: string; group?: string }
export interface CollectorIncident {
  id?: string;
  title: string;
  note?: string;
  status?: string;
  firstDetected?: string;
  latestUpdate?: string;
  affectedService?: string;
  color?: string;
  url?: string;
  updates?: Array<{ status?: string; note?: string; at?: string }>;
}
export interface CollectorConclusion {
  kind: 'healthy' | 'issues' | 'component-state' | 'limited';
  status?: string;
  color?: string;
  message?: string;
  incidents?: CollectorIncident[];
  components?: CollectorComponent[];
  maintenance?: unknown[];
}
export function parseStatuspageSummary(
  value: unknown,
  provider?: { id?: string; name?: string },
  source?: { regionScope?: string; pageUrl?: string; url?: string }
): CollectorConclusion | null;
