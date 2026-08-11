import { useMemo, useState } from 'react';
import type { IssueConsoleModel } from './statusViewModel';
import './styles/operations-intelligence.css';

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function timeLabel(value: string): string {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return 'Unknown time';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' }).format(timestamp);
}

export function OperationsIntelligencePanel({ model }: { model: IssueConsoleModel | null }): JSX.Element {
  const [open, setOpen] = useState(false);
  const reliability = useMemo(() => {
    const items = model?.diagnostics || [];
    return {
      meeting: items.filter(item => item.sourceReliability?.slo_state === 'meeting').length,
      watch: items.filter(item => item.sourceReliability?.slo_state === 'watch').length,
      breach: items.filter(item => item.sourceReliability?.slo_state === 'breach').length,
      warming: items.filter(item => item.sourceReliability?.slo_state === 'warming').length,
      risks: items.filter(item => ['watch', 'breach'].includes(item.sourceReliability?.slo_state || '') || ['watch', 'breach'].includes(item.sourceReliability?.window_30d?.slo_state || '')).sort((a, b) => (a.sourceReliability?.live_percent || 0) - (b.sourceReliability?.live_percent || 0)).slice(0, 8),
      canaries: items.filter(item => item.schemaCanary?.state === 'changed' || item.schemaCanary?.quarantine_state !== 'clear').slice(0, 8)
    };
  }, [model]);

  return (
    <>
      <button className="ops-intel-trigger" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="ops-intelligence-panel">
        Intelligence
        <span>{(model?.correlations.length || 0) + reliability.watch + reliability.breach + reliability.canaries.length}</span>
      </button>
      {open && <aside id="ops-intelligence-panel" className="ops-intel-panel" aria-label="Operations intelligence">
        <header>
          <div><span>Operations intelligence</span><h2>Source SLOs and event correlation</h2></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close operations intelligence">×</button>
        </header>
        <p className="ops-intel-boundary">Collector reliability, parser shape, and parser quarantine are source-trust controls, not vendor service health. Event clusters are temporal correlations only and never causal claims.</p>
        <section>
          <h3>Seven and thirty-day source observation SLOs</h3>
          <div className="ops-intel-metrics">
            <div><b>{reliability.meeting}</b><span>Meeting 7d</span></div>
            <div><b>{reliability.watch}</b><span>Watch 7d</span></div>
            <div><b>{reliability.breach}</b><span>Breach 7d</span></div>
            <div><b>{reliability.warming}</b><span>Warming 7d</span></div>
          </div>
          {reliability.risks.length ? <div className="ops-intel-list">{reliability.risks.map(item => <article key={item.id}>
            <div><b>{item.provider}</b><span>{titleCase(item.sourceReliability?.slo_state || '')}</span></div>
            <p>7d {item.sourceReliability?.live_percent}% live across {item.sourceReliability?.sample_count} samples. 30d {item.sourceReliability?.window_30d?.live_percent ?? 0}% live across {item.sourceReliability?.window_30d?.sample_count ?? 0} samples. {item.sourceReliability?.window_30d?.schema_change_count || 0} schema changes in the 30d window.</p>
          </article>)}</div> : <p className="ops-intel-empty">No mature source SLO is currently in watch or breach. New histories remain in warming until ten observations exist.</p>}
        </section>
        <section>
          <h3>Parser canaries and quarantine</h3>
          {reliability.canaries.length ? <div className="ops-intel-list">{reliability.canaries.map(item => <article key={item.id}>
            <div><b>{item.provider}</b><span>{item.schemaCanary?.quarantine_state === 'quarantined' ? 'Quarantined' : item.schemaCanary?.quarantine_state === 'observing' ? 'Observing' : 'Shape changed'}</span></div>
            <p>Parser {item.parserVersion || 'unknown'} fingerprint {item.schemaCanary?.fingerprint || 'unobserved'} at {timeLabel(item.schemaCanary?.last_changed_at || item.schemaCanary?.quarantine_since || item.checkedAt)}. Quarantine affects source trust only and cannot create or suppress a vendor service-health conclusion.</p>
          </article>)}</div> : <p className="ops-intel-empty">No current source-shape canary is changed, observing, or quarantined.</p>}
        </section>
        <section>
          <h3>Active event correlations</h3>
          {model?.correlations.length ? <div className="ops-intel-list">{model.correlations.slice(0, 8).map(cluster => <article key={cluster.id}>
            <div><b>{cluster.label}</b><span>{titleCase(cluster.confidence)} confidence</span></div>
            <p>{cluster.providers.join(', ')}. {cluster.rationale}</p>
            <small>{timeLabel(cluster.startedAt)} to {timeLabel(cluster.latestAt)}</small>
          </article>)}</div> : <p className="ops-intel-empty">No qualifying active vendor-timed incident cluster is present. Snapshot-only current-page observations are intentionally excluded from correlation timing.</p>}
        </section>
      </aside>}
    </>
  );
}