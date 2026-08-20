import type { EventCorrelation } from './eventCorrelation';
import type { DiagnosticSource, IssueBrief, IssueConsoleModel } from './statusViewModel';
import type { StatusChange } from './types';

export const OPERATOR_WORKSPACE_STORAGE_KEY = 'sst-operator-workspace-v1';

export type OperatorActionStatus = 'open' | 'acknowledged' | 'following' | 'snoozed' | 'resolved';

export interface OperatorActionRecord {
  incidentId: string;
  status: OperatorActionStatus;
  assignee: string;
  note: string;
  snoozedUntil?: string;
  updatedAt: string;
}

export interface SavedLens {
  id: string;
  name: string;
  providerIds: string[];
  createdAt: string;
}

export interface OperatorWorkspaceState {
  version: 1;
  lastSeenGeneratedAt?: string;
  actions: Record<string, OperatorActionRecord>;
  pinnedProviderIds: string[];
  lenses: SavedLens[];
}

export interface ChangeDigest {
  changes: StatusChange[];
  newIncidents: number;
  recoveries: number;
  sourceChanges: number;
  maintenanceChanges: number;
  severityChanges: number;
}

export type SearchKind = 'incident' | 'provider' | 'maintenance' | 'correlation' | 'category' | 'change';

export interface WorkspaceSearchEntry {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  keywords: string;
  target: string;
}

export interface UniverseNode {
  id: string;
  kind: 'category' | 'provider';
  label: string;
  category: string;
  x: number;
  y: number;
  tone: 'critical' | 'warning' | 'positive' | 'unknown';
  providerId?: string;
  sourceHealth?: DiagnosticSource['sourceHealth'];
  criticality?: string;
}

export interface UniverseEdge {
  id: string;
  from: string;
  to: string;
  kind: 'membership' | 'correlation';
  confidence?: EventCorrelation['confidence'];
}

export interface UniverseGraph {
  nodes: UniverseNode[];
  edges: UniverseEdge[];
}

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;

export function emptyOperatorWorkspace(): OperatorWorkspaceState {
  return { version: 1, actions: {}, pinnedProviderIds: [], lenses: [] };
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))];
}

export function normalizeOperatorWorkspace(value: unknown): OperatorWorkspaceState {
  if (!value || typeof value !== 'object') return emptyOperatorWorkspace();
  const record = value as Partial<OperatorWorkspaceState>;
  const actions: Record<string, OperatorActionRecord> = {};
  if (record.actions && typeof record.actions === 'object') {
    for (const [key, candidate] of Object.entries(record.actions)) {
      if (!candidate || typeof candidate !== 'object') continue;
      const item = candidate as Partial<OperatorActionRecord>;
      if (!item.incidentId || !['open', 'acknowledged', 'following', 'snoozed', 'resolved'].includes(item.status || '')) continue;
      actions[key] = {
        incidentId: item.incidentId,
        status: item.status as OperatorActionStatus,
        assignee: typeof item.assignee === 'string' ? item.assignee : '',
        note: typeof item.note === 'string' ? item.note : '',
        ...(typeof item.snoozedUntil === 'string' ? { snoozedUntil: item.snoozedUntil } : {}),
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date(0).toISOString()
      };
    }
  }
  const lenses = Array.isArray(record.lenses) ? record.lenses.flatMap(candidate => {
    if (!candidate || typeof candidate !== 'object') return [];
    const lens = candidate as Partial<SavedLens>;
    if (!lens.id || !lens.name) return [];
    return [{
      id: lens.id,
      name: lens.name,
      providerIds: uniqueStrings(lens.providerIds),
      createdAt: typeof lens.createdAt === 'string' ? lens.createdAt : new Date(0).toISOString()
    }];
  }) : [];
  return {
    version: 1,
    ...(typeof record.lastSeenGeneratedAt === 'string' ? { lastSeenGeneratedAt: record.lastSeenGeneratedAt } : {}),
    actions,
    pinnedProviderIds: uniqueStrings(record.pinnedProviderIds),
    lenses
  };
}

export function readOperatorWorkspace(storage?: StorageReader | null): OperatorWorkspaceState {
  const target = storage === undefined ? (typeof localStorage === 'undefined' ? null : localStorage) : storage;
  if (!target) return emptyOperatorWorkspace();
  try {
    const raw = target.getItem(OPERATOR_WORKSPACE_STORAGE_KEY);
    return raw ? normalizeOperatorWorkspace(JSON.parse(raw)) : emptyOperatorWorkspace();
  } catch {
    return emptyOperatorWorkspace();
  }
}

export function writeOperatorWorkspace(state: OperatorWorkspaceState, storage?: StorageWriter | null): void {
  const target = storage === undefined ? (typeof localStorage === 'undefined' ? null : localStorage) : storage;
  if (!target) return;
  try {
    target.setItem(OPERATOR_WORKSPACE_STORAGE_KEY, JSON.stringify(normalizeOperatorWorkspace(state)));
  } catch {
    // Restricted or full browser storage must not block the public operator workspace.
  }
}

export function updateIncidentAction(
  state: OperatorWorkspaceState,
  incidentId: string,
  patch: Partial<Pick<OperatorActionRecord, 'status' | 'assignee' | 'note' | 'snoozedUntil'>>,
  now = Date.now()
): OperatorWorkspaceState {
  const current = state.actions[incidentId] || {
    incidentId,
    status: 'open' as const,
    assignee: '',
    note: '',
    updatedAt: new Date(now).toISOString()
  };
  const next: OperatorActionRecord = {
    ...current,
    ...patch,
    incidentId,
    updatedAt: new Date(now).toISOString()
  };
  if (next.status !== 'snoozed') delete next.snoozedUntil;
  return { ...state, actions: { ...state.actions, [incidentId]: next } };
}

export function effectiveOperatorStatus(record: OperatorActionRecord | undefined, now = Date.now()): OperatorActionStatus {
  if (!record) return 'open';
  if (record.status === 'snoozed' && record.snoozedUntil && Date.parse(record.snoozedUntil) <= now) return 'open';
  return record.status;
}

export function togglePinnedProvider(state: OperatorWorkspaceState, providerId: string): OperatorWorkspaceState {
  const pinned = state.pinnedProviderIds.includes(providerId)
    ? state.pinnedProviderIds.filter(id => id !== providerId)
    : [...state.pinnedProviderIds, providerId];
  return { ...state, pinnedProviderIds: pinned };
}

export function saveLens(state: OperatorWorkspaceState, name: string, providerIds: string[], now = Date.now()): OperatorWorkspaceState {
  const normalizedName = name.trim();
  if (!normalizedName) return state;
  const normalizedProviders = uniqueStrings(providerIds);
  const existing = state.lenses.find(lens => lens.name.toLowerCase() === normalizedName.toLowerCase());
  const lens: SavedLens = {
    id: existing?.id || `lens:${normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || now}`,
    name: normalizedName,
    providerIds: normalizedProviders,
    createdAt: existing?.createdAt || new Date(now).toISOString()
  };
  return {
    ...state,
    lenses: existing ? state.lenses.map(item => item.id === existing.id ? lens : item) : [...state.lenses, lens]
  };
}

export function removeLens(state: OperatorWorkspaceState, lensId: string): OperatorWorkspaceState {
  return { ...state, lenses: state.lenses.filter(lens => lens.id !== lensId) };
}

export function buildChangeDigest(model: IssueConsoleModel, lastSeenGeneratedAt?: string): ChangeDigest {
  const cutoff = lastSeenGeneratedAt ? Date.parse(lastSeenGeneratedAt) : Number.NaN;
  const source = Number.isFinite(cutoff)
    ? model.history.filter(change => Date.parse(change.detected_at) > cutoff)
    : model.changes;
  const changes = [...source].sort((a, b) => Date.parse(b.detected_at) - Date.parse(a.detected_at));
  return {
    changes,
    newIncidents: changes.filter(change => change.type === 'incident_new').length,
    recoveries: changes.filter(change => ['incident_resolved', 'service_recovered', 'source_recovered'].includes(change.type)).length,
    sourceChanges: changes.filter(change => change.type.startsWith('source_')).length,
    maintenanceChanges: changes.filter(change => change.type.startsWith('maintenance_')).length,
    severityChanges: changes.filter(change => change.type.startsWith('severity_') || change.type === 'service_degraded').length
  };
}

function distinctRecentChanges(history: StatusChange[], limit = 80): StatusChange[] {
  const seen = new Set<string>();
  const result: StatusChange[] = [];
  for (const change of [...history].sort((a, b) => Date.parse(b.detected_at) - Date.parse(a.detected_at))) {
    const key = `${change.provider_id}|${change.type}|${change.title.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(change);
    if (result.length >= limit) break;
  }
  return result;
}

export function buildWorkspaceSearchIndex(model: IssueConsoleModel): WorkspaceSearchEntry[] {
  const entries: WorkspaceSearchEntry[] = [];
  for (const incident of model.briefs) entries.push({
    id: `incident:${incident.id}`,
    kind: 'incident',
    title: incident.title,
    subtitle: `${incident.provider} · ${incident.operatorPriority}`,
    keywords: `${incident.provider} ${incident.category} ${incident.note} ${incident.affectedServiceLabel} ${incident.status || ''}`.toLowerCase(),
    target: `incident:${incident.id}`
  });
  for (const provider of model.diagnostics) entries.push({
    id: `provider:${provider.id}`,
    kind: 'provider',
    title: provider.provider,
    subtitle: `${provider.category} · ${provider.serviceState} · source ${provider.sourceHealth}`,
    keywords: `${provider.searchText} ${provider.services.join(' ')} ${provider.tags.join(' ')}`.toLowerCase(),
    target: `provider:${provider.id}`
  });
  for (const maintenance of model.maintenance) entries.push({
    id: `maintenance:${maintenance.id}`,
    kind: 'maintenance',
    title: maintenance.title,
    subtitle: `${maintenance.provider} · ${maintenance.status}`,
    keywords: `${maintenance.provider} ${maintenance.category} ${maintenance.note} ${maintenance.affected_service || ''}`.toLowerCase(),
    target: `provider:${maintenance.providerId}`
  });
  for (const correlation of model.correlations) entries.push({
    id: correlation.id,
    kind: 'correlation',
    title: correlation.label,
    subtitle: `${correlation.providers.join(', ')} · ${correlation.confidence} confidence`,
    keywords: `${correlation.providers.join(' ')} ${correlation.categories.join(' ')} ${correlation.rationale}`.toLowerCase(),
    target: `correlation:${correlation.id}`
  });
  for (const category of model.categoryPulse) entries.push({
    id: `category:${category.category}`,
    kind: 'category',
    title: category.category,
    subtitle: `${category.total} providers · ${category.affected} affected · ${category.blind} blind`,
    keywords: `${category.category} dependency group ${category.total} providers`.toLowerCase(),
    target: `category:${category.category}`
  });
  for (const change of distinctRecentChanges(model.history)) entries.push({
    id: `change:${change.id}`,
    kind: 'change',
    title: change.title,
    subtitle: `${change.provider} · ${change.type.replaceAll('_', ' ')}`,
    keywords: `${change.provider} ${change.type} ${change.title}`.toLowerCase(),
    target: `provider:${change.provider_id}`
  });
  return entries;
}

function tokenScore(entry: WorkspaceSearchEntry, token: string): number {
  const title = entry.title.toLowerCase();
  const subtitle = entry.subtitle.toLowerCase();
  if (title === token) return 120;
  if (title.startsWith(token)) return 70;
  if (title.includes(token)) return 45;
  if (subtitle.includes(token)) return 25;
  if (entry.keywords.includes(token)) return 10;
  return 0;
}

export function searchWorkspace(entries: WorkspaceSearchEntry[], query: string, limit = 18): WorkspaceSearchEntry[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return entries.slice(0, limit);
  return entries
    .map(entry => ({ entry, score: tokens.reduce((sum, token) => sum + tokenScore(entry, token), 0) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit)
    .map(item => item.entry);
}

function nodeTone(source: DiagnosticSource): UniverseNode['tone'] {
  if (source.serviceState === 'major' || source.sourceHealth === 'blind') return 'critical';
  if (source.serviceState === 'degraded' || source.serviceState === 'unknown' || source.sourceHealth === 'watch') return 'warning';
  if (source.serviceState === 'operational' && source.sourceHealth === 'healthy') return 'positive';
  return 'unknown';
}

export function buildUniverseGraph(model: IssueConsoleModel): UniverseGraph {
  const width = 1200;
  const height = 720;
  const centerX = width / 2;
  const centerY = height / 2;
  const categories = [...model.categoryPulse].sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
  const nodes: UniverseNode[] = [];
  const edges: UniverseEdge[] = [];
  const categoryPositions = new Map<string, { x: number; y: number }>();
  const providerPositions = new Map<string, { x: number; y: number }>();
  const categoryRadius = 220;
  const providerRadius = 305;
  const startAngle = -Math.PI / 2;
  const orderedProviders = categories.flatMap(category => model.diagnostics
    .filter(provider => provider.category === category.category)
    .sort((a, b) => b.priority - a.priority || a.provider.localeCompare(b.provider)));
  const providerCount = Math.max(1, orderedProviders.length);
  const providerAngle = new Map<string, number>();

  orderedProviders.forEach((provider, index) => {
    providerAngle.set(provider.id, startAngle + (Math.PI * 2 * index / providerCount));
  });

  categories.forEach((category, index) => {
    const providers = orderedProviders.filter(provider => provider.category === category.category);
    const angles = providers.map(provider => providerAngle.get(provider.id) as number);
    const angle = angles.length
      ? Math.atan2(
        angles.reduce((sum, value) => sum + Math.sin(value), 0),
        angles.reduce((sum, value) => sum + Math.cos(value), 0)
      )
      : startAngle + (Math.PI * 2 * index / Math.max(1, categories.length));
    const x = centerX + Math.cos(angle) * categoryRadius;
    const y = centerY + Math.sin(angle) * categoryRadius;
    categoryPositions.set(category.category, { x, y });
    nodes.push({
      id: `category:${category.category}`,
      kind: 'category',
      label: category.category,
      category: category.category,
      x,
      y,
      tone: category.affected > 0 || category.blind > 0 ? 'warning' : 'positive'
    });
  });

  orderedProviders.forEach((provider, index) => {
    const angle = providerAngle.get(provider.id) as number;
    const radius = providerRadius + (index % 2 === 0 ? -20 : 20);
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    providerPositions.set(provider.id, { x, y });
    nodes.push({
      id: `provider:${provider.id}`,
      kind: 'provider',
      label: provider.provider,
      category: provider.category,
      x,
      y,
      tone: nodeTone(provider),
      providerId: provider.id,
      sourceHealth: provider.sourceHealth,
      criticality: provider.criticality
    });
    edges.push({
      id: `membership:${provider.category}:${provider.id}`,
      from: `category:${provider.category}`,
      to: `provider:${provider.id}`,
      kind: 'membership'
    });
  });

  for (const correlation of model.correlations) {
    const providerIds = correlation.providerIds.filter(id => providerPositions.has(id));
    for (let index = 1; index < providerIds.length; index += 1) {
      edges.push({
        id: `correlation:${correlation.id}:${index}`,
        from: `provider:${providerIds[index - 1]}`,
        to: `provider:${providerIds[index]}`,
        kind: 'correlation',
        confidence: correlation.confidence
      });
    }
  }

  return { nodes, edges };
}

export function relatedCorrelation(model: IssueConsoleModel, incident: IssueBrief): EventCorrelation | undefined {
  return model.correlations.find(correlation => correlation.incidentIds.includes(incident.id));
}

export function buildHandoffText(
  incident: IssueBrief,
  source: DiagnosticSource | undefined,
  action: OperatorActionRecord | undefined,
  correlation: EventCorrelation | undefined
): string {
  const lines = [
    `ServiceOps handoff - ${incident.provider}`,
    `${incident.title}`,
    `Vendor state: ${incident.service_state}`,
    `Evidence: ${incident.evidenceLabel}`,
    `Priority: ${incident.operatorPriority}`,
    `Likely MSP impact: ${incident.mspImpact}`,
    `Technician action: ${incident.technicianAction}`
  ];
  if (source) lines.push(`Source trust: ${source.sourceHealth}; quality ${source.dataQualityScore}/100; ${source.truthBasis}`);
  if (correlation) lines.push(`Correlation: ${correlation.label} (${correlation.confidence}); ${correlation.rationale}`);
  if (action) {
    lines.push(`Local operator state: ${effectiveOperatorStatus(action)}`);
    if (action.assignee) lines.push(`Local assignee: ${action.assignee}`);
    if (action.note) lines.push(`Local note: ${action.note}`);
  }
  lines.push(`Official source: ${incident.url}`);
  lines.push('Local operator fields are browser-only workflow state and do not modify vendor truth.');
  return lines.join('\n');
}
