import type { Incident, ProviderConfig, ProviderDownloadLog, ProviderStatus, StatusColor, StatusPayload } from './types';

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
  message: string;
  source: string;
  ok: boolean;
  checkedAt: string;
  sourceType: string;
  downloadLog: ProviderDownloadLog[];
}

export interface DiagnosticSummary {
  okCount: number;
  failedCount: number;
  limitedCount: number;
  greenCount: number;
  amberCount: number;
  redCount: number;
  blueCount: number;
  categoryCount: number;
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
  summary: DiagnosticSummary;
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

function fallbackDownloadLog(provider: ProviderStatus, generatedAt: string): ProviderDownloadLog[] {
  return [{
    timestamp: provider.checked_at || generatedAt,
    completed_at: provider.checked_at || generatedAt,
    url: provider.source,
    source_type: provider.source_type || 'unknown',
    ok: provider.ok,
    status: provider.status,
    parser: 'parsed',
    message: provider.message || 'Per-source download timing was not recorded by this status payload.'
  }];
}

function catalogFallback(provider: ProviderConfig, generatedAt: string): ProviderStatus {
  return {
    id: provider.id,
    name: provider.name,
    category: provider.category,
    status: provider.enabled === false ? 'Disabled in provider catalog' : 'Pending source refresh',
    color: 'blue',
    message: provider.message || 'Provider exists in the canonical catalog but is not present in the latest generated status payload yet.',
    ok: provider.enabled !== false,
    source: provider.url,
    priority: provider.priority ?? 0,
    checked_at: generatedAt,
    source_type: provider.sourceType || 'unknown',
    download_log: [{
      timestamp: generatedAt,
      completed_at: generatedAt,
      duration_ms: 0,
      url: provider.url,
      source_type: provider.sourceType || 'unknown',
      ok: provider.enabled !== false,
      status: 'catalog only',
      parser: 'limited',
      message: 'Waiting for the next v2 Pages build to fetch this provider.'
    }]
  };
}

function toDiagnostic(provider: ProviderStatus, generatedAt: string): DiagnosticSource {
  const downloadLog = provider.download_log ?? [];
  return {
    id: provider.id,
    provider: provider.name,
    category: provider.category,
    severity: provider.color,
    label: labelForSeverity(provider.color),
    status: provider.status,
    message: provider.message || '',
    source: provider.source,
    ok: provider.ok,
    checkedAt: provider.checked_at || generatedAt,
    sourceType: provider.source_type || 'unknown',
    downloadLog: downloadLog.length ? downloadLog : fallbackDownloadLog(provider, generatedAt)
  };
}

function mergeCatalog(payload: StatusPayload, catalog: ProviderConfig[] = []): ProviderStatus[] {
  const byId = new Map<string, ProviderStatus>();
  for (const provider of payload.providers) byId.set(provider.id, provider);
  for (const provider of catalog) {
    if (!byId.has(provider.id)) byId.set(provider.id, catalogFallback(provider, payload.generated_at));
  }
  return [...byId.values()];
}

function summarize(diagnostics: DiagnosticSource[]): DiagnosticSummary {
  const categories = new Set(diagnostics.map(source => source.category));
  return {
    okCount: diagnostics.filter(source => source.ok).length,
    failedCount: diagnostics.filter(source => !source.ok).length,
    limitedCount: diagnostics.filter(source => source.severity === 'blue').length,
    greenCount: diagnostics.filter(source => source.severity === 'green').length,
    amberCount: diagnostics.filter(source => source.severity === 'amber').length,
    redCount: diagnostics.filter(source => source.severity === 'red').length,
    blueCount: diagnostics.filter(source => source.severity === 'blue').length,
    categoryCount: categories.size
  };
}

export function buildIssueConsoleModel(payload: StatusPayload, version: string, catalog: ProviderConfig[] = []): IssueConsoleModel {
  const briefs = [...payload.incidents].sort(sortIncident).map(toBrief);
  const diagnostics = mergeCatalog(payload, catalog).sort(sortProvider).map(provider => toDiagnostic(provider, payload.generated_at));
  const affected = diagnostics.filter(source => source.severity === 'red' || source.severity === 'amber');

  return {
    version,
    generatedAt: payload.generated_at,
    incidentCount: briefs.length,
    affectedCount: affected.length,
    lead: briefs[0],
    briefs,
    affected,
    diagnostics,
    summary: summarize(diagnostics)
  };
}
