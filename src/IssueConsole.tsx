import { useEffect, useMemo, useState } from 'react';
import { ProviderIcon } from './providerIcon';
import { filterDiagnostics, type DiagnosticSource, type IssueBrief, type IssueConsoleModel } from './statusViewModel';
import type { DataLifecycle } from './types';

const timeLabel = (value?: string) => value && !Number.isNaN(Date.parse(value))
  ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'unknown';

function CopyDraft({ draft }: { draft: string }) {
  const [copied, setCopied] = useState(false);
  return <button onClick={async () => {
    await navigator.clipboard.writeText(draft); setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }}>{copied ? 'Draft copied' : 'Copy client draft'}</button>;
}
function IncidentCard({ item }: { item: IssueBrief }) {
  return <article className={`incident-card ${item.service_state}`}>
    <header><b>{item.provider}</b><span>{item.label} · {item.attention} attention</span></header>
    <h3>{item.title}</h3><p>{item.note}</p>
    <dl><div><dt>Affected service</dt><dd>{item.affected_service || 'Not specified'}</dd></div><div><dt>First detected</dt><dd>{timeLabel(item.first_detected)}</dd></div><div><dt>Latest update</dt><dd>{timeLabel(item.latest_update)}</dd></div></dl>
    <p><b>MSP impact:</b> {item.client_impact || 'Review affected client environments before confirming impact.'}</p>
    <p><b>Technician action:</b> {item.technician_action || 'Monitor the official source and correlate with client tickets.'}</p>
    <details><summary>Client communication draft</summary><p>{item.clientDraft}</p><CopyDraft draft={item.clientDraft}/></details>
    <a href={item.url} target="_blank" rel="noopener noreferrer">Official incident source ↗</a>
  </article>;
}
function Diagnostic({ source }: { source: DiagnosticSource }) {
  return <details className="diagnostic-card"><summary><ProviderIcon id={source.id} name={source.provider}/><span><b>{source.provider}</b><small>{source.category}</small></span><strong>{source.serviceState} · source {source.sourceState} · {source.attention}</strong></summary>
    <div className="diagnostic-detail"><p>{source.status}</p><p>{source.message}</p>
      {source.clientImpact && <p><b>MSP impact:</b> {source.clientImpact}</p>}{source.technicianAction && <p><b>Action:</b> {source.technicianAction}</p>}
      <a href={source.source} target="_blank" rel="noopener noreferrer">Official source ↗</a>
      {source.downloadLog.map((log, index) => <div className="download-log" key={index}>Attempt {log.attempt || 1}: {log.status}; {log.content_type || 'content type unavailable'}; {log.error || log.message}</div>)}
    </div></details>;
}
export function IssueConsole({ model, lifecycle, onRefresh, onWallboard }: { model: IssueConsoleModel | null; lifecycle: DataLifecycle; onRefresh: () => void; onWallboard: () => void }) {
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all'); const [hidden, setHidden] = useState(document.hidden);
  useEffect(() => { const update = () => setHidden(document.hidden); document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update); }, []);
  const shown = useMemo(() => model ? filterDiagnostics(model.diagnostics, query, filter === 'all' ? [] : [filter]) : [], [model, query, filter]);
  return <>
    <header className="product-header"><div><p className="eyebrow">MSP operations intelligence</p><h1>Service Heads-Up Console</h1><p className="current-time">Last generation: {timeLabel(model?.generatedAt)}</p></div><div className="header-actions"><button onClick={onWallboard}>Wallboard mode</button><button onClick={onRefresh} disabled={lifecycle.phase === 'refreshing'}>{lifecycle.phase === 'refreshing' ? 'Refreshing…' : 'Refresh now'}</button></div></header>
    <div className={`data-banner ${lifecycle.phase}`} role="status" aria-live="polite">{lifecycle.phase === 'loading' ? 'Loading official status data…' : lifecycle.phase === 'error' ? `Load failed; no health conclusion is available. ${lifecycle.failure}` : lifecycle.phase === 'stale' ? `Stale data retained after refresh failure. ${lifecycle.failure}` : lifecycle.phase === 'refreshing' ? 'Refresh in progress; last valid data remains visible.' : hidden ? 'Automatic refresh paused while tab is hidden.' : 'Refreshes automatically once per minute.'}</div>
    {model ? <>
      <section className="briefing" aria-labelledby="briefing-title"><h2 id="briefing-title">Technician briefing</h2><div className="summary-grid"><div><span>Require attention</span><b>{model.attentionCount}</b></div><div><span>New incidents</span><b>{model.newIncidentCount}</b></div><div><span>Recently resolved</span><b>{model.resolvedCount}</b></div><div><span>New source gaps</span><b>{model.newUnavailableCount}</b></div><div><span>Provider coverage</span><b>{model.summary.coverage_percent}%</b></div><div><span>Confirmed operational</span><b>{model.summary.confirmed_operational_count}</b></div><div><span>Limited / unavailable</span><b>{model.summary.limited_count + model.summary.unavailable_count}</b></div><div><span>Service / source</span><b className="state-pair">{model.summary.service_overall} / {model.summary.source_overall}</b></div></div><p>No-incident conclusions apply only to {model.summary.confirmed_operational_count} confirmed sources, never unchecked providers.</p></section>
      <section className="incidents"><h2>Active incident briefing</h2>{model.briefs.length ? model.briefs.map(item => <IncidentCard key={item.id} item={item}/>) : <p className="empty-filter">No confirmed active incidents. Coverage is {model.summary.coverage_percent}%; limited and unavailable sources remain unknown.</p>}</section>
      <section className="changes"><h2>Recent changes</h2>{model.history.length ? <ul>{model.history.slice(0, 20).map(change => <li key={change.id}><b>{change.provider}</b> — {change.title} <small>({change.type.replaceAll('_', ' ')})</small></li>)}</ul> : <p>No comparison snapshot was available; initial generation is not treated as a mass change.</p>}</section>
      <section className="diag-panel"><header><div><h2>Provider diagnostics</h2><p>Search names, categories, tags, services and incident details.</p></div><em>{shown.length} of {model.diagnostics.length}</em></header>
        <div className="filters"><label>Search<input type="search" value={query} onChange={event => setQuery(event.target.value)}/></label><label>Operational filter<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All providers</option><option value="attention">Requires attention</option><option value="changed">Changed recently</option><option value="incident">Active incident</option><option value="unavailable">Source unavailable</option><option value="limited">Limited source</option><option value="high">High criticality</option><option value="identity">Identity</option><option value="cloud">Cloud</option><option value="security">Security</option><option value="backup">Backup</option><option value="connectivity">Connectivity</option><option value="communications">Communications</option><option value="msp">MSP platform</option><option value="operational">Confirmed operational</option></select></label></div>
        <div>{shown.map(source => <Diagnostic key={source.id} source={source}/>)}{!shown.length && <p className="empty-filter">No providers match this view.</p>}</div>
      </section>
    </> : <section className="unavailable"><h2>Status intelligence unavailable</h2><p>No provider is reported operational until a complete valid payload loads.</p></section>}
  </>;
}
