import type { Incident, ProviderStatus, StatusColor, StatusPayload } from './types';

const severityRank: Record<StatusColor, number> = { red: 4, amber: 3, blue: 2, green: 1 };

export interface IssueBrief {
  id: string;
  provider: string;
  category: string;
  severity: StatusColor;
  label: string;
  title: string;
  detail: string;
  status: string;
  time: string;
  source: string;
  url: string;
  priority: number;
}

export interface DiagnosticSource {
  id: string;
  provider: string;
  category: string;
  severity: StatusColor;
  label: string;
  status: string;
  source: string;
  ok: boolean;
}

export interface IssueConsoleModel {
  version: string;
  generatedAt: string;
  incidentCount: number;
  affectedCount: number;
  lead?: IssueBrief;
  briefs: IssueBrief[];
  affected: DiagnosticSource[];
  diagnostics: DiagnosticSource[];
}

export function labelForSeverity(color: StatusColor): string {
  if (color === 'red') return 'major';
  if (color === 'amber') return 'degraded';
  if (color === 'green') return 'ok';
  return 'limited';
}

function sortIncident(a: Incident, b: Incident): number {
  return (severityRank[b.color] - severityRank[a.color]) || (b.priority - a.priority) || String(b.rawTime ?? '').localeCompare(String(a.rawTime ?? ''));
}

function sortProvider(a: ProviderStatus, b: ProviderStatus): number {
  return (severityRank[b.color] - severityRank[a.color]) || ((b.priority ?? 0) - (a.priority ?? 0)) || a.name.localeCompare(b.name);
}

function toBrief(incident: Incident): IssueBrief {
  return {
    id: `${incident.providerId}-${incident.title}`,
    provider: incident.provider,
    category: incident.category,
    severity: incident.color,
    label: labelForSeverity(incident.color),
    title: incident.title,
    detail: incident.note,
    status: incident.status || labelForSeverity(incident.color),
    time: incident.time,
    source: incident.source,
    url: incident.url,
    priority: incident.priority
  };
}

function toDiagnostic(provider: ProviderStatus): DiagnosticSource {
  return {
    id: provider.id,
    provider: provider.name,
    category: provider.category,
    severity: provider.color,
    label: labelForSeverity(provider.color),
    status: provider.status,
    source: provider.source,
    ok: provider.ok
  };
}

export function buildIssueConsoleModel(payload: StatusPayload, version: string): IssueConsoleModel {
  const briefs = [...payload.incidents].sort(sortIncident).map(toBrief);
  const diagnostics = [...payload.providers].sort(sortProvider).map(toDiagnostic);
  const affected = diagnostics.filter(source => source.severity === 'red' || source.severity === 'amber');

  return {
    version,
    generatedAt: payload.generated_at,
    incidentCount: briefs.length,
    affectedCount: affected.length,
    lead: briefs[0],
    briefs,
    affected,
    diagnostics
  };
}
