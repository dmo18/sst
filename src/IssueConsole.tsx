import { useEffect, useMemo, useState } from 'react';
import { ProviderIcon } from './providerIcon';
import {
  filterDiagnostics,
  type DiagnosticSource,
  type IssueBrief,
  type IssueConsoleModel
} from './statusViewModel';
import type { DataLifecycle } from './types';
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
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function incidentSortTime(item: IssueBrief): number {
  return Math.max(parseTime(item.latest_update), parseTime(item.first_detected), parseTime(item.rawTime), parseTime(item.time));
}

function timeLabel(value?: string): string {
  if (!value || Number.isNaN(Date.parse(value))) return 'unknown';
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date(value));
  return `${formatted} EST`;
}

function affectedService(item: IssueBrief): string {
  return item.affected_service || item.category || item.provider;
}

function groupIncidents(items: IssueBrief[]): IncidentGroup[] {
  const groups = new Map<string, IncidentGroup>();
  for (const item of items) {
    const key = item.providerId || item.provider;
    const group = groups.get(key) || {
      providerId: key,
      provider: item.provider,
      category: item.category,
      newestMs: 0,
      items: []
    };
    const itemMs = incidentSortTime(item);
    group.newestMs = Math.max(group.newestMs, itemMs);
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(group => ({ ...group, items: group.items.sort((a, b) => incidentSortTime(b) - incidentSortTime(a)) }))
    .sort((a, b) => b.newestMs - a.newestMs || a.provider.localeCompare(b.provider));
}

function modeHref(params: Record<string, string>): string {
  const query = new URLSearchParams(params);
  const suffix = query.toString();
  return `${location.pathname}${suffix ? `?${suffix}` : ''}`;
}

function PageFooter({ model, lifecycle }: { model: IssueConsoleModel | null; lifecycle: DataLifecycle }): JSX.Element {
  return (
    <footer className="page-footer">
      <div>
        <span>Platform version</span>
        <b>{model?.version || 'loading'}</b>
      </div>
      <div>
        <span>Last updated</span>
        <b>{timeLabel(model?.generatedAt)}</b>
      </div>
      <div>
        <span>Data state</span>
        <b>{lifecycle.phase}</b>
      </div>
      <details className="mode-helper">
        <summary>Modes and options</summary>
        <div>
          <p>Use these links to switch views or pin a wallboard layout.</p>
          <nav>
            <a href={modeHref({})}>Operator console</a>
            <a href={modeHref({ view: 'wallboard', screen: 'heads-up' })}>Wallboard heads-up</a>
            <a href={modeHref({ view: 'wallboard', screen: 'providers' })}>Wallboard providers</a>
            <a href={modeHref({ view: 'wallboard', screen: 'sources' })}>Wallboard sources</a>
            <a href={modeHref({ view: 'wallboard', screen: 'providers', density: 'compact' })}>Compact providers</a>
            <a href={modeHref({ view: 'wallboard', screen: 'providers', rotate: '30' })}>Rotate every 30 seconds</a>
          </nav>
          <dl>
            <div><dt>Operator console</dt><dd>Full triage view with briefing, incidents, changes, search, filters, and diagnostics.</dd></div>
            <div><dt>Wallboard heads-up</dt><dd>Large display mode focused on active incidents and high-level status.</dd></div>
            <div><dt>Wallboard providers</dt><dd>Provider tile view for service state and source state at a glance.</dd></div>
            <div><dt>Wallboard sources</dt><dd>Focuses on limited and unavailable provider sources.</dd></div>
            <div><dt>density=compact</dt><dd>Fits more provider tiles on large displays.</dd></div>
            <div><dt>rotate=30</dt><dd>Enables wallboard rotation every 30 seconds where supported.</dd></div>
          </dl>
        </div>
      </details>
    </footer>
  );
}

function CopyDraft({ draft }: { draft: string }): JSX.Element {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(draft);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
      aria-live="polite"
    >
      {copied ? 'Draft copied' : 'Copy client draft'}
    </button>
  );
}

function IncidentCard({ item, wallboard }: { item: IssueBrief; wallboard: boolean }): JSX.Element {
  return (
    <article className={`incident-card ${item.service_state}`}>
      <header>
        <div className="provider-identity">
          <ProviderIcon id={item.providerId} name={item.provider} />
          <b>{item.provider}</b>
        </div>
        <span>{item.label} · {item.attention} attention</span>
      </header>
      <h3>{item.title}</h3>
      <p>{item.note}</p>
      <dl>
        <div><dt>Affected service</dt><dd>{affectedService(item)}</dd></div>
        <div><dt>First detected</dt><dd>{timeLabel(item.first_detected || item.rawTime || item.time)}</dd></div>
        <div><dt>Latest update</dt><dd>{timeLabel(item.latest_update || item.rawTime || item.time)}</dd></div>
      </dl>
      {!wallboard && (
        <>
          <p><b>MSP impact:</b> {item.client_impact || 'Review affected client environments before confirming impact.'}</p>
          <p><b>Technician action:</b> {item.technician_action || 'Monitor the official source and correlate with client tickets.'}</p>
          <details>
            <summary>Client communication draft</summary>
            <p>{item.clientDraft}</p>
            <CopyDraft draft={item.clientDraft} />
          </details>
        </>
      )}
      <a href={item.url} target="_blank" rel="noopener noreferrer">Official incident source ↗</a>
    </article>
  );
}

function IncidentGroupCard({ group }: { group: IncidentGroup }): JSX.Element {
  return (
    <article className="incident-source-group">
      <header>
        <div className="provider-identity">
          <ProviderIcon id={group.providerId} name={group.provider} />
          <div><h3>{group.provider}</h3><p>{group.category}</p></div>
        </div>
        <span>{group.items.length} active update{group.items.length === 1 ? '' : 's'} · newest {timeLabel(group.items[0]?.latest_update || group.items[0]?.rawTime || group.items[0]?.time)}</span>
      </header>
      {group.items.map(item => <IncidentCard key={item.id} item={item} wallboard={false} />)}
    </article>
  );
}

function Diagnostic({ source }: { source: DiagnosticSource }): JSX.Element {
  return (
    <details className={`diagnostic-card source-${source.sourceState}`}>
      <summary>
        <ProviderIcon id={source.id} name={source.provider} />
        <span><b>{source.provider}</b><small>{source.category}</small></span>
        <strong>{source.serviceState} · source {source.sourceState} · {source.attention}</strong>
      </summary>
      <div className="diagnostic-detail">
        <p>{source.status}</p>
        <p>{source.message}</p>
        <p><b>Status captured:</b> {source.ok ? `yes, ${timeLabel(source.checkedAt)}` : `no, last attempt ${timeLabel(source.checkedAt)}`}</p>
        {source.clientImpact && <p><b>MSP impact:</b> {source.clientImpact}</p>}
        {source.technicianAction && <p><b>Action:</b> {source.technicianAction}</p>}
        <a href={source.source} target="_blank" rel="noopener noreferrer">Official source ↗</a>
        {source.downloadLog.map((log, index) => (
          <div className="download-log" key={`${source.id}-${index}`}>
            Attempt {log.attempt || 1}: {log.status}; {log.content_type || 'content type unavailable'}; {log.error || log.message}; completed {timeLabel(log.completed_at)}
          </div>
        ))}
      </div>
    </details>
  );
}

function Wallboard({ model, lifecycle, settings, onOperator }: {
  model: IssueConsoleModel | null;
  lifecycle: DataLifecycle;
  settings: WallboardSettings;
  onOperator: () => void;
}): JSX.Element {
  const incidents = model?.briefs ?? [];
  const diagnostics = model?.diagnostics ?? [];
  const attention = diagnostics.filter(source => source.attention !== 'informational');
  const sourceGaps = diagnostics.filter(source => source.sourceState === 'limited' || source.sourceState === 'unavailable');
  const primary = settings.screen === 'sources' ? sourceGaps : settings.screen === 'providers' ? attention : diagnostics;
  const incidentGroups = groupIncidents(incidents);

  return (
    <section className={`wallboard ${settings.screen} ${settings.density}`}>
      <header className="wallboard-header">
        <div>
          <p className="eyebrow">MSP wallboard</p>
          <h1>Service Heads-Up Console</h1>
          <p>{lifecycle.phase === 'ready' ? `Updated ${timeLabel(model?.generatedAt)}` : lifecycle.phase}</p>
        </div>
        <button onClick={onOperator}>Operator view</button>
      </header>

      <section className="wallboard-metrics">
        <div><span>Providers</span><b>{diagnostics.length}</b></div>
        <div><span>Attention</span><b>{attention.length}</b></div>
        <div><span>Incidents</span><b>{incidents.length}</b></div>
        <div><span>Coverage</span><b>{model?.summary.coverage_percent ?? 0}%</b></div>
      </section>

      {settings.screen === 'heads-up' && incidentGroups.length ? (
        <div className="wallboard-incidents">
          {incidentGroups.slice(0, 6).flatMap(group => group.items.slice(0, 2)).map(item => <IncidentCard key={item.id} item={item} wallboard />)}
        </div>
      ) : (
        <div className="wallboard-grid">
          {primary.slice(0, 24).map(source => (
            <article className={`wallboard-provider ${source.serviceState} source-${source.sourceState}`} key={source.id}>
              <ProviderIcon id={source.id} name={source.provider} />
              <b>{source.provider}</b>
              <span>{source.serviceState} / {source.sourceState}</span>
            </article>
          ))}
        </div>
      )}
      <PageFooter model={model} lifecycle={lifecycle} />
    </section>
  );
}

export function IssueConsole({ model, lifecycle, onRefresh }: {
  model: IssueConsoleModel | null;
  lifecycle: DataLifecycle;
  onRefresh: () => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [hidden, setHidden] = useState(document.hidden);
  const settings = useMemo(() => parseWallboardSettings(location.search), []);
  const [mode, setMode] = useState(() => new URLSearchParams(location.search).has('view')
    ? settings.view
    : localStorage.getItem('sst-view') === 'wallboard' ? 'wallboard' : 'operator');

  useEffect(() => localStorage.setItem('sst-view', mode), [mode]);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  const filtered = useMemo(
    () => model ? filterDiagnostics(model.diagnostics, query, filter === 'all' ? [] : [filter]) : [],
    [model, query, filter]
  );
  const shown = filtered;
  const incidentGroups = useMemo(() => model ? groupIncidents(model.briefs) : [], [model]);

  if (mode === 'wallboard') return <Wallboard model={model} lifecycle={lifecycle} settings={settings} onOperator={() => setMode('operator')} />;

  return (
    <>
      <header className="product-header">
        <div>
          <p className="eyebrow">MSP operations intelligence</p>
          <h1>Service Heads-Up Console</h1>
          <p className="current-time">Last refresh: {timeLabel(model?.generatedAt)}</p>
        </div>
        <div className="header-actions">
          <button aria-pressed={false} onClick={() => setMode('wallboard')}>
            Wallboard mode
          </button>
          <button onClick={onRefresh} disabled={lifecycle.phase === 'refreshing'}>
            {lifecycle.phase === 'refreshing' ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
      </header>

      <div className={`data-banner ${lifecycle.phase}`} role="status" aria-live="polite">
        {lifecycle.phase === 'loading'
          ? 'Loading official status data…'
          : lifecycle.phase === 'error'
            ? `Load failed; no health conclusion is available. ${lifecycle.failure}`
            : lifecycle.phase === 'stale'
              ? `Stale data retained after refresh failure. ${lifecycle.failure}`
              : lifecycle.phase === 'refreshing'
                ? 'Refresh in progress; last valid data remains visible.'
                : hidden
                  ? 'Automatic refresh paused while tab is hidden.'
                  : 'Refreshes automatically once per minute.'}
      </div>

      {model ? (
        <>
          <section className="briefing" aria-labelledby="briefing-title">
            <h2 id="briefing-title">Technician briefing</h2>
            <div className="summary-grid">
              <div><span>Require attention</span><b>{model.attentionCount}</b></div>
              <div><span>New incidents</span><b>{model.newIncidentCount}</b></div>
              <div><span>Recently resolved</span><b>{model.resolvedCount}</b></div>
              <div><span>New source gaps</span><b>{model.newUnavailableCount}</b></div>
              <div><span>Provider coverage</span><b>{model.summary.coverage_percent}%</b></div>
              <div><span>Confirmed operational</span><b>{model.summary.confirmed_operational_count}</b></div>
              <div><span>Limited / unavailable</span><b>{model.summary.limited_count + model.summary.unavailable_count}</b></div>
              <div><span>Service / source</span><b className="state-pair">{model.summary.service_overall} / {model.summary.source_overall}</b></div>
            </div>
            <p>No-incident conclusions apply only to {model.summary.confirmed_operational_count} confirmed sources, never unchecked providers.</p>
          </section>

          <section className="incidents">
            <h2>Active incident briefing</h2>
            {incidentGroups.length
              ? incidentGroups.map(group => <IncidentGroupCard key={group.providerId} group={group} />)
              : <p className="empty-filter">No active incidents. Coverage is {model.summary.coverage_percent}%; limited and unavailable sources remain unknown.</p>}
          </section>

          <section className="changes">
            <h2>Recent changes</h2>
            {model.history.length
              ? <ul>{model.history.slice(0, 20).map(change => <li key={change.id}><time>{timeLabel(change.detected_at)}</time> <b>{change.provider}</b> - {change.title} <small>({change.type.replaceAll('_', ' ')})</small></li>)}</ul>
              : <p>No comparison snapshot was available; initial generation is not treated as a mass change.</p>}
          </section>

          <section className="diag-panel">
            <header>
              <div><h2>Provider diagnostics</h2><p>Rows are color coded by source capture state, not by vendor outage severity.</p></div>
              <em>{shown.length} of {model.diagnostics.length}</em>
            </header>
            <div className="filters">
              <label>Search<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
              <label>
                Operational filter
                <select value={filter} onChange={event => setFilter(event.target.value)}>
                  <option value="all">All providers</option>
                  <option value="attention">Requires attention</option>
                  <option value="changed">Changed recently</option>
                  <option value="incident">Active incident</option>
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
                </select>
              </label>
            </div>
            <div>{shown.map(source => <Diagnostic key={source.id} source={source} />)}{!shown.length && <p className="empty-filter">No providers match this view.</p>}</div>
          </section>
        </>
      ) : (
        <section className="unavailable"><h2>Status intelligence unavailable</h2><p>No provider is reported operational until a complete valid payload loads.</p></section>
      )}
      <PageFooter model={model} lifecycle={lifecycle} />
    </>
  );
}
