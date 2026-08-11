import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { componentStatusDisposition, componentStatusIsProblem } from './componentStatus';
import { ProviderIcon } from './providerIcon';
import { countdownLabel, relativeAgeAt } from './liveTelemetry';
import { effectiveIncidentTime } from './statusContract';
import {
  filterDiagnostics,
  type ActionItem,
  type CategoryPulse,
  type DiagnosticSource,
  type IssueBrief,
  type IssueConsoleModel
} from './statusViewModel';
import type { DataLifecycle, Maintenance } from './types';

const EASTERN_TIME_ZONE = 'America/New_York';
const views = ['overview', 'incidents', 'providers', 'sources', 'timeline'] as const;
type ConsoleView = typeof views[number] | 'wallboard';
type ProviderSortKey = 'provider' | 'service' | 'source' | 'quality' | 'incidents' | 'latency' | 'freshness';
type SortDirection = 'asc' | 'desc';

const viewMeta: Record<typeof views[number], { label: string; description: string }> = {
  overview: { label: 'Overview', description: 'Operational posture and priority work' },
  incidents: { label: 'Incident operations', description: 'Active vendor events and maintenance' },
  providers: { label: 'Provider operations', description: 'Service state, evidence, and collection detail' },
  sources: { label: 'Source reliability', description: 'Collection quality and blind-spot control' },
  timeline: { label: 'Audit timeline', description: 'Bounded lifecycle and source changes' }
};

function readStoredView(): typeof views[number] | null {
  try {
    const stored = localStorage.getItem('sst-command-view');
    return views.includes(stored as typeof views[number]) ? stored as typeof views[number] : null;
  } catch {
    return null;
  }
}

function storeView(view: typeof views[number]): void {
  try {
    localStorage.setItem('sst-command-view', view);
  } catch {
    // Restricted browser storage must not block the operator workspace.
  }
}

function parseTime(value?: string): number {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function timeLabel(value?: string, compact = false): string {
  if (!parseTime(value)) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    month: 'short',
    day: '2-digit',
    ...(compact ? {} : { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
    second: compact ? undefined : '2-digit',
    hour12: true,
    timeZoneName: compact ? undefined : 'short'
  }).format(new Date(value as string));
}

function clockLabel(now: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(new Date(now));
}

function dateLabel(now: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: '2-digit'
  }).format(new Date(now));
}

function durationLabel(milliseconds?: number): string {
  const value = Number(milliseconds || 0);
  if (value < 1000) return `${Math.max(0, Math.round(value))} ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} s`;
  return `${Math.round(value / 60_000)} min`;
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function qualityLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Strong';
  if (score >= 50) return 'Watch';
  if (score >= 25) return 'Weak';
  return 'Blind';
}

function serviceTone(state: DiagnosticSource['serviceState']): string {
  return state === 'major' ? 'critical' : state === 'degraded' ? 'warning' : state === 'operational' ? 'positive' : 'neutral';
}

function sourceTone(state: DiagnosticSource['sourceHealth']): string {
  return state === 'blind' ? 'critical' : state === 'watch' ? 'warning' : 'positive';
}

function StateBadge({ tone, children }: { tone: string; children: ReactNode }): JSX.Element {
  return <span className={`status-chip status-${tone}`}><i />{children}</span>;
}

function ProviderIdentity({ id, name, category, compact = false }: { id: string; name: string; category?: string; compact?: boolean }): JSX.Element {
  return (
    <div className={`provider-identity ${compact ? 'is-compact' : ''}`}>
      <ProviderIcon id={id} name={name} />
      <span><b>{name}</b>{category && <small>{category}</small>}</span>
    </div>
  );
}

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <button className="ui-button ui-button-secondary ui-button-small" type="button" onClick={async () => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      } catch {
        setCopied(false);
      }
    }}>
      {copied ? 'Copied' : label}
    </button>
  );
}

function MetricTile({ label, value, detail, tone = 'default', live = false }: { label: string; value: string | number; detail?: string; tone?: string; live?: boolean }): JSX.Element {
  return (
    <article className={`metric-tile metric-${tone}`}>
      <header><span>{label}</span>{live && <em>Live</em>}</header>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}

function SectionHeader({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail?: string; action?: ReactNode }): JSX.Element {
  return (
    <header className="section-header">
      <div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2>{detail && <p>{detail}</p>}</div>
      {action && <div className="section-actions">{action}</div>}
    </header>
  );
}

function LifecycleStrip({ lifecycle, model, now, nextRefreshAt }: { lifecycle: DataLifecycle; model: IssueConsoleModel | null; now: number; nextRefreshAt: number | null }): JSX.Element {
  const phase = lifecycle.phase === 'ready' ? 'connected' : lifecycle.phase;
  const message = lifecycle.phase === 'loading'
    ? 'Loading and validating the latest generated payload.'
    : lifecycle.phase === 'error'
      ? `No validated operating model is available. ${lifecycle.failure}`
      : lifecycle.phase === 'stale'
        ? `Last validated data retained after refresh failure. ${lifecycle.failure}`
        : lifecycle.phase === 'refreshing'
          ? 'Checking status.json now. The previous validated model remains visible.'
          : `Browser model is current. Payload generated ${relativeAgeAt(model?.generatedAt, now)}.`;
  const nextCheck = lifecycle.phase === 'refreshing'
    ? 'in progress'
    : nextRefreshAt === null
      ? 'after the first validated load'
      : `in ${countdownLabel(nextRefreshAt, now)}`;
  return (
    <div className={`lifecycle-strip lifecycle-${phase}`} role="status" aria-live="polite">
      <span className="connection-indicator" />
      <b>{titleCase(phase)}</b>
      <span>{message}</span>
      <span className="lifecycle-spacer" />
      <small>Next browser check {nextCheck}</small>
    </div>
  );
}

function SortButton({ active, direction, children, onClick }: { active: boolean; direction: SortDirection; children: ReactNode; onClick: () => void }): JSX.Element {
  return <button type="button" className="table-sort" aria-pressed={active} onClick={onClick}>{children}<span>{active ? (direction === 'asc' ? '↑' : '↓') : '↕'}</span></button>;
}

function compareDiagnostics(a: DiagnosticSource, b: DiagnosticSource, key: ProviderSortKey): number {
  const serviceRank = { major: 4, degraded: 3, unknown: 2, operational: 1 } as const;
  const sourceRank = { blind: 3, watch: 2, healthy: 1 } as const;
  if (key === 'provider') return a.provider.localeCompare(b.provider);
  if (key === 'service') return serviceRank[a.serviceState] - serviceRank[b.serviceState];
  if (key === 'source') return sourceRank[a.sourceHealth] - sourceRank[b.sourceHealth];
  if (key === 'quality') return a.dataQualityScore - b.dataQualityScore;
  if (key === 'incidents') return a.activeIncidentCount - b.activeIncidentCount;
  if (key === 'latency') return a.sourceLatencyMs - b.sourceLatencyMs;
  return (a.freshnessSeconds ?? Number.MAX_SAFE_INTEGER) - (b.freshnessSeconds ?? Number.MAX_SAFE_INTEGER);
}

function ProviderTable({ items, now, onProvider, compact = false }: { items: DiagnosticSource[]; now: number; onProvider: (id: string) => void; compact?: boolean }): JSX.Element {
  const [sortKey, setSortKey] = useState<ProviderSortKey>(compact ? 'service' : 'provider');
  const [direction, setDirection] = useState<SortDirection>(compact ? 'desc' : 'asc');
  const sorted = useMemo(() => [...items].sort((a, b) => {
    const result = compareDiagnostics(a, b, sortKey);
    return direction === 'asc' ? result : -result;
  }), [items, sortKey, direction]);
  const chooseSort = (key: ProviderSortKey) => {
    if (sortKey === key) setDirection(current => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setDirection(['service', 'source', 'incidents'].includes(key) ? 'desc' : 'asc');
    }
  };
  const shown = compact ? sorted.slice(0, 12) : sorted;
  return (
    <div className="data-table provider-data-table" role="table" aria-label="Provider operations">
      <div className="data-table-head" role="row">
        <span role="columnheader"><SortButton active={sortKey === 'provider'} direction={direction} onClick={() => chooseSort('provider')}>Provider</SortButton></span>
        <span role="columnheader"><SortButton active={sortKey === 'service'} direction={direction} onClick={() => chooseSort('service')}>Service</SortButton></span>
        <span role="columnheader"><SortButton active={sortKey === 'source'} direction={direction} onClick={() => chooseSort('source')}>Source</SortButton></span>
        <span role="columnheader"><SortButton active={sortKey === 'incidents'} direction={direction} onClick={() => chooseSort('incidents')}>Events</SortButton></span>
        <span role="columnheader"><SortButton active={sortKey === 'quality'} direction={direction} onClick={() => chooseSort('quality')}>Quality</SortButton></span>
        <span role="columnheader"><SortButton active={sortKey === 'latency'} direction={direction} onClick={() => chooseSort('latency')}>Latency</SortButton></span>
        <span role="columnheader"><SortButton active={sortKey === 'freshness'} direction={direction} onClick={() => chooseSort('freshness')}>Observed</SortButton></span>
      </div>
      <div className="data-table-body">
        {shown.map(source => (
          <button type="button" className={`data-table-row service-${source.serviceState} source-${source.sourceHealth}`} role="row" key={source.id} onClick={() => onProvider(source.id)}>
            <span role="cell"><ProviderIdentity id={source.id} name={source.provider} category={source.category} compact /></span>
            <span role="cell"><StateBadge tone={serviceTone(source.serviceState)}>{titleCase(source.serviceState)}</StateBadge><small>{source.status}</small></span>
            <span role="cell"><StateBadge tone={sourceTone(source.sourceHealth)}>{titleCase(source.sourceHealth)}</StateBadge><small>{source.sourceHost || titleCase(source.sourceType)}</small></span>
            <span role="cell"><strong>{source.activeIncidentCount}</strong><small>{source.maintenanceCount} maintenance</small></span>
            <span role="cell"><strong>{source.dataQualityScore}</strong><small>{qualityLabel(source.dataQualityScore)}</small></span>
            <span role="cell"><strong>{durationLabel(source.sourceLatencyMs)}</strong><small>{source.collectionSuccessCount}/{source.collectionAttemptCount} requests</small></span>
            <span role="cell"><strong>{relativeAgeAt(source.lastSuccessAt || source.checkedAt, now)}</strong><small>{titleCase(source.freshnessState)}</small></span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AttentionTable({ items, now, onProvider }: { items: ActionItem[]; now: number; onProvider: (providerId: string) => void }): JSX.Element {
  if (!items.length) return <div className="empty-state"><b>No immediate operator actions</b><p>Readable official sources are not reporting active issues, and no critical source blind spots require escalation.</p></div>;
  return (
    <div className="attention-table">
      <div className="attention-head"><span>Priority</span><span>Provider and signal</span><span>Updated</span><span>Operator action</span><span /></div>
      {items.slice(0, 12).map((item, index) => (
        <article className={`attention-row attention-${item.attention}`} key={item.id}>
          <button type="button" className="priority-index" onClick={() => onProvider(item.providerId)}>{String(index + 1).padStart(2, '0')}</button>
          <div><span className="row-meta"><b>{item.provider}</b><em>{titleCase(item.kind)}</em></span><h3>{item.title}</h3><p>{item.detail}</p></div>
          <time>{relativeAgeAt(item.updatedAt, now)}</time>
          <p>{item.action}</p>
          <a href={item.source} target="_blank" rel="noopener noreferrer" aria-label={`Open official ${item.provider} source`}>↗</a>
        </article>
      ))}
    </div>
  );
}

function CategoryTable({ items, onCategory }: { items: CategoryPulse[]; onCategory: (category: string) => void }): JSX.Element {
  return (
    <div className="category-table">
      <div className="category-head"><span>Dependency group</span><span>Operational</span><span>Affected</span><span>Unknown</span><span>Blind</span><span>Quality</span></div>
      {items.slice(0, 12).map(item => {
        const percent = item.total ? Math.round(item.operational / item.total * 100) : 0;
        return (
          <button type="button" className="category-row" key={item.category} onClick={() => onCategory(item.category)}>
            <span><b>{item.category}</b><small>{item.total} providers</small></span>
            <span><strong>{percent}%</strong><i><em style={{ width: `${percent}%` }} /></i></span>
            <span>{item.affected}</span><span>{item.unknown}</span><span>{item.blind}</span><span>{item.averageQuality}</span>
          </button>
        );
      })}
    </div>
  );
}

function IncidentSummary({ item, now, expanded = false }: { item: IssueBrief; now: number; expanded?: boolean }): JSX.Element {
  const currentPageObservation = item.evidence_basis === 'current-page';
  const effectiveTime = effectiveIncidentTime(item);
  return (
    <article className={`incident-record incident-${item.service_state}`}>
      <header>
        <ProviderIdentity id={item.providerId} name={item.provider} category={item.category} compact />
        <div><StateBadge tone={item.service_state === 'major' ? 'critical' : 'warning'}>{item.label}</StateBadge><StateBadge tone="information">{item.evidenceLabel}</StateBadge></div>
      </header>
      <div className="incident-title"><span>{item.operatorPriority}</span><h3>{item.title}</h3><p>{item.note}</p></div>
      <dl className="record-facts">
        <div><dt>Affected service</dt><dd>{item.affectedServiceLabel}</dd></div>
        <div><dt>Lifecycle</dt><dd>{titleCase(item.status || 'active')}</dd></div>
        <div><dt>{currentPageObservation ? 'Observed' : 'First detected'}</dt><dd>{timeLabel(currentPageObservation ? item.observed_at : item.first_detected || item.rawTime, true)}</dd></div>
        <div><dt>{currentPageObservation ? 'Observation age' : 'Latest update'}</dt><dd>{relativeAgeAt(effectiveTime, now)}</dd></div>
      </dl>
      {expanded && <div className="incident-guidance"><section><span>Likely MSP impact</span><p>{item.mspImpact}</p></section><section><span>Technician action</span><p>{item.technicianAction}</p></section></div>}
      {expanded && item.updates?.length ? <details className="timeline-disclosure"><summary>Official vendor timeline <span>{item.updates.length} updates</span></summary><ol>{item.updates.map((update, index) => <li key={`${update.at || 'unknown'}-${index}`}><time>{timeLabel(update.at, true)}</time><div><b>{titleCase(update.status || 'Update')}</b><p>{update.note}</p></div></li>)}</ol></details> : null}
      {expanded && <details className="client-update"><summary>Client-safe update draft</summary><p>{item.clientDraft}</p><CopyButton value={item.clientDraft} label="Copy draft" /></details>}
      <footer><a href={item.url} target="_blank" rel="noopener noreferrer">Open official incident ↗</a></footer>
    </article>
  );
}

function MaintenanceSummary({ item, now }: { item: Maintenance; now: number }): JSX.Element {
  return (
    <article className="maintenance-record">
      <header><ProviderIdentity id={item.providerId} name={item.provider} category={item.category} compact /><StateBadge tone={item.status === 'in_progress' ? 'warning' : 'neutral'}>{titleCase(item.status)}</StateBadge></header>
      <h3>{item.title}</h3><p>{item.note}</p>
      <dl className="record-facts"><div><dt>Service</dt><dd>{item.affected_service || item.category}</dd></div><div><dt>Starts</dt><dd>{timeLabel(item.starts_at, true)}</dd></div><div><dt>Ends</dt><dd>{timeLabel(item.ends_at, true)}</dd></div><div><dt>Updated</dt><dd>{relativeAgeAt(item.latest_update || item.announced_at, now)}</dd></div></dl>
      <footer><a href={item.url} target="_blank" rel="noopener noreferrer">Open official maintenance ↗</a></footer>
    </article>
  );
}

function ProviderDrawer({ source, incidents, maintenance, now, onClose }: { source: DiagnosticSource; incidents: IssueBrief[]; maintenance: Maintenance[]; now: number; onClose: () => void }): JSX.Element {
  const problemComponents = source.componentStatus.filter(component => componentStatusIsProblem(component.status));
  return (
    <div className="drawer-layer" role="presentation">
      <button className="drawer-backdrop" type="button" onClick={onClose} aria-label="Close provider details" />
      <aside className="provider-drawer" aria-label={`${source.provider} provider details`}>
        <header className="drawer-header"><ProviderIdentity id={source.id} name={source.provider} category={source.category} /><button type="button" className="drawer-close" onClick={onClose} aria-label="Close">×</button></header>
        <section className="drawer-summary">
          <div><span>Service</span><StateBadge tone={serviceTone(source.serviceState)}>{titleCase(source.serviceState)}</StateBadge></div>
          <div><span>Source</span><StateBadge tone={sourceTone(source.sourceHealth)}>{titleCase(source.sourceHealth)}</StateBadge></div>
          <div><span>Quality</span><strong>{source.dataQualityScore}<small>/100</small></strong></div>
          <div><span>Observed</span><strong>{relativeAgeAt(source.lastSuccessAt || source.checkedAt, now)}</strong></div>
        </section>
        <div className="drawer-content">
          {source.message && <div className="drawer-alert">{source.message}</div>}
          <section><h3>Observation contract</h3><dl className="drawer-facts"><div><dt>Current conclusion</dt><dd>{source.status}</dd></div><div><dt>Truth basis</dt><dd>{titleCase(source.truthBasis)}</dd></div><div><dt>Evidence</dt><dd>{titleCase(source.evidenceTier)} · {source.sourceConfidence}</dd></div><div><dt>Official source</dt><dd>{source.sourceHost || 'Unknown host'}</dd></div><div><dt>Adapter</dt><dd>{titleCase(source.sourceType)}</dd></div><div><dt>Last successful retrieval</dt><dd>{timeLabel(source.lastSuccessAt)}</dd></div><div><dt>Freshness</dt><dd>{titleCase(source.freshnessState)}{source.freshnessSeconds !== undefined ? ` · ${Math.round(source.freshnessSeconds / 60)}m` : ''}</dd></div><div><dt>Request latency</dt><dd>{durationLabel(source.sourceLatencyMs)}</dd></div><div><dt>Failure streak</dt><dd>{source.consecutiveFailures}</dd></div><div><dt>Parser / schema</dt><dd>{source.parserVersion || 'legacy'} · {source.schemaChanged ? 'changed' : source.schemaFingerprint ? 'stable' : 'not fingerprinted'}</dd></div></dl></section>
          {incidents.length > 0 && <section><h3>Active incidents</h3><div className="drawer-list">{incidents.map(item => <IncidentSummary key={item.id} item={item} now={now} />)}</div></section>}
          {maintenance.length > 0 && <section><h3>Maintenance</h3><div className="drawer-list">{maintenance.map(item => <MaintenanceSummary key={item.id} item={item} now={now} />)}</div></section>}
          {source.componentStatus.length > 0 && <section><h3>Components <small>{problemComponents.length} requiring attention</small></h3><ul className="component-list">{source.componentStatus.map(component => {
            const disposition = componentStatusDisposition(component.status);
            const tone = disposition === 'healthy' ? 'positive' : disposition === 'problem' ? 'warning' : 'neutral';
            return <li key={`${component.group || ''}-${component.name}`}><span><b>{component.name}</b>{component.group && <small>{component.group}</small>}</span><StateBadge tone={tone}>{titleCase(component.status)}</StateBadge></li>;
          })}</ul></section>}
          <section><h3>Collection trace</h3><div className="trace-list">{source.downloadLog.slice(-8).reverse().map((log, index) => <article key={`${log.completed_at || index}-${index}`}><StateBadge tone={log.ok ? 'positive' : 'critical'}>{log.ok ? 'Success' : 'Failed'}</StateBadge><div><b>{log.status || 'Collection attempt'}</b><small>{durationLabel(log.duration_ms)} · {log.content_type || 'unknown content type'}</small>{(log.error || log.message) && <p>{log.error || log.message}</p>}</div></article>)}</div></section>
        </div>
        <footer className="drawer-footer"><a className="ui-button ui-button-primary" href={source.source} target="_blank" rel="noopener noreferrer">Open official source ↗</a></footer>
      </aside>
    </div>
  );
}

function OverviewView({ model, now, onProvider, onNavigate }: { model: IssueConsoleModel; now: number; onProvider: (id: string) => void; onNavigate: (view: ConsoleView, filter?: string) => void }): JSX.Element {
  const affected = model.summary.major_count + model.summary.degraded_count;
  const headline = model.summary.major_count
    ? `${model.summary.major_count} major provider issue${model.summary.major_count === 1 ? '' : 's'} ${model.summary.major_count === 1 ? 'requires' : 'require'} validation`
    : model.summary.degraded_count
      ? `${model.summary.degraded_count} provider degradation${model.summary.degraded_count === 1 ? '' : 's'} ${model.summary.degraded_count === 1 ? 'is' : 'are'} active`
      : model.blindSpotCount
        ? `No active incident is confirmed; ${model.blindSpotCount} source blind spot${model.blindSpotCount === 1 ? '' : 's'} ${model.blindSpotCount === 1 ? 'remains' : 'remain'}`
        : 'No active vendor incident is supported by readable official sources';
  return (
    <div className="workspace-stack">
      <section className="posture-panel">
        <div><span className="section-eyebrow">Current posture</span><h2>{headline}</h2><p>Service conclusions and collector reliability remain separate. Unknown data is never converted into healthy status.</p></div>
        <div className="posture-actions"><button className="ui-button ui-button-primary" type="button" onClick={() => onNavigate('incidents')}>Open incident operations</button><button className="ui-button ui-button-secondary" type="button" onClick={() => onNavigate('sources', 'blind-source')}>Review blind spots</button></div>
      </section>
      <section className="metric-strip">
        <MetricTile label="Active incidents" value={model.incidentCount} detail={`${model.affectedCount} providers affected`} tone={model.incidentCount ? 'critical' : 'positive'} live />
        <MetricTile label="Affected providers" value={affected} detail={`${model.summary.major_count} major · ${model.summary.degraded_count} degraded`} tone={affected ? 'warning' : 'positive'} live />
        <MetricTile label="Confirmed operational" value={model.summary.confirmed_operational_count} detail={`${model.summary.confirmed_operational_percent}% of catalog`} tone="positive" live />
        <MetricTile label="Live source coverage" value={`${model.summary.coverage_percent}%`} detail={`${model.healthySourceCount} healthy sources`} live />
        <MetricTile label="Collection quality" value={model.qualityScore} detail="weighted evidence score" tone={model.qualityScore < 75 ? 'warning' : 'positive'} live />
        <MetricTile label="Blind spots" value={model.blindSpotCount} detail={`${model.watchSourceCount} sources on watch`} tone={model.blindSpotCount ? 'critical' : 'positive'} live />
        <MetricTile label="Request success" value={`${model.collection?.request_success_percent ?? model.summary.request_success_percent ?? 0}%`} detail={`${model.collection?.failed_request_count ?? model.summary.failed_request_count ?? 0} failed attempts`} live />
        <MetricTile label="Collection p95" value={durationLabel(model.collection?.p95_request_ms ?? model.summary.p95_request_ms)} detail={model.collection?.run_id || 'legacy run'} live />
      </section>
      <section className="workspace-panel"><SectionHeader eyebrow="Operator queue" title="What deserves attention now" detail="Ranked by service impact, provider criticality, evidence quality, and source reliability." action={<button className="link-button" type="button" onClick={() => onNavigate('incidents')}>View incident operations</button>} /><AttentionTable items={model.actionQueue} now={now} onProvider={onProvider} /></section>
      <section className="workspace-panel"><SectionHeader eyebrow="Provider operations" title="Live dependency table" detail="Dynamic age, latency, quality, service, and source fields update without hiding uncertainty." action={<button className="link-button" type="button" onClick={() => onNavigate('providers')}>Open all providers</button>} /><ProviderTable items={model.diagnostics} now={now} onProvider={onProvider} compact /></section>
      <div className="workspace-split">
        <section className="workspace-panel"><SectionHeader eyebrow="Dependency landscape" title="Risk by service domain" detail="Confirmed operational coverage and unresolved exposure by category." /><CategoryTable items={model.categoryPulse} onCategory={category => onNavigate('providers', category)} /></section>
        <section className="workspace-panel"><SectionHeader eyebrow="Change window" title="Maintenance horizon" detail={`${model.ongoingMaintenanceCount} in progress · ${model.maintenanceCount} current`} />{model.maintenance.length ? <div className="maintenance-list">{model.maintenance.slice(0, 5).map(item => <MaintenanceSummary key={item.id} item={item} now={now} />)}</div> : <div className="empty-state"><b>No relevant maintenance windows</b><p>No current or upcoming maintenance was captured from supported official sources.</p></div>}</section>
      </div>
    </div>
  );
}

function IncidentsView({ model, now }: { model: IssueConsoleModel; now: number }): JSX.Element {
  return (
    <div className="workspace-stack">
      <section className="page-summary"><div><span className="section-eyebrow">Incident operations</span><h2>Vendor-reported service events</h2><p>Lifecycle, evidence, MSP impact, technician action, and client-safe language are visible in one workspace.</p></div><div className="summary-stat"><strong>{model.incidentCount}</strong><span>active incidents</span></div></section>
      <section className="workspace-panel"><SectionHeader title="Active incidents" detail={`${model.affectedCount} providers currently affected`} />{model.briefs.length ? <div className="incident-list">{model.briefs.map(item => <IncidentSummary key={item.id} item={item} now={now} expanded />)}</div> : <div className="empty-state empty-large"><b>No active incidents supported by readable official sources</b><p>This does not prove every provider is healthy. {model.blindSpotCount} blind sources and {model.watchSourceCount} watch sources remain explicit.</p></div>}</section>
      <section className="workspace-panel"><SectionHeader title="Maintenance intelligence" detail={`${model.ongoingMaintenanceCount} in progress · ${model.maintenanceCount} relevant windows`} />{model.maintenance.length ? <div className="maintenance-grid">{model.maintenance.map(item => <MaintenanceSummary key={item.id} item={item} now={now} />)}</div> : <div className="empty-state"><b>No relevant maintenance windows</b><p>No upcoming or in-progress maintenance was captured from supported official sources.</p></div>}</section>
    </div>
  );
}

function FilterBar({ query, filter, onQuery, onFilter, mode }: { query: string; filter: string; onQuery: (value: string) => void; onFilter: (value: string) => void; mode: 'providers' | 'sources' }): JSX.Element {
  return (
    <section className="filter-bar">
      <label><span>Search</span><input data-command-search type="search" value={query} onChange={event => onQuery(event.target.value)} placeholder={mode === 'providers' ? 'Provider, service, category, incident, source host…' : 'Provider, adapter, source host, parser…'} /></label>
      <label><span>{mode === 'providers' ? 'Operational focus' : 'Reliability focus'}</span><select value={filter} onChange={event => onFilter(event.target.value)}>{mode === 'providers' ? <><option value="all">All providers</option><option value="attention">Requires attention</option><option value="incident">Active incident</option><option value="operational">Confirmed operational</option><option value="unknown">Unknown service state</option><option value="maintenance">Has maintenance</option><option value="high">High criticality</option></> : <><option value="all">All sources</option><option value="blind-source">Blind sources</option><option value="watch-source">Watch sources</option><option value="healthy-source">Healthy sources</option><option value="structured">Structured evidence</option><option value="schema-change">Schema changes</option><option value="failure-streak">Repeated failures</option><option value="stale">Aging or stale</option></>}</select></label>
    </section>
  );
}

function ProvidersView({ model, now, query, filter, onQuery, onFilter, onProvider }: { model: IssueConsoleModel; now: number; query: string; filter: string; onQuery: (value: string) => void; onFilter: (value: string) => void; onProvider: (id: string) => void }): JSX.Element {
  const shown = filterDiagnostics(model.diagnostics, query, filter === 'all' ? [] : [filter]);
  return (
    <div className="workspace-stack"><section className="page-summary"><div><span className="section-eyebrow">Provider operations</span><h2>Every dependency in one live operating model</h2><p>Service status, source reliability, data quality, event count, latency, and observation age are directly comparable.</p></div><div className="summary-stat"><strong>{shown.length}</strong><span>of {model.diagnostics.length} providers</span></div></section><FilterBar query={query} filter={filter} onQuery={onQuery} onFilter={onFilter} mode="providers" />{shown.length ? <section className="workspace-panel table-panel"><ProviderTable items={shown} now={now} onProvider={onProvider} /></section> : <div className="empty-state empty-large"><b>No providers match the current filters</b><p>Clear the search or choose a broader operational focus.</p></div>}</div>
  );
}

function SourcesView({ model, now, query, filter, onQuery, onFilter, onProvider }: { model: IssueConsoleModel; now: number; query: string; filter: string; onQuery: (value: string) => void; onFilter: (value: string) => void; onProvider: (id: string) => void }): JSX.Element {
  const shown = filterDiagnostics(model.diagnostics, query, filter === 'all' ? [] : [filter]);
  const total = Math.max(1, model.diagnostics.length);
  return (
    <div className="workspace-stack">
      <section className="page-summary"><div><span className="section-eyebrow">Source reliability</span><h2>Collection quality and evidence control</h2><p>Transport success, source health, parser state, latency, and freshness are visible before any service conclusion is trusted.</p></div><div className="quality-score"><strong>{model.qualityScore}</strong><span>collection quality</span></div></section>
      <section className="metric-strip metric-strip-six"><MetricTile label="Collection duration" value={durationLabel(model.collection?.duration_ms)} detail={model.collection?.run_id || 'legacy run'} live /><MetricTile label="Official origins" value={model.collection?.origin_count ?? model.summary.origin_count ?? 0} detail={`${model.collection?.unique_source_count ?? model.diagnostics.length} unique sources`} live /><MetricTile label="Request success" value={`${model.collection?.request_success_percent ?? model.summary.request_success_percent ?? 0}%`} detail={`${model.collection?.failed_request_count ?? model.summary.failed_request_count ?? 0} failures`} live /><MetricTile label="Median / p95" value={`${durationLabel(model.collection?.median_request_ms)} / ${durationLabel(model.collection?.p95_request_ms)}`} detail="request latency" live /><MetricTile label="Healthy sources" value={model.healthySourceCount} detail={`${Math.round(model.healthySourceCount / total * 100)}% of catalog`} tone="positive" live /><MetricTile label="Blind spots" value={model.blindSpotCount} detail={`${model.watchSourceCount} watch sources`} tone={model.blindSpotCount ? 'critical' : 'positive'} live /></section>
      <section className="workspace-panel reliability-panel"><SectionHeader eyebrow="Trust distribution" title="Collector confidence envelope" detail="Provider count by current source-health classification." /><div className="reliability-bar"><span className="bar-healthy" style={{ width: `${model.healthySourceCount / total * 100}%` }} /><span className="bar-watch" style={{ width: `${model.watchSourceCount / total * 100}%` }} /><span className="bar-blind" style={{ width: `${model.blindSpotCount / total * 100}%` }} /></div><div className="reliability-legend"><span><i className="legend-healthy" />Healthy <b>{model.healthySourceCount}</b></span><span><i className="legend-watch" />Watch <b>{model.watchSourceCount}</b></span><span><i className="legend-blind" />Blind <b>{model.blindSpotCount}</b></span></div></section>
      <FilterBar query={query} filter={filter} onQuery={onQuery} onFilter={onFilter} mode="sources" />
      {shown.length ? <section className="workspace-panel table-panel"><ProviderTable items={shown} now={now} onProvider={onProvider} /></section> : <div className="empty-state empty-large"><b>No sources match the current filters</b><p>Clear the search or choose a broader reliability focus.</p></div>}
    </div>
  );
}

function TimelineView({ model, now, onProvider }: { model: IssueConsoleModel; now: number; onProvider: (id: string) => void }): JSX.Element {
  return (
    <div className="workspace-stack"><section className="page-summary"><div><span className="section-eyebrow">Audit timeline</span><h2>What changed, not only what exists</h2><p>Incident, source, schema, failure, and maintenance lifecycle events are retained as a bounded operational record.</p></div><div className="summary-stat"><strong>{model.history.length}</strong><span>retained changes</span></div></section><section className="workspace-panel timeline-table"><div className="timeline-head"><span>Detected</span><span>Provider</span><span>Change</span><span>Attention</span></div>{model.history.length ? model.history.map(change => <button type="button" key={change.id} className="timeline-row" onClick={() => onProvider(change.provider_id)}><span><b>{timeLabel(change.detected_at, true)}</b><small>{relativeAgeAt(change.detected_at, now)}</small></span><span><b>{change.provider}</b><small>{titleCase(change.type)}</small></span><span>{change.title}</span><span><StateBadge tone={change.attention === 'critical' ? 'critical' : change.attention === 'action' ? 'warning' : 'neutral'}>{titleCase(change.attention)}</StateBadge></span></button>) : <div className="empty-state empty-large"><b>No comparison history yet</b><p>The first valid generation is intentionally not treated as a mass change.</p></div>}</section></div>
  );
}

function Wallboard({ model, lifecycle, now, onExit }: { model: IssueConsoleModel | null; lifecycle: DataLifecycle; now: number; onExit: () => void }): JSX.Element {
  const providers = model?.diagnostics.filter(item => item.attention !== 'informational' || item.sourceHealth !== 'healthy').slice(0, 24) || [];
  return (
    <section className="wallboard-shell"><header><div><span>MSP service operations</span><h1>Enterprise service intelligence</h1></div><div className="wallboard-clock"><strong>{clockLabel(now)}</strong><span>{dateLabel(now)} · ET</span></div><div className="wallboard-connection"><span className={`connection-indicator lifecycle-${lifecycle.phase}`} /><b>{titleCase(lifecycle.phase)}</b><small>{relativeAgeAt(model?.generatedAt, now)}</small></div><button className="ui-button ui-button-secondary" type="button" onClick={onExit}>Exit wallboard</button></header><section className="wallboard-kpis"><MetricTile label="Active incidents" value={model?.incidentCount || 0} live /><MetricTile label="Affected providers" value={model?.affectedCount || 0} live /><MetricTile label="Coverage" value={`${model?.summary.coverage_percent || 0}%`} live /><MetricTile label="Quality" value={model?.qualityScore || 0} live /><MetricTile label="Blind spots" value={model?.blindSpotCount || 0} live /></section><main><section className="wallboard-priority"><h2>Priority signals</h2>{model?.actionQueue.length ? model.actionQueue.slice(0, 8).map((item, index) => <article key={item.id} className={`attention-${item.attention}`}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{item.provider}</b><h3>{item.title}</h3><p>{item.detail}</p></div><time>{relativeAgeAt(item.updatedAt, now)}</time></article>) : <div className="empty-state"><b>No immediate operator actions</b></div>}</section><section className="wallboard-providers"><h2>Provider watch</h2><div>{providers.map(source => <article key={source.id}><ProviderIcon id={source.id} name={source.provider} /><span><b>{source.provider}</b><small>{titleCase(source.serviceState)} · {titleCase(source.sourceHealth)}</small></span><strong>{source.dataQualityScore}</strong></article>)}</div></section></main><footer><span>{model?.version || 'loading'}</span><span>{model?.collection?.run_id || 'legacy run'}</span><span>First-party public sources · fail closed</span></footer></section>
  );
}

function Sidebar({ view, model, onNavigate }: { view: ConsoleView; model: IssueConsoleModel | null; onNavigate: (view: ConsoleView) => void }): JSX.Element {
  return (
    <aside className="app-sidebar">
      <header className="sidebar-brand"><span className="enterprise-mark">S</span><div><b>ServiceOps</b><small>MSP intelligence</small></div></header>
      <div className="sidebar-workspace"><span>Workspace</span><b>Operations</b><small>United States scope</small></div>
      <nav aria-label="Application navigation">
        <span className="nav-section-label">Monitor</span>
        {views.slice(0, 3).map(item => {
          const count = item === 'overview' ? model?.attentionCount : item === 'incidents' ? model?.incidentCount : model?.diagnostics.length;
          return <button key={item} type="button" aria-current={view === item ? 'page' : undefined} onClick={() => onNavigate(item)}><span className="nav-glyph">{item === 'overview' ? '◫' : item === 'incidents' ? '!' : '▦'}</span><span>{viewMeta[item].label}</span>{count !== undefined && <em>{count}</em>}</button>;
        })}
        <span className="nav-section-label">Analyze</span>
        {views.slice(3).map(item => {
          const count = item === 'sources' ? model?.blindSpotCount : model?.history.length;
          return <button key={item} type="button" aria-current={view === item ? 'page' : undefined} onClick={() => onNavigate(item)}><span className="nav-glyph">{item === 'sources' ? '⌁' : '↺'}</span><span>{viewMeta[item].label}</span>{count !== undefined && <em>{count}</em>}</button>;
        })}
      </nav>
      <footer><span>Evidence policy</span><b>First-party only</b><small>Unknown stays unknown. Collection failure never becomes green.</small></footer>
    </aside>
  );
}

export function IssueConsole({ model, lifecycle, onRefresh, browserCheckedAt, browserRefreshMs }: { model: IssueConsoleModel | null; lifecycle: DataLifecycle; onRefresh: () => void; browserCheckedAt: number | null; browserRefreshMs: number }): JSX.Element {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const initialView = params.get('view');
  const [view, setView] = useState<ConsoleView>(() => initialView === 'wallboard' ? 'wallboard' : views.includes(initialView as typeof views[number]) ? initialView as typeof views[number] : readStoredView() || 'overview');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const nextRefreshAt = browserCheckedAt === null ? null : browserCheckedAt + browserRefreshMs;

  const selectedSource = model?.diagnostics.find(item => item.id === selectedProviderId) || null;
  const selectedIncidents = model?.briefs.filter(item => item.providerId === selectedProviderId) || [];
  const selectedMaintenance = model?.maintenance.filter(item => item.providerId === selectedProviderId) || [];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const navigate = (next: ConsoleView, nextFilter?: string) => {
    setView(next);
    setQuery('');
    setFilter(nextFilter || 'all');
    if (next !== 'wallboard') storeView(next);
    const search = new URLSearchParams(location.search);
    if (next === 'overview') search.delete('view'); else search.set('view', next);
    history.replaceState(null, '', `${location.pathname}${search.size ? `?${search}` : ''}`);
  };

  const requestRefresh = () => {
    onRefresh();
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if (event.key === 'Escape') {
        if (selectedProviderId) setSelectedProviderId(null);
        else if (view === 'wallboard') navigate('overview');
        return;
      }
      if (typing) return;
      if (event.key === '/') { event.preventDefault(); navigate('providers'); window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-command-search]')?.focus(), 0); }
      if (event.key.toLowerCase() === 'r') requestRefresh();
      if (event.key.toLowerCase() === 'w') navigate('wallboard');
      const numeric = Number(event.key);
      if (numeric >= 1 && numeric <= views.length) navigate(views[numeric - 1]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedProviderId, view, onRefresh]);

  useEffect(() => {
    if (!selectedProviderId) return;
    if (!model?.diagnostics.some(item => item.id === selectedProviderId)) setSelectedProviderId(null);
  }, [model, selectedProviderId]);

  if (view === 'wallboard') return <Wallboard model={model} lifecycle={lifecycle} now={now} onExit={() => navigate('overview')} />;

  const currentView = view as typeof views[number];
  const browserCheckAge = browserCheckedAt === null ? 'Never' : relativeAgeAt(new Date(browserCheckedAt).toISOString(), now);
  const browserNext = nextRefreshAt === null ? 'Awaiting first validated check' : `Next in ${countdownLabel(nextRefreshAt, now)}`;
  return (
    <div className="enterprise-shell">
      <span className="sr-only">Operations command center. Technician briefing. Provider diagnostics and evidence. Current posture. What deserves attention now. Dependency landscape.</span>
      <Sidebar view={view} model={model} onNavigate={navigate} />
      <div className="app-workspace">
        <header className="workspace-topbar">
          <div className="topbar-title"><span>ServiceOps / {viewMeta[currentView].label}</span><h1>{viewMeta[currentView].label}</h1><p>{viewMeta[currentView].description}</p></div>
          <div className="topbar-live">
            <div><span>Eastern time</span><b>{clockLabel(now)}</b><small>{dateLabel(now)}</small></div>
            <div><span>Payload age</span><b>{relativeAgeAt(model?.generatedAt, now)}</b><small>{model ? timeLabel(model.generatedAt, true) : 'Awaiting data'}</small></div>
            <div><span>Last browser check</span><b>{browserCheckAge}</b><small>{browserNext}</small></div>
          </div>
          <div className="topbar-actions"><button className="ui-button ui-button-secondary" type="button" onClick={() => navigate('wallboard')}>Wallboard</button><button className="ui-button ui-button-primary" type="button" onClick={requestRefresh} disabled={lifecycle.phase === 'refreshing'}>{lifecycle.phase === 'refreshing' ? 'Checking…' : 'Refresh now'}</button></div>
        </header>
        <LifecycleStrip lifecycle={lifecycle} model={model} now={now} nextRefreshAt={nextRefreshAt} />
        <main className="workspace-main">
          {model ? <>{view === 'overview' && <OverviewView model={model} now={now} onProvider={setSelectedProviderId} onNavigate={navigate} />}{view === 'incidents' && <IncidentsView model={model} now={now} />}{view === 'providers' && <ProvidersView model={model} now={now} query={query} filter={filter} onQuery={setQuery} onFilter={setFilter} onProvider={setSelectedProviderId} />}{view === 'sources' && <SourcesView model={model} now={now} query={query} filter={filter} onQuery={setQuery} onFilter={setFilter} onProvider={setSelectedProviderId} />}{view === 'timeline' && <TimelineView model={model} now={now} onProvider={setSelectedProviderId} />}</> : <section className="unavailable-state"><span className="enterprise-mark enterprise-mark-large">S</span><h2>Status intelligence unavailable</h2><p>No provider is presented as operational until a complete payload passes browser validation.</p><button className="ui-button ui-button-primary" type="button" onClick={requestRefresh}>Retry validated load</button></section>}
        </main>
        <footer className="workspace-footer"><span><b>{model?.version || 'loading'}</b> · {model?.collection?.run_id || 'legacy payload'}</span><span>Generated {timeLabel(model?.generatedAt)}</span><span>First-party public sources · fail closed</span></footer>
      </div>
      {selectedSource && <ProviderDrawer source={selectedSource} incidents={selectedIncidents} maintenance={selectedMaintenance} now={now} onClose={() => setSelectedProviderId(null)} />}
    </div>
  );
}