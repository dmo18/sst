import { useEffect, useMemo, useState } from 'react';
import { ProviderIcon } from './providerIcon';
import {
  filterDiagnostics,
  type DiagnosticSource,
  type IssueBrief,
  type IssueConsoleModel
} from './statusViewModel';
import type { DataLifecycle, Maintenance } from './types';
import { parseWallboardSettings, type WallboardSettings } from './wallboard';

const EASTERN_TIME_ZONE = 'America/New_York';

type IncidentGroup = {
  providerId: string;
  provider: string;
  category: string;
  newestMs: number;
  items: IssueBrief[];
};

function parseTime(value?: string): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function timeLabel(value?: string): string {
  if (!value || Number.isNaN(Date.parse(value))) return 'unknown';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  }).format(new Date(value));
}

function relativeAge(value?: string): string {
  const timestamp = parseTime(value);
  if (!timestamp) return 'unknown';
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function incidentSortTime(item: IssueBrief): number {
  return Math.max(parseTime(item.latest_update), parseTime(item.first_detected), parseTime(item.rawTime), parseTime(item.time));
}

function groupIncidents(items: IssueBrief[]): IncidentGroup[] {
  const groups = new Map<string, IncidentGroup>();
  for (const item of items) {
    const key = item.providerId || item.provider;
    const group = groups.get(key) || { providerId: key, provider: item.provider, category: item.category, newestMs: 0, items: [] };
    group.newestMs = Math.max(group.newestMs, incidentSortTime(item));
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(group => ({ ...group, items: group.items.sort((a, b) => incidentSortTime(b) - incidentSortTime(a)) }))
    .sort((a, b) => b.newestMs - a.newestMs || a.provider.localeCompare(b.provider));
}

function modeHref(params: Record<string, string>): string {
  const query = new URLSearchParams(params);
  return `${location.pathname}${query.size ? `?${query}` : ''}`;
}

function confidenceLabel(source: DiagnosticSource): string {
  const evidence = source.evidenceTier.replaceAll('-', ' ');
  return `${source.sourceConfidence} confidence · ${evidence}`;
}

function SiteGuidePanel(): JSX.Element {
  return (
    <div className="site-guide-panel">
      <header className="site-guide-intro">
        <p className="eyebrow">Site guide</p>
        <h2>What this dashboard proves—and what it does not</h2>
        <p>A free, first-party public-source console for MSP triage. It uses vendor-owned structured status data, feeds, and public pages. It never treats a commercial aggregator, crowd report, login-gated source, or source failure as official vendor health.</p>
      </header>
      <div className="site-guide-grid">
        <section>
          <h3>Evidence ladder</h3>
          <ul>
            <li><b>High:</b> structured vendor JSON with incident, component, lifecycle, and maintenance fields.</li>
            <li><b>Medium:</b> first-party RSS/Atom or a provider-specific rendered status page.</li>
            <li><b>Low / none:</b> limited, inconclusive, stale, or unavailable source. This never becomes green.</li>
          </ul>
        </section>
        <section>
          <h3>Service and source are separate</h3>
          <dl className="status-guide">
            <div className="status-green"><dt>Green</dt><dd>The current official source explicitly supports an operational conclusion.</dd></div>
            <div className="status-amber"><dt>Amber</dt><dd>An active degradation or service issue is reported.</dd></div>
            <div className="status-red"><dt>Red</dt><dd>A major or critical outage is reported.</dd></div>
            <div className="status-blue"><dt>Blue</dt><dd>Health is unknown, limited, stale, or unavailable—not necessarily down.</dd></div>
          </dl>
        </section>
        <section>
          <h3>Lifecycle intelligence</h3>
          <ul>
            <li>Incident updates retain first detection, latest update, stage, components, and a bounded vendor timeline.</li>
            <li>Planned maintenance is shown separately from outages, including scheduled and in-progress work.</li>
            <li>Schema changes, repeated retrieval failures, and component problems surface as source-intelligence warnings.</li>
          </ul>
        </section>
        <section>
          <h3>Regional scope and views</h3>
          <p>US, North America, global, mixed-region, and region-unspecified events are shown. Explicitly non-US-only events are hidden by default.</p>
          <nav className="site-guide-modes">
            <a href={modeHref({})}>Operator console</a>
            <a href={modeHref({ view: 'wallboard', screen: 'heads-up' })}>Heads-up wallboard</a>
            <a href={modeHref({ view: 'wallboard', screen: 'providers' })}>Provider wallboard</a>
            <a href={modeHref({ view: 'wallboard', screen: 'sources' })}>Source-health wallboard</a>
          </nav>
        </section>
      </div>
      <footer className="site-guide-links">
        <a href="https://github.com/dmo18/sst/blob/main/CHANGELOG.md" target="_blank" rel="noopener noreferrer">Release changelog ↗</a>
        <a href="https://github.com/dmo18/sst" target="_blank" rel="noopener noreferrer">Project source ↗</a>
      </footer>
    </div>
  );
}

function PageFooter({ model, lifecycle }: { model: IssueConsoleModel | null; lifecycle: DataLifecycle }): JSX.Element {
  return (
    <footer className="page-footer">
      <div><span>Platform version</span><b>{model?.version || 'loading'}</b></div>
      <div><span>Generated</span><b>{timeLabel(model?.generatedAt)}</b></div>
      <div><span>Data state</span><b>{lifecycle.phase}</b></div>
      <div><span>Evidence</span><b>{model ? `${model.highConfidenceCount} high confidence` : 'loading'}</b></div>
      <details className="mode-helper"><summary>Site guide and options</summary><SiteGuidePanel /></details>
    </footer>
  );
}

function CopyDraft({ draft }: { draft: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }} aria-live="polite">
      {copied ? 'Draft copied' : 'Copy client draft'}
    </button>
  );
}

function UpdateTimeline({ updates }: { updates: NonNullable<IssueBrief['updates']> }): JSX.Element | null {
  if (!updates.length) return null;
  return (
    <details className="vendor-timeline">
      <summary>Vendor update timeline ({updates.length})</summary>
      <ol>
        {updates.map((update, index) => (
          <li key={`${update.at || 'unknown'}-${index}`}>
            <time>{timeLabel(update.at)}</time>
            <b>{update.status || 'update'}</b>
            <p>{update.note}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}

function IncidentCard({ item, wallboard }: { item: IssueBrief; wallboard: boolean }): JSX.Element {
  return (
    <article className={`incident-card ${item.service_state}`}>
      <header>
        <div className="provider-identity"><ProviderIcon id={item.providerId} name={item.provider} /><b>{item.provider}</b></div>
        <span>{item.label} · {item.attention} attention</span>
      </header>
      <h3>{item.title}</h3>
      <p>{item.note}</p>
      <dl>
        <div><dt>Affected service</dt><dd>{item.affectedServiceLabel}</dd></div>
        <div><dt>Incident stage</dt><dd>{item.status || 'active'}</dd></div>
        <div><dt>First detected</dt><dd>{timeLabel(item.first_detected || item.rawTime || item.time)}</dd></div>
        <div><dt>Latest update</dt><dd>{timeLabel(item.latest_update || item.rawTime || item.time)} · {relativeAge(item.latest_update || item.rawTime)}</dd></div>
      </dl>
      {!wallboard && (
        <>
          <UpdateTimeline updates={item.updates || []} />
          <div className="incident-action-grid">
            <p><b>Operator priority:</b> {item.operatorPriority}</p>
            <p><b>MSP impact:</b> {item.mspImpact}</p>
            <p><b>Technician action:</b> {item.technicianAction}</p>
          </div>
          <details><summary>Client communication draft</summary><p>{item.clientDraft}</p><CopyDraft draft={item.clientDraft} /></details>
        </>
      )}
      <a href={item.url} target="_blank" rel="noopener noreferrer">Official incident source ↗</a>
    </article>
  );
}

function IncidentGroupCard({ group, forceOpen }: { group: IncidentGroup; forceOpen: boolean }): JSX.Element {
  const newest = group.items[0]?.latest_update || group.items[0]?.rawTime || group.items[0]?.time;
  return (
    <details className="incident-source-group" {...(forceOpen ? { open: true } : {})}>
      <summary title={`Show or hide ${group.provider} updates`}>
        <div className="provider-identity"><ProviderIcon id={group.providerId} name={group.provider} /><div><h3>{group.provider}</h3><p>{group.category}</p></div></div>
        <span>{group.items.length} active update{group.items.length === 1 ? '' : 's'} · newest {timeLabel(newest)}</span>
      </summary>
      <div className="incident-source-body">{group.items.map(item => <IncidentCard key={item.id} item={item} wallboard={false} />)}</div>
    </details>
  );
}

function MaintenanceCard({ item, wallboard = false }: { item: Maintenance; wallboard?: boolean }): JSX.Element {
  return (
    <article className={`maintenance-card ${item.status}`}>
      <header>
        <div className="provider-identity"><ProviderIcon id={item.providerId} name={item.provider} /><b>{item.provider}</b></div>
        <span>{item.status.replaceAll('_', ' ')}</span>
      </header>
      <h3>{item.title}</h3>
      <p>{item.note}</p>
      <dl>
        <div><dt>Affected service</dt><dd>{item.affected_service || item.category}</dd></div>
        <div><dt>Starts</dt><dd>{timeLabel(item.starts_at)}</dd></div>
        <div><dt>Ends</dt><dd>{timeLabel(item.ends_at)}</dd></div>
        <div><dt>Latest update</dt><dd>{timeLabel(item.latest_update || item.announced_at)}</dd></div>
      </dl>
      {!wallboard && item.updates?.length ? (
        <details className="vendor-timeline"><summary>Maintenance updates ({item.updates.length})</summary><ol>{item.updates.map((update, index) => <li key={`${update.at || 'unknown'}-${index}`}><time>{timeLabel(update.at)}</time><b>{update.status || 'update'}</b><p>{update.note}</p></li>)}</ol></details>
      ) : null}
      <a href={item.url} target="_blank" rel="noopener noreferrer">Official maintenance source ↗</a>
    </article>
  );
}

function Diagnostic({ source }: { source: DiagnosticSource }): JSX.Element {
  const problemComponents = source.componentStatus.filter(component => !/^(?:operational|available|up|ok|none|good)$/i.test(component.status));
  return (
    <details className={`diagnostic-card source-${source.sourceState} confidence-${source.sourceConfidence}`}>
      <summary title={`Show or hide ${source.provider} diagnostics`}>
        <ProviderIcon id={source.id} name={source.provider} />
        <span><b>{source.provider}</b><small>{source.category}</small></span>
        <strong>{source.serviceState} · {confidenceLabel(source)} · {source.attention}</strong>
      </summary>
      <div className="diagnostic-detail">
        <p>{source.status}</p>
        {source.message && <p>{source.message}</p>}
        <div className="source-intelligence-grid">
          <p><b>Evidence:</b> {confidenceLabel(source)}</p>
          <p><b>Source adapter:</b> {source.sourceType.replaceAll('-', ' ')}</p>
          <p><b>Status captured:</b> {source.ok ? `yes, ${timeLabel(source.checkedAt)}` : `no, last attempt ${timeLabel(source.checkedAt)}`}</p>
          <p><b>Last success:</b> {timeLabel(source.lastSuccessAt)}</p>
          <p><b>Failure streak:</b> {source.consecutiveFailures}</p>
          <p><b>Last semantic change:</b> {timeLabel(source.lastSemanticChangeAt)}</p>
          <p><b>Parser:</b> {source.parserVersion || 'legacy adapter'}</p>
          <p><b>Schema:</b> {source.schemaChanged ? 'changed this cycle' : source.schemaFingerprint ? 'stable fingerprint' : 'not fingerprinted'}</p>
        </div>
        {source.componentStatus.length > 0 && (
          <details className="component-status" open={problemComponents.length > 0}>
            <summary>Component status ({problemComponents.length} requiring attention / {source.componentStatus.length} captured)</summary>
            <ul>{source.componentStatus.map(component => <li key={`${component.group || ''}-${component.name}`}><b>{component.name}</b><span>{component.status.replaceAll('_', ' ')}</span>{component.group && <small>{component.group}</small>}</li>)}</ul>
          </details>
        )}
        {source.clientImpact && <p><b>MSP impact:</b> {source.clientImpact}</p>}
        {source.technicianAction && <p><b>Action:</b> {source.technicianAction}</p>}
        <a href={source.source} target="_blank" rel="noopener noreferrer">Official source ↗</a>
        {source.downloadLog.map((log, index) => <div className="download-log" key={`${source.id}-${index}`}>Attempt {log.attempt || 1}: {log.status}; {log.content_type || 'content type unavailable'}; {log.error || log.message}; completed {timeLabel(log.completed_at)}</div>)}
      </div>
    </details>
  );
}

function Wallboard({ model, lifecycle, settings, onOperator }: { model: IssueConsoleModel | null; lifecycle: DataLifecycle; settings: WallboardSettings; onOperator: () => void }): JSX.Element {
  const incidents = model?.briefs || [];
  const maintenance = model?.maintenance || [];
  const diagnostics = model?.diagnostics || [];
  const attention = diagnostics.filter(source => source.attention !== 'informational');
  const sourceGaps = diagnostics.filter(source => source.sourceState === 'limited' || source.sourceState === 'unavailable' || source.schemaChanged || source.consecutiveFailures >= 2);
  const primary = settings.screen === 'sources' ? sourceGaps : settings.screen === 'providers' ? attention : diagnostics;
  const incidentGroups = groupIncidents(incidents);
  return (
    <section className={`wallboard ${settings.screen} ${settings.density}`}>
      <header className="wallboard-header"><div><p className="eyebrow">MSP wallboard</p><h1>Service Heads-Up Console</h1><p>{lifecycle.phase === 'ready' ? `Updated ${timeLabel(model?.generatedAt)}` : lifecycle.phase}</p></div><button onClick={onOperator}>Operator view</button></header>
      <section className="wallboard-metrics">
        <div><span>Providers</span><b>{diagnostics.length}</b></div>
        <div><span>Attention</span><b>{attention.length}</b></div>
        <div><span>Incidents</span><b>{incidents.length}</b></div>
        <div><span>Maintenance</span><b>{maintenance.length}</b></div>
        <div><span>Coverage</span><b>{model?.summary.coverage_percent || 0}%</b></div>
        <div><span>High confidence</span><b>{model?.highConfidenceCount || 0}</b></div>
      </section>
      {settings.screen === 'heads-up' && (incidentGroups.length || maintenance.length) ? (
        <div className="wallboard-incidents">
          {incidentGroups.slice(0, 5).flatMap(group => group.items.slice(0, 2)).map(item => <IncidentCard key={item.id} item={item} wallboard />)}
          {maintenance.filter(item => item.status === 'in_progress').slice(0, 2).map(item => <MaintenanceCard key={item.id} item={item} wallboard />)}
        </div>
      ) : (
        <div className="wallboard-grid">{primary.slice(0, 24).map(source => <article className={`wallboard-provider ${source.serviceState} source-${source.sourceState}`} key={source.id}><ProviderIcon id={source.id} name={source.provider} /><b>{source.provider}</b><span>{source.serviceState} / {source.sourceState}</span><small>{source.sourceConfidence} confidence</small></article>)}</div>
      )}
      <PageFooter model={model} lifecycle={lifecycle} />
    </section>
  );
}

export function IssueConsole({ model, lifecycle, onRefresh }: { model: IssueConsoleModel | null; lifecycle: DataLifecycle; onRefresh: () => void }): JSX.Element {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [hidden, setHidden] = useState(document.hidden);
  const [incidentGroupsExpanded, setIncidentGroupsExpanded] = useState(true);
  const [incidentGroupToggleNonce, setIncidentGroupToggleNonce] = useState(0);
  const settings = useMemo(() => parseWallboardSettings(location.search), []);
  const [mode, setMode] = useState(() => new URLSearchParams(location.search).has('view') ? settings.view : localStorage.getItem('sst-view') === 'wallboard' ? 'wallboard' : 'operator');

  useEffect(() => localStorage.setItem('sst-view', mode), [mode]);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  const shown = useMemo(() => model ? filterDiagnostics(model.diagnostics, query, filter === 'all' ? [] : [filter]) : [], [model, query, filter]);
  const incidentGroups = useMemo(() => model ? groupIncidents(model.briefs) : [], [model]);

  if (mode === 'wallboard') return <Wallboard model={model} lifecycle={lifecycle} settings={settings} onOperator={() => setMode('operator')} />;

  return (
    <>
      <header className="product-header"><div><p className="eyebrow">MSP operations intelligence</p><h1>Service Heads-Up Console</h1><p className="current-time">Last generated: {timeLabel(model?.generatedAt)} · {relativeAge(model?.generatedAt)}</p></div><div className="header-actions"><button onClick={() => setMode('wallboard')}>Wallboard mode</button><button onClick={onRefresh} disabled={lifecycle.phase === 'refreshing'}>{lifecycle.phase === 'refreshing' ? 'Refreshing…' : 'Refresh now'}</button></div></header>
      <div className={`data-banner ${lifecycle.phase}`} role="status" aria-live="polite">
        {lifecycle.phase === 'loading' ? 'Loading official status data…'
          : lifecycle.phase === 'error' ? `Load failed; no health conclusion is available. ${lifecycle.failure}`
            : lifecycle.phase === 'stale' ? `Stale data retained after refresh failure. ${lifecycle.failure}`
              : lifecycle.phase === 'refreshing' ? 'Refresh in progress; last valid data remains visible.'
                : hidden ? 'Automatic refresh paused while tab is hidden.' : 'The browser checks for a newer validated payload once per minute.'}
      </div>

      {model ? (
        <>
          <section className="briefing" aria-labelledby="briefing-title">
            <h2 id="briefing-title">Technician briefing</h2>
            <div className="summary-grid intelligence-summary">
              <div><span>Require attention</span><b>{model.attentionCount}</b></div>
              <div><span>Active incidents</span><b>{model.incidentCount}</b></div>
              <div><span>Planned maintenance</span><b>{model.maintenanceCount}</b></div>
              <div><span>In progress</span><b>{model.ongoingMaintenanceCount}</b></div>
              <div><span>Live source coverage</span><b>{model.summary.coverage_percent}%</b></div>
              <div><span>High-confidence sources</span><b>{model.highConfidenceCount}</b></div>
              <div><span>Structured sources</span><b>{model.summary.structured_source_count || 0}</b></div>
              <div><span>Confirmed operational</span><b>{model.summary.confirmed_operational_count}</b></div>
              <div><span>Limited / unavailable</span><b>{model.summary.limited_count + model.summary.unavailable_count}</b></div>
              <div><span>Schema changes</span><b>{model.schemaChangeCount}</b></div>
              <div><span>Failure streaks</span><b>{model.failureStreakCount}</b></div>
              <div><span>Component issues</span><b>{model.componentIssueCount}</b></div>
            </div>
            <p>Operational conclusions apply only to explicitly confirmed sources. Source quality, parser health, maintenance, and vendor service health are tracked separately.</p>
          </section>

          <section className="incidents">
            <div className="section-title-row"><div><h2>Active incident briefing</h2><p>Specific vendor incidents, lifecycle stage, affected components, and update timelines.</p></div>{incidentGroups.length > 0 && <button type="button" aria-pressed={incidentGroupsExpanded} onClick={() => { setIncidentGroupsExpanded(value => !value); setIncidentGroupToggleNonce(value => value + 1); }}>{incidentGroupsExpanded ? 'Shrink all' : 'Max all'}</button>}</div>
            {incidentGroups.length ? incidentGroups.map(group => <IncidentGroupCard key={`${group.providerId}-${incidentGroupToggleNonce}`} group={group} forceOpen={incidentGroupsExpanded} />) : <p className="empty-filter">No active incidents are currently supported by the readable official sources. Coverage is {model.summary.coverage_percent}%; unknown sources remain unknown.</p>}
          </section>

          <section className="maintenance-panel">
            <div className="section-title-row"><div><h2>Maintenance intelligence</h2><p>Scheduled work is separated from outages. In-progress maintenance is prioritized first.</p></div><em>{model.maintenanceCount} current event{model.maintenanceCount === 1 ? '' : 's'}</em></div>
            {model.maintenance.length ? <div className="maintenance-grid">{model.maintenance.map(item => <MaintenanceCard key={item.id} item={item} />)}</div> : <p className="empty-filter">No relevant upcoming or in-progress maintenance was published by the supported official sources.</p>}
          </section>

          <section className="changes">
            <h2>Recent lifecycle and source changes</h2>
            {model.history.length ? <ul>{model.history.slice(0, 30).map(change => <li key={change.id}><time>{timeLabel(change.detected_at)}</time> <b>{change.provider}</b> — {change.title} <small>({change.type.replaceAll('_', ' ')})</small></li>)}</ul> : <p>No comparison snapshot was available; initial generation is not treated as a mass change.</p>}
          </section>

          <section className="diag-panel">
            <header><div><h2>Provider diagnostics and evidence</h2><p>Inspect source confidence, parser fingerprint, retrieval reliability, component state, and official evidence.</p></div><em>{shown.length} of {model.diagnostics.length}</em></header>
            <div className="filters">
              <label>Search<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
              <label>Operational filter<select value={filter} onChange={event => setFilter(event.target.value)}>
                <option value="all">All providers</option>
                <option value="attention">Requires attention</option>
                <option value="changed">Changed recently</option>
                <option value="incident">Active incident</option>
                <option value="structured">Structured source</option>
                <option value="schema-change">Schema changed</option>
                <option value="failure-streak">Repeated source failures</option>
                <option value="unavailable">Source unavailable</option>
                <option value="limited">Limited source</option>
                <option value="high">High criticality</option>
                <option value="identity">Identity</option>
                <option value="cloud">Cloud</option>
                <option value="security">Security</option>
                <option value="backup">Backup</option>
                <option value="connectivity">Connectivity</option>
                <option value="communications">Communications</option>
                <option value="msp">MSP platform</option>
                <option value="operational">Confirmed operational</option>
              </select></label>
            </div>
            <div>{shown.map(source => <Diagnostic key={source.id} source={source} />)}{!shown.length && <p className="empty-filter">No providers match this view.</p>}</div>
          </section>
        </>
      ) : <section className="unavailable"><h2>Status intelligence unavailable</h2><p>No provider is reported operational until a complete valid payload loads.</p></section>}
      <PageFooter model={model} lifecycle={lifecycle} />
    </>
  );
}
