import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ProviderIcon } from './providerIcon';
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
    hour12: true,
    timeZoneName: compact ? undefined : 'short'
  }).format(new Date(value as string));
}

function relativeAge(value?: string): string {
  const timestamp = parseTime(value);
  if (!timestamp) return 'unknown age';
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function durationLabel(milliseconds?: number): string {
  const value = Number(milliseconds || 0);
  if (value < 1000) return `${Math.max(0, Math.round(value))} ms`;
  if (value < 60000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} s`;
  return `${Math.round(value / 60000)} min`;
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

function StateBadge({ tone, children }: { tone: string; children: React.ReactNode }): JSX.Element {
  return <span className={`state-badge tone-${tone}`}>{children}</span>;
}

function ProviderIdentity({ id, name, category, compact = false }: { id: string; name: string; category?: string; compact?: boolean }): JSX.Element {
  return (
    <div className={`provider-identity ${compact ? 'compact' : ''}`}>
      <ProviderIcon id={id} name={name} />
      <span><b>{name}</b>{category && <small>{category}</small>}</span>
    </div>
  );
}

function QualityGauge({ score, label = 'Data quality' }: { score: number; label?: string }): JSX.Element {
  const style = { '--quality-angle': `${Math.max(0, Math.min(100, score)) * 3.6}deg` } as CSSProperties;
  return (
    <div className="quality-gauge" style={style} aria-label={`${label}: ${score} percent`}>
      <div><b>{score}</b><span>/100</span></div>
      <small>{label}</small>
    </div>
  );
}

function CopyButton({ value, label = 'Copy update' }: { value: string; label?: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <button className="button secondary compact-button" type="button" onClick={async () => {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }}>
      {copied ? 'Copied' : label}
    </button>
  );
}

function MetricCard({ label, value, detail, tone = 'default' }: { label: string; value: string | number; detail?: string; tone?: string }): JSX.Element {
  return (
    <article className={`metric-card metric-${tone}`}>
      <span>{label}</span>
      <b>{value}</b>
      {detail && <small>{detail}</small>}
    </article>
  );
}

function LifecycleBanner({ lifecycle, generatedAt }: { lifecycle: DataLifecycle; generatedAt?: string }): JSX.Element {
  const copy = lifecycle.phase === 'loading'
    ? 'Loading and validating the latest first-party observations.'
    : lifecycle.phase === 'error'
      ? `No valid operational model is available. ${lifecycle.failure}`
      : lifecycle.phase === 'stale'
        ? `The last valid model is retained after a refresh failure. ${lifecycle.failure}`
        : lifecycle.phase === 'refreshing'
          ? 'Refreshing in the background; the last validated model remains visible.'
          : `Validated payload generated ${relativeAge(generatedAt)}. The browser checks every minute.`;
  return <div className={`lifecycle-banner phase-${lifecycle.phase}`} role="status" aria-live="polite"><span className="pulse-dot" />{copy}</div>;
}

function IncidentTimeline({ item }: { item: IssueBrief }): JSX.Element | null {
  if (!item.updates?.length) return null;
  return (
    <details className="event-timeline">
      <summary>Vendor timeline <span>{item.updates.length} updates</span></summary>
      <ol>
        {item.updates.map((update, index) => (
          <li key={`${update.at || 'unknown'}-${index}`}>
            <time>{timeLabel(update.at, true)}</time>
            <div><b>{titleCase(update.status || 'Update')}</b><p>{update.note}</p></div>
          </li>
        ))}
      </ol>
    </details>
  );
}

function IncidentCard({ item, compact = false }: { item: IssueBrief; compact?: boolean }): JSX.Element {
  return (
    <article className={`incident-card incident-${item.service_state} ${compact ? 'compact-card' : ''}`}>
      <header>
        <ProviderIdentity id={item.providerId} name={item.provider} category={item.category} compact />
        <div className="badge-row">
          <StateBadge tone={item.service_state === 'major' ? 'critical' : 'warning'}>{item.label}</StateBadge>
          <StateBadge tone="evidence">{item.evidenceLabel}</StateBadge>
        </div>
      </header>
      <div className="incident-copy">
        <p className="priority-label">{item.operatorPriority}</p>
        <h3>{item.title}</h3>
        <p>{item.note}</p>
      </div>
      <dl className="fact-grid">
        <div><dt>Affected service</dt><dd>{item.affectedServiceLabel}</dd></div>
        <div><dt>Stage</dt><dd>{titleCase(item.status || 'active')}</dd></div>
        <div><dt>First detected</dt><dd>{timeLabel(item.first_detected || item.rawTime)}</dd></div>
        <div><dt>Latest update</dt><dd>{timeLabel(item.latest_update || item.rawTime)} · {relativeAge(item.latest_update || item.rawTime)}</dd></div>
      </dl>
      {!compact && (
        <>
          <div className="operator-guidance">
            <div><span>Likely MSP impact</span><p>{item.mspImpact}</p></div>
            <div><span>Technician move</span><p>{item.technicianAction}</p></div>
          </div>
          <IncidentTimeline item={item} />
          <details className="client-draft"><summary>Client-safe update draft</summary><p>{item.clientDraft}</p><CopyButton value={item.clientDraft} label="Copy draft" /></details>
        </>
      )}
      <footer><a href={item.url} target="_blank" rel="noopener noreferrer">Open official incident ↗</a></footer>
    </article>
  );
}

function MaintenanceCard({ item, compact = false }: { item: Maintenance; compact?: boolean }): JSX.Element {
  return (
    <article className={`maintenance-card maintenance-${item.status} ${compact ? 'compact-card' : ''}`}>
      <header>
        <ProviderIdentity id={item.providerId} name={item.provider} category={item.category} compact />
        <StateBadge tone={item.status === 'in_progress' ? 'warning' : 'neutral'}>{titleCase(item.status)}</StateBadge>
      </header>
      <h3>{item.title}</h3>
      <p>{item.note}</p>
      <dl className="fact-grid">
        <div><dt>Service</dt><dd>{item.affected_service || item.category}</dd></div>
        <div><dt>Starts</dt><dd>{timeLabel(item.starts_at)}</dd></div>
        <div><dt>Ends</dt><dd>{timeLabel(item.ends_at)}</dd></div>
        <div><dt>Updated</dt><dd>{timeLabel(item.latest_update || item.announced_at)}</dd></div>
      </dl>
      {!compact && item.updates?.length ? (
        <details className="event-timeline"><summary>Maintenance timeline <span>{item.updates.length} updates</span></summary><ol>{item.updates.map((update, index) => <li key={`${update.at || 'unknown'}-${index}`}><time>{timeLabel(update.at, true)}</time><div><b>{titleCase(update.status || 'Update')}</b><p>{update.note}</p></div></li>)}</ol></details>
      ) : null}
      <footer><a href={item.url} target="_blank" rel="noopener noreferrer">Open official maintenance ↗</a></footer>
    </article>
  );
}

function ActionQueue({ items, onProvider }: { items: ActionItem[]; onProvider: (providerId: string) => void }): JSX.Element {
  return (
    <section className="panel action-panel">
      <header className="panel-heading"><div><p className="section-kicker">Operator queue</p><h2>What deserves attention now</h2></div><span>{items.length} signals</span></header>
      {items.length ? <div className="action-list">{items.slice(0, 12).map((item, index) => (
        <article className={`action-row action-${item.kind} attention-${item.attention}`} key={item.id}>
          <button type="button" className="action-rank" onClick={() => onProvider(item.providerId)} aria-label={`Open ${item.provider} intelligence`}>{String(index + 1).padStart(2, '0')}</button>
          <div className="action-main"><div className="action-meta"><b>{item.provider}</b><span>{titleCase(item.kind)}</span><time>{relativeAge(item.updatedAt)}</time></div><h3>{item.title}</h3><p>{item.detail}</p><details><summary>Recommended action</summary><p>{item.action}</p></details></div>
          <a href={item.source} target="_blank" rel="noopener noreferrer" aria-label={`Open official ${item.provider} source`}>↗</a>
        </article>
      ))}</div> : <div className="empty-state"><b>No immediate operator actions</b><p>Readable official sources are not reporting active issues, and no critical collection blind spots require escalation.</p></div>}
    </section>
  );
}

function CategoryLandscape({ items, onCategory }: { items: CategoryPulse[]; onCategory: (category: string) => void }): JSX.Element {
  return (
    <section className="panel landscape-panel">
      <header className="panel-heading"><div><p className="section-kicker">Dependency landscape</p><h2>Where risk is concentrated</h2></div></header>
      <div className="landscape-list">
        {items.slice(0, 12).map(item => {
          const confirmedPercent = item.total ? Math.round(item.operational / item.total * 100) : 0;
          return (
            <button type="button" className="landscape-row" key={item.category} onClick={() => onCategory(item.category)}>
              <span><b>{item.category}</b><small>{item.total} providers · quality {item.averageQuality}</small></span>
              <span className="landscape-bar" aria-label={`${confirmedPercent}% confirmed operational`}><i style={{ width: `${confirmedPercent}%` }} /></span>
              <span className="landscape-counts"><em>{item.affected} affected</em><em>{item.unknown} unknown</em><em>{item.blind} blind</em></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ProviderCard({ source, onOpen }: { source: DiagnosticSource; onOpen: () => void }): JSX.Element {
  return (
    <button type="button" className={`provider-card service-${source.serviceState} source-${source.sourceHealth}`} onClick={onOpen}>
      <header><ProviderIdentity id={source.id} name={source.provider} category={source.category} compact /><span className="quality-number">{source.dataQualityScore}</span></header>
      <div className="provider-state-line"><StateBadge tone={serviceTone(source.serviceState)}>{titleCase(source.serviceState)}</StateBadge><StateBadge tone={source.sourceHealth}>{titleCase(source.sourceHealth)} source</StateBadge></div>
      <p>{source.status}</p>
      <footer><span>{source.activeIncidentCount} incidents</span><span>{source.maintenanceCount} maintenance</span><span>{source.problemComponentCount} components</span></footer>
    </button>
  );
}

function ProviderDrawer({ source, incidents, maintenance, onClose }: { source: DiagnosticSource; incidents: IssueBrief[]; maintenance: Maintenance[]; onClose: () => void }): JSX.Element {
  const problemComponents = source.componentStatus.filter(component => !/^(?:operational|available|up|ok|none|good)$/i.test(component.status));
  return (
    <div className="drawer-layer" role="presentation">
      <button className="drawer-backdrop" type="button" onClick={onClose} aria-label="Close provider intelligence" />
      <aside className="provider-drawer" aria-label={`${source.provider} intelligence`}>
        <header className="drawer-header"><ProviderIdentity id={source.id} name={source.provider} category={source.category} /><button type="button" className="icon-button" onClick={onClose} aria-label="Close">×</button></header>
        <div className="drawer-score"><QualityGauge score={source.dataQualityScore} /><div><StateBadge tone={serviceTone(source.serviceState)}>{titleCase(source.serviceState)}</StateBadge><StateBadge tone={source.sourceHealth}>{titleCase(source.sourceHealth)} source</StateBadge><p>{source.status}</p></div></div>
        {source.message && <div className="drawer-notice">{source.message}</div>}
        <section><h3>Observation contract</h3><dl className="drawer-facts"><div><dt>Truth basis</dt><dd>{titleCase(source.truthBasis)}</dd></div><div><dt>Evidence</dt><dd>{titleCase(source.evidenceTier)} · {source.sourceConfidence}</dd></div><div><dt>Adapter</dt><dd>{titleCase(source.sourceType)}</dd></div><div><dt>Source host</dt><dd>{source.sourceHost || 'unknown'}</dd></div><div><dt>Last success</dt><dd>{timeLabel(source.lastSuccessAt)}</dd></div><div><dt>Freshness</dt><dd>{titleCase(source.freshnessState)}{source.freshnessSeconds !== undefined ? ` · ${Math.round(source.freshnessSeconds / 60)}m` : ''}</dd></div><div><dt>Request latency</dt><dd>{durationLabel(source.sourceLatencyMs)}</dd></div><div><dt>Failure streak</dt><dd>{source.consecutiveFailures}</dd></div><div><dt>Parser</dt><dd>{source.parserVersion || 'legacy'}</dd></div><div><dt>Schema</dt><dd>{source.schemaChanged ? 'Changed this run' : source.schemaFingerprint ? 'Fingerprint stable' : 'Not fingerprinted'}</dd></div></dl></section>
        {incidents.length > 0 && <section><h3>Active incidents</h3><div className="drawer-event-list">{incidents.map(item => <IncidentCard key={item.id} item={item} compact />)}</div></section>}
        {maintenance.length > 0 && <section><h3>Current maintenance</h3><div className="drawer-event-list">{maintenance.map(item => <MaintenanceCard key={item.id} item={item} compact />)}</div></section>}
        {source.componentStatus.length > 0 && <section><h3>Components <span>{problemComponents.length} requiring attention</span></h3><ul className="component-list">{source.componentStatus.map(component => <li key={`${component.group || ''}-${component.name}`}><span><b>{component.name}</b>{component.group && <small>{component.group}</small>}</span><StateBadge tone={/^(?:operational|available|up|ok|none|good)$/i.test(component.status) ? 'positive' : 'warning'}>{titleCase(component.status)}</StateBadge></li>)}</ul></section>}
        <section><h3>Collection trace</h3><div className="trace-list">{source.downloadLog.slice(-6).reverse().map((log, index) => <div key={`${log.completed_at || index}-${index}`}><span className={log.ok ? 'trace-success' : 'trace-failure'}>{log.ok ? 'OK' : 'FAIL'}</span><p><b>{log.status || 'attempt'}</b><small>{durationLabel(log.duration_ms)} · {log.content_type || 'unknown content type'}</small><small>{log.error || log.message}</small></p></div>)}</div></section>
        <footer className="drawer-footer"><a className="button primary" href={source.source} target="_blank" rel="noopener noreferrer">Open official source ↗</a></footer>
      </aside>
    </div>
  );
}

function OverviewView({ model, onProvider, onNavigate }: { model: IssueConsoleModel; onProvider: (id: string) => void; onNavigate: (view: ConsoleView, filter?: string) => void }): JSX.Element {
  const major = model.summary.major_count;
  const degraded = model.summary.degraded_count;
  const postureTitle = major
    ? `${major} major provider incident${major === 1 ? '' : 's'} require immediate validation`
    : degraded
      ? `${degraded} provider degradation${degraded === 1 ? '' : 's'} are active`
      : model.blindSpotCount
        ? `No active vendor incidents; ${model.blindSpotCount} collection blind spot${model.blindSpotCount === 1 ? '' : 's'} remain`
        : 'No active incidents across readable official sources';
  const postureDetail = major || degraded
    ? 'Prioritize symptom correlation, affected-client identification, and vendor timeline monitoring. Source confidence remains visible beside each conclusion.'
    : 'Operational confirmation is limited to readable first-party sources. Unknown and limited sources remain explicitly separated from healthy services.';
  return (
    <div className="view-stack">
      <section className={`posture-hero ${major ? 'posture-critical' : degraded ? 'posture-warning' : 'posture-calm'}`}>
        <div className="posture-copy"><p className="section-kicker">Current posture</p><h2>{postureTitle}</h2><p>{postureDetail}</p><div className="posture-actions"><button className="button primary" type="button" onClick={() => onNavigate('incidents')}>Review active events</button><button className="button secondary" type="button" onClick={() => onNavigate('sources', 'blind-source')}>Inspect blind spots</button></div></div>
        <QualityGauge score={model.qualityScore} label="Collection quality" />
      </section>
      <section className="metric-grid">
        <MetricCard label="Immediate attention" value={model.attentionCount} detail="critical and action signals" tone={model.attentionCount ? 'critical' : 'positive'} />
        <MetricCard label="Active incidents" value={model.incidentCount} detail={`${model.affectedCount} providers affected`} tone={model.incidentCount ? 'warning' : 'positive'} />
        <MetricCard label="Live source coverage" value={`${model.summary.coverage_percent}%`} detail={`${model.summary.confirmed_operational_count} explicitly operational`} />
        <MetricCard label="Source blind spots" value={model.blindSpotCount} detail={`${model.watchSourceCount} additional watch sources`} tone={model.blindSpotCount ? 'warning' : 'positive'} />
        <MetricCard label="Maintenance" value={model.maintenanceCount} detail={`${model.ongoingMaintenanceCount} currently in progress`} />
        <MetricCard label="Component issues" value={model.componentIssueCount} detail={`${model.schemaChangeCount} source shape changes`} tone={model.componentIssueCount ? 'warning' : 'default'} />
      </section>
      <div className="overview-columns"><ActionQueue items={model.actionQueue} onProvider={onProvider} /><CategoryLandscape items={model.categoryPulse} onCategory={category => onNavigate('providers', category)} /></div>
      {model.briefs.length > 0 && <section className="panel featured-events"><header className="panel-heading"><div><p className="section-kicker">Vendor-reported issues</p><h2>Active incident intelligence</h2></div><button className="text-button" type="button" onClick={() => onNavigate('incidents')}>See all incidents →</button></header><div className="featured-grid">{model.briefs.slice(0, 3).map(item => <IncidentCard key={item.id} item={item} compact />)}</div></section>}
      {model.maintenance.length > 0 && <section className="panel featured-events"><header className="panel-heading"><div><p className="section-kicker">Change horizon</p><h2>Upcoming and in-progress maintenance</h2></div><button className="text-button" type="button" onClick={() => onNavigate('incidents')}>Open maintenance →</button></header><div className="featured-grid">{model.maintenance.slice(0, 3).map(item => <MaintenanceCard key={item.id} item={item} compact />)}</div></section>}
    </div>
  );
}

function IncidentsView({ model }: { model: IssueConsoleModel }): JSX.Element {
  return (
    <div className="view-stack">
      <section className="view-heading"><div><p className="section-kicker">Incident room</p><h2>Vendor-reported service events</h2><p>Incident lifecycle, evidence quality, MSP impact, technician action, and client-safe language in one place.</p></div><div className="heading-count"><b>{model.incidentCount}</b><span>active incidents</span></div></section>
      <section className="event-section"><header><h3>Active incidents</h3><span>{model.affectedCount} providers affected</span></header>{model.briefs.length ? <div className="incident-stack">{model.briefs.map(item => <IncidentCard key={item.id} item={item} />)}</div> : <div className="empty-state large"><b>No active incidents supported by readable official sources</b><p>This does not prove every provider is healthy. {model.blindSpotCount} source blind spots and {model.watchSourceCount} watch sources remain visible in Source integrity.</p></div>}</section>
      <section className="event-section"><header><h3>Maintenance intelligence</h3><span>{model.ongoingMaintenanceCount} in progress · {model.maintenanceCount} current</span></header>{model.maintenance.length ? <div className="maintenance-grid">{model.maintenance.map(item => <MaintenanceCard key={item.id} item={item} />)}</div> : <div className="empty-state"><b>No relevant maintenance windows</b><p>No upcoming or in-progress maintenance was captured from supported official sources.</p></div>}</section>
    </div>
  );
}

function ProvidersView({ model, query, filter, onQuery, onFilter, onProvider }: { model: IssueConsoleModel; query: string; filter: string; onQuery: (value: string) => void; onFilter: (value: string) => void; onProvider: (id: string) => void }): JSX.Element {
  const filters = filter === 'all' ? [] : [filter];
  const shown = filterDiagnostics(model.diagnostics, query, filters);
  return (
    <div className="view-stack">
      <section className="view-heading"><div><p className="section-kicker">Provider intelligence</p><h2>Every dependency, one operational model</h2><p>Service state and source health are deliberately separate. Open a provider for its evidence contract, collection trace, incidents, maintenance, and components.</p></div><div className="heading-count"><b>{shown.length}</b><span>of {model.diagnostics.length}</span></div></section>
      <section className="provider-toolbar panel"><label className="search-field"><span>Search providers, services, incidents, or source hosts</span><input data-command-search type="search" value={query} onChange={event => onQuery(event.target.value)} placeholder="Try identity, backup, Microsoft, latency…" /></label><label><span>Focus</span><select value={filter} onChange={event => onFilter(event.target.value)}><option value="all">All providers</option><option value="attention">Requires attention</option><option value="incident">Active incident</option><option value="blind-source">Blind source</option><option value="watch-source">Watch source</option><option value="healthy-source">Healthy source</option><option value="maintenance">Has maintenance</option><option value="schema-change">Schema changed</option><option value="failure-streak">Repeated failures</option><option value="structured">Structured evidence</option><option value="operational">Confirmed operational</option><option value="unknown">Unknown service state</option><option value="high">High criticality</option></select></label></section>
      {shown.length ? <section className="provider-grid">{shown.map(source => <ProviderCard key={source.id} source={source} onOpen={() => onProvider(source.id)} />)}</section> : <div className="empty-state large"><b>No providers match this view</b><p>Clear the search or choose a broader focus.</p></div>}
    </div>
  );
}

function SourceIntegrityView({ model, query, filter, onQuery, onFilter, onProvider }: { model: IssueConsoleModel; query: string; filter: string; onQuery: (value: string) => void; onFilter: (value: string) => void; onProvider: (id: string) => void }): JSX.Element {
  const collection = model.collection;
  const defaultFilter = filter === 'all' ? [] : [filter];
  const shown = filterDiagnostics(model.diagnostics, query, defaultFilter).sort((a, b) => a.dataQualityScore - b.dataQualityScore || b.priority - a.priority);
  const total = Math.max(1, model.diagnostics.length);
  return (
    <div className="view-stack">
      <section className="view-heading"><div><p className="section-kicker">Source integrity</p><h2>Know exactly what the collector can prove</h2><p>First-party evidence quality, freshness, parser reliability, origin pressure, and blind spots are visible before any service conclusion is trusted.</p></div><QualityGauge score={model.qualityScore} /></section>
      <section className="metric-grid source-metrics"><MetricCard label="Collection duration" value={durationLabel(collection?.duration_ms)} detail={collection?.run_id || 'legacy run'} /><MetricCard label="Official origins" value={collection?.origin_count ?? model.summary.origin_count ?? 0} detail={`${collection?.unique_source_count ?? model.diagnostics.length} unique sources`} /><MetricCard label="Request success" value={`${collection?.request_success_percent ?? model.summary.request_success_percent ?? 0}%`} detail={`${collection?.failed_request_count ?? model.summary.failed_request_count ?? 0} failed attempts`} tone={(collection?.failed_request_count || 0) ? 'warning' : 'positive'} /><MetricCard label="Median / p95" value={`${durationLabel(collection?.median_request_ms)} / ${durationLabel(collection?.p95_request_ms)}`} detail="bounded first-party retrieval" /><MetricCard label="Healthy sources" value={model.healthySourceCount} detail={`${Math.round(model.healthySourceCount / total * 100)}% of catalog`} tone="positive" /><MetricCard label="Blind spots" value={model.blindSpotCount} detail={`${model.watchSourceCount} watch sources`} tone={model.blindSpotCount ? 'critical' : 'positive'} /></section>
      <section className="panel trust-distribution"><header className="panel-heading"><div><p className="section-kicker">Trust distribution</p><h2>Collector confidence envelope</h2></div></header><div className="distribution-bar"><span className="distribution-healthy" style={{ width: `${model.healthySourceCount / total * 100}%` }} /><span className="distribution-watch" style={{ width: `${model.watchSourceCount / total * 100}%` }} /><span className="distribution-blind" style={{ width: `${model.blindSpotCount / total * 100}%` }} /></div><div className="distribution-legend"><span><i className="legend-healthy" />Healthy {model.healthySourceCount}</span><span><i className="legend-watch" />Watch {model.watchSourceCount}</span><span><i className="legend-blind" />Blind {model.blindSpotCount}</span></div></section>
      <section className="provider-toolbar panel"><label className="search-field"><span>Search source evidence</span><input data-command-search type="search" value={query} onChange={event => onQuery(event.target.value)} placeholder="Provider, adapter, host, service…" /></label><label><span>Source focus</span><select value={filter} onChange={event => onFilter(event.target.value)}><option value="all">All sources</option><option value="blind-source">Blind spots first</option><option value="watch-source">Watch sources</option><option value="healthy-source">Healthy sources</option><option value="structured">Structured evidence</option><option value="schema-change">Schema changes</option><option value="failure-streak">Repeated failures</option><option value="stale">Aging or stale</option></select></label></section>
      <section className="source-table panel"><header className="source-table-header"><span>Provider</span><span>Service</span><span>Source</span><span>Quality</span><span>Freshness</span><span>Collection</span></header>{shown.map(source => <button type="button" className="source-table-row" key={source.id} onClick={() => onProvider(source.id)}><ProviderIdentity id={source.id} name={source.provider} category={source.sourceHost} compact /><StateBadge tone={serviceTone(source.serviceState)}>{titleCase(source.serviceState)}</StateBadge><span><StateBadge tone={source.sourceHealth}>{titleCase(source.sourceHealth)}</StateBadge><small>{titleCase(source.evidenceTier)} · {source.sourceConfidence}</small></span><strong>{source.dataQualityScore}<small>{qualityLabel(source.dataQualityScore)}</small></strong><span>{titleCase(source.freshnessState)}<small>{source.lastSuccessAt ? relativeAge(source.lastSuccessAt) : 'no success recorded'}</small></span><span>{durationLabel(source.sourceLatencyMs)}<small>{source.collectionSuccessCount}/{source.collectionAttemptCount} successful</small></span></button>)}</section>
    </div>
  );
}

function TimelineView({ model, onProvider }: { model: IssueConsoleModel; onProvider: (id: string) => void }): JSX.Element {
  return (
    <div className="view-stack">
      <section className="view-heading"><div><p className="section-kicker">Operational timeline</p><h2>What changed, not just what exists</h2><p>Incident lifecycle, source recovery, parser drift, maintenance transitions, and collection failures are retained as a bounded audit trail.</p></div><div className="heading-count"><b>{model.history.length}</b><span>retained changes</span></div></section>
      <section className="timeline-panel panel">{model.history.length ? <ol>{model.history.map(change => <li key={change.id}><time><b>{timeLabel(change.detected_at, true)}</b><span>{relativeAge(change.detected_at)}</span></time><span className={`timeline-marker attention-${change.attention}`} /><button type="button" onClick={() => onProvider(change.provider_id)}><span>{titleCase(change.type)}</span><h3>{change.provider}</h3><p>{change.title}</p></button></li>)}</ol> : <div className="empty-state large"><b>No comparison history yet</b><p>The first valid generation is intentionally not treated as a mass change.</p></div>}</section>
    </div>
  );
}

function Wallboard({ model, lifecycle, onExit }: { model: IssueConsoleModel | null; lifecycle: DataLifecycle; onExit: () => void }): JSX.Element {
  const signals = model?.actionQueue.slice(0, 6) || [];
  const providers = model?.diagnostics.filter(item => item.attention !== 'informational' || item.sourceHealth !== 'healthy').slice(0, 24) || [];
  return (
    <section className="wallboard-shell">
      <header className="wallboard-header"><div><p>MSP operations command center</p><h1>Service intelligence wallboard</h1></div><div className="wallboard-status"><span className={`pulse-dot phase-${lifecycle.phase}`} /><b>{lifecycle.phase}</b><small>{timeLabel(model?.generatedAt, true)}</small></div><button className="button secondary" type="button" onClick={onExit}>Exit wallboard</button></header>
      <section className="wallboard-metrics"><MetricCard label="Immediate attention" value={model?.attentionCount || 0} /><MetricCard label="Active incidents" value={model?.incidentCount || 0} /><MetricCard label="Coverage" value={`${model?.summary.coverage_percent || 0}%`} /><MetricCard label="Quality" value={model?.qualityScore || 0} /><MetricCard label="Blind spots" value={model?.blindSpotCount || 0} /></section>
      <main className="wallboard-body">
        <section className="wallboard-signals"><header><h2>Priority signals</h2><span>{signals.length}</span></header>{signals.length ? signals.map((item, index) => <article key={item.id} className={`attention-${item.attention}`}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{item.provider}</b><h3>{item.title}</h3><p>{item.detail}</p></div><time>{relativeAge(item.updatedAt)}</time></article>) : <div className="wallboard-clear"><b>No immediate operator actions</b><p>Readable official sources are not reporting active issues.</p></div>}</section>
        <section className="wallboard-provider-grid"><header><h2>Provider watch surface</h2><span>{providers.length}</span></header><div>{providers.map(source => <article key={source.id} className={`service-${source.serviceState} source-${source.sourceHealth}`}><ProviderIcon id={source.id} name={source.provider} /><span><b>{source.provider}</b><small>{titleCase(source.serviceState)} · {titleCase(source.sourceHealth)}</small></span><strong>{source.dataQualityScore}</strong></article>)}</div></section>
      </main>
      <footer className="wallboard-footer"><span>{model?.version}</span><span>{model?.collection?.run_id || 'legacy collection'}</span><span>First-party public sources · fail closed</span></footer>
    </section>
  );
}

function SiteGuide(): JSX.Element {
  return (
    <details className="site-guide"><summary>Trust model and shortcuts</summary><div><section><h3>What green means</h3><p>Green is shown only when a current readable official source explicitly supports an operational conclusion. A source failure never becomes green.</p></section><section><h3>Evidence ladder</h3><p>Structured first-party JSON ranks highest, then first-party feeds, rendered provider pages, and readable public pages. Limited and unavailable observations remain unknown.</p></section><section><h3>Keyboard</h3><p><kbd>/</kbd> search · <kbd>1–5</kbd> switch views · <kbd>R</kbd> refresh · <kbd>W</kbd> wallboard · <kbd>Esc</kbd> close</p></section><section><h3>Scope</h3><p>US, North America, global, mixed-region, and region-unspecified events remain visible. Explicitly non-US-only events are filtered.</p></section></div></details>
  );
}

export function IssueConsole({ model, lifecycle, onRefresh }: { model: IssueConsoleModel | null; lifecycle: DataLifecycle; onRefresh: () => void }): JSX.Element {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const initialView = params.get('view');
  const [view, setView] = useState<ConsoleView>(() => initialView === 'wallboard' ? 'wallboard' : views.includes(initialView as typeof views[number]) ? initialView as typeof views[number] : (localStorage.getItem('sst-command-view') as ConsoleView) || 'overview');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  const selectedSource = model?.diagnostics.find(item => item.id === selectedProviderId) || null;
  const selectedIncidents = model?.briefs.filter(item => item.providerId === selectedProviderId) || [];
  const selectedMaintenance = model?.maintenance.filter(item => item.providerId === selectedProviderId) || [];

  const navigate = (next: ConsoleView, nextFilter?: string) => {
    setView(next);
    if (nextFilter) setFilter(nextFilter);
    if (next !== 'wallboard') localStorage.setItem('sst-command-view', next);
    const search = new URLSearchParams(location.search);
    if (next === 'overview') search.delete('view'); else search.set('view', next);
    history.replaceState(null, '', `${location.pathname}${search.size ? `?${search}` : ''}`);
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
      if (event.key.toLowerCase() === 'r') onRefresh();
      if (event.key.toLowerCase() === 'w') navigate('wallboard');
      const numeric = Number(event.key);
      if (numeric >= 1 && numeric <= views.length) navigate(views[numeric - 1]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onRefresh, selectedProviderId, view]);

  useEffect(() => {
    if (!selectedProviderId) return;
    const source = model?.diagnostics.find(item => item.id === selectedProviderId);
    if (!source) setSelectedProviderId(null);
  }, [model, selectedProviderId]);

  if (view === 'wallboard') return <Wallboard model={model} lifecycle={lifecycle} onExit={() => navigate('overview')} />;

  return (
    <div className="command-shell">
      <header className="command-header">
        <div className="brand-lockup"><span className="brand-mark"><i /><i /><i /></span><div><p>MSP service intelligence</p><h1>Operations command center</h1><span className="sr-only">Technician briefing. Provider diagnostics and evidence.</span></div></div>
        <div className="command-status"><span className={`pulse-dot phase-${lifecycle.phase}`} /><span><b>{lifecycle.phase === 'ready' ? 'Live model' : titleCase(lifecycle.phase)}</b><small>{model ? `${relativeAge(model.generatedAt)} · ${model.summary.coverage_percent}% coverage` : 'Awaiting validated data'}</small></span></div>
        <div className="command-actions"><button className="button secondary" type="button" onClick={() => navigate('wallboard')}>Wallboard</button><button className="button primary" type="button" onClick={onRefresh} disabled={lifecycle.phase === 'refreshing'}>{lifecycle.phase === 'refreshing' ? 'Refreshing…' : 'Refresh data'}</button></div>
      </header>
      <LifecycleBanner lifecycle={lifecycle} generatedAt={model?.generatedAt} />
      <nav className="command-nav" aria-label="Command center views">
        {views.map((item, index) => {
          const count = item === 'incidents' ? model?.incidentCount : item === 'providers' ? model?.diagnostics.length : item === 'sources' ? model?.blindSpotCount : item === 'timeline' ? model?.history.length : model?.attentionCount;
          return <button key={item} type="button" aria-current={view === item ? 'page' : undefined} onClick={() => navigate(item)}><span>{titleCase(item)}</span>{count !== undefined && <em>{count}</em>}<kbd>{index + 1}</kbd></button>;
        })}
      </nav>

      <main className="command-main">
        {model ? (
          <>
            {view === 'overview' && <OverviewView model={model} onProvider={setSelectedProviderId} onNavigate={navigate} />}
            {view === 'incidents' && <IncidentsView model={model} />}
            {view === 'providers' && <ProvidersView model={model} query={query} filter={filter} onQuery={setQuery} onFilter={setFilter} onProvider={setSelectedProviderId} />}
            {view === 'sources' && <SourceIntegrityView model={model} query={query} filter={filter} onQuery={setQuery} onFilter={setFilter} onProvider={setSelectedProviderId} />}
            {view === 'timeline' && <TimelineView model={model} onProvider={setSelectedProviderId} />}
          </>
        ) : <section className="unavailable-state"><span className="brand-mark large"><i /><i /><i /></span><h2>Status intelligence unavailable</h2><p>No provider is presented as operational until a complete payload passes browser validation.</p><button className="button primary" type="button" onClick={onRefresh}>Retry validated load</button></section>}
      </main>

      <footer className="command-footer"><div><span>Product</span><b>{model?.version || 'loading'}</b></div><div><span>Generated</span><b>{timeLabel(model?.generatedAt)}</b></div><div><span>Collection run</span><b>{model?.collection?.run_id || 'legacy payload'}</b></div><div><span>Policy</span><b>First-party · fail closed</b></div><SiteGuide /></footer>
      {selectedSource && <ProviderDrawer source={selectedSource} incidents={selectedIncidents} maintenance={selectedMaintenance} onClose={() => setSelectedProviderId(null)} />}
    </div>
  );
}
