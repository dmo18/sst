import { useMemo, useState } from 'react';
import { logoSrc } from './logos';
import type { DiagnosticSource, IssueBrief, IssueConsoleModel } from './statusViewModel';
import type { DataLifecycle, StatusColor } from './types';

function timeLabel(value?: string): string {
  if (!value) return 'unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}
const statusText: Record<StatusColor, string> = { red: 'Major outage', amber: 'Degraded', blue: 'Limited or unknown', green: 'Operational' };

function Logo({ source }: { source: Pick<DiagnosticSource, 'id' | 'provider'> }): JSX.Element {
  return <img className="provider-logo" src={logoSrc(source.id)} alt="" width="28" height="28" />;
}
function LeadBrief({ issue }: { issue: IssueBrief }): JSX.Element {
  return <article className={`lead-brief ${issue.severity}`}><header><b>{issue.provider}</b><span>{statusText[issue.severity]}</span></header><h2>{issue.title}</h2><p>{issue.detail}</p><footer><span>{timeLabel(issue.time)}</span><a href={issue.url} target="_blank" rel="noopener noreferrer">Official incident source (opens new tab)</a></footer></article>;
}
function DiagnosticCard({ source }: { source: DiagnosticSource }): JSX.Element {
  return <details className={`diagnostic-card ${source.severity}`}><summary><Logo source={source} /><span><b>{source.provider}</b><small>{source.category}</small></span><strong>{statusText[source.severity]} · source {source.dataState}</strong></summary><div className="diagnostic-detail"><p><b>Service:</b> {source.status}</p><p>{source.message || 'No extra message returned.'}</p><p><b>Data source:</b> {source.dataState}; checked {timeLabel(source.checkedAt)}; parser {source.sourceType}</p><a href={source.source} target="_blank" rel="noopener noreferrer">Official status source (opens new tab)</a>{source.downloadLog.map((log, index) => <div className="download-log" key={`${source.id}-${index}`}><span>{log.status || source.status} · {log.duration_ms ?? 0} ms · {log.ok ? 'fetch succeeded' : 'fetch failed'}</span><span>{log.error || log.message}</span></div>)}</div></details>;
}

export function IssueConsole({ model, lifecycle, onRefresh, nextRefresh }: { model: IssueConsoleModel | null; lifecycle: DataLifecycle; onRefresh: () => void; nextRefresh: number }): JSX.Element {
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('all');
  const [category, setCategory] = useState('all');
  const [dataState, setDataState] = useState('all');
  const diagnostics = useMemo(() => model?.diagnostics.filter(item => (!search || `${item.provider} ${item.category}`.toLowerCase().includes(search.toLowerCase())) && (severity === 'all' || item.severity === severity) && (category === 'all' || item.category === category) && (dataState === 'all' || item.dataState === dataState)) ?? [], [model, search, severity, category, dataState]);
  const categories = useMemo(() => [...new Set(model?.diagnostics.map(item => item.category) ?? [])].sort(), [model]);
  const refreshing = lifecycle.phase === 'refreshing';

  return <>
    <header className="product-header"><div><p className="eyebrow">Official-source service intelligence</p><h1>MSP Status Dashboard</h1></div><button onClick={onRefresh} disabled={refreshing} aria-label="Refresh status data now">{refreshing ? 'Refreshing…' : 'Refresh now'}</button></header>
    <div className={`data-banner ${lifecycle.phase}`} role="status" aria-live="polite">
      {lifecycle.phase === 'loading' ? 'Loading official status data…' : null}
      {lifecycle.phase === 'error' ? `Status data unavailable. No service-health conclusion can be made. ${lifecycle.failure}` : null}
      {lifecycle.phase === 'stale' ? `Stale data retained. Latest refresh failed: ${lifecycle.failure}` : null}
      {lifecycle.phase === 'refreshing' ? 'Refreshing; the last successful data remains visible.' : null}
      {lifecycle.phase === 'ready' ? `Current data loaded. Automatic refresh in about ${Math.max(0, Math.ceil((nextRefresh - Date.now()) / 1000))} seconds.` : null}
    </div>
    {model ? <>
      <section className="summary-grid" aria-label="Global status summary"><div><span>Active incidents</span><b>{model.incidentCount}</b></div><div><span>Affected providers</span><b>{model.affectedCount}</b></div><div><span>Confirmed operational</span><b>{model.summary.greenCount}</b></div><div><span>Source unavailable</span><b>{model.summary.failedCount}</b></div></section>
      <p className="last-update">Last successful generation: <time dateTime={model.generatedAt}>{timeLabel(model.generatedAt)}</time> · {model.version}</p>
      <section className="incidents" aria-labelledby="incident-heading"><h2 id="incident-heading">Incident brief</h2>{model.lead ? <><LeadBrief issue={model.lead} />{model.briefs.slice(1).map(issue => <LeadBrief key={issue.id} issue={issue} />)}</> : <div className="clear-brief"><b>No active issues</b><span>A valid generated payload reports no active incidents. Limited and unavailable sources are not treated as healthy.</span></div>}</section>
      <section className="diag-panel" aria-labelledby="diagnostics-heading"><header><div><h2 id="diagnostics-heading">Provider diagnostics</h2><p>Service health and official data-source health are reported separately for all configured providers.</p></div><em>{diagnostics.length} of {model.diagnostics.length}</em></header>
        <div className="filters"><label>Search<input value={search} onChange={e => setSearch(e.target.value)} type="search" placeholder="Provider name" /></label><label>Severity<select value={severity} onChange={e => setSeverity(e.target.value)}><option value="all">All</option><option value="red">Major</option><option value="amber">Degraded</option><option value="blue">Limited</option><option value="green">Operational</option></select></label><label>Category<select value={category} onChange={e => setCategory(e.target.value)}><option value="all">All</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label><label>Source state<select value={dataState} onChange={e => setDataState(e.target.value)}><option value="all">All</option><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option><option value="pending">Pending</option><option value="disabled">Disabled</option></select></label></div>
        <div className="diagnostic-list">{diagnostics.map(source => <DiagnosticCard key={source.id} source={source} />)}{!diagnostics.length ? <p className="empty-filter">No providers match these filters.</p> : null}</div>
      </section>
    </> : <section className="unavailable" aria-labelledby="unavailable-title"><h2 id="unavailable-title">Service status unavailable</h2><p>Diagnostics will appear when a valid generated payload can be loaded. No providers are being reported operational.</p></section>}
  </>;
}
