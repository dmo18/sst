import { useMemo, useState } from 'react';
import type { IssueConsoleModel } from './statusViewModel';
import {
  MICROSOFT_365_CRITICAL_SERVICES,
  MICROSOFT_GRAPH_HEALTH_OVERVIEWS_PATH,
  MICROSOFT_GRAPH_ISSUES_PATH,
  MICROSOFT_GRAPH_SERVICE_HEALTH_PERMISSION,
  microsoft365CoverageSnapshot,
  microsoft365PublicTone
} from './microsoft365Coverage';

function stateLabel(value?: string): string {
  return (value || 'unknown').replaceAll('_', ' ');
}

export function Microsoft365CriticalSuite({ model }: { model: IssueConsoleModel | null }): JSX.Element {
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).get('m365') === '1');
  const snapshot = useMemo(() => microsoft365CoverageSnapshot(model), [model]);
  const m365Tone = microsoft365PublicTone(snapshot.microsoft365);
  const entraTone = microsoft365PublicTone(snapshot.entra);
  const overallTone = m365Tone === 'critical' || entraTone === 'critical'
    ? 'critical'
    : m365Tone === 'warning' || entraTone === 'warning'
      ? 'warning'
      : m365Tone === 'positive' && entraTone === 'positive'
        ? 'positive'
        : 'unknown';

  const openProvider = (providerId: 'microsoft365' | 'entra') => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent('serviceops:product-command', {
      detail: { command: 'focus', target: `provider:${providerId}` }
    }));
  };

  return (
    <>
      <button
        className={`m365-launcher is-${overallTone}`}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Microsoft 365 critical coverage"
      >
        <span className="m365-launcher-mark" aria-hidden="true">M</span>
        <span>
          <b>Microsoft 365 critical</b>
          <small>{snapshot.publicSignalsPresent}/{snapshot.publicSignalsExpected} public signals · {snapshot.serviceFacetCount} service facets</small>
        </span>
        <em>{overallTone}</em>
      </button>

      {open ? (
        <div className="m365-layer" role="presentation" data-m365-critical-suite="open" onMouseDown={event => {
          if (event.currentTarget === event.target) setOpen(false);
        }}>
          <section className="m365-shell" role="dialog" aria-modal="true" aria-label="Microsoft 365 critical coverage">
            <header className="m365-header">
              <div>
                <span>Critical service estate</span>
                <h2>Microsoft 365 coverage</h2>
                <p>Public broad-impact signals plus an explicit tenant-health boundary. No tenant health is invented from public data.</p>
              </div>
              <button type="button" aria-label="Close Microsoft 365 coverage" onClick={() => setOpen(false)}>×</button>
            </header>

            <div className="m365-summary-grid">
              <button type="button" className={`m365-source-card is-${m365Tone}`} onClick={() => openProvider('microsoft365')}>
                <span>Microsoft 365 public signal</span>
                <strong>{snapshot.microsoft365?.provider || 'Microsoft 365'}</strong>
                <small>{snapshot.microsoft365 ? `${stateLabel(snapshot.microsoft365.serviceState)} service · ${stateLabel(snapshot.microsoft365.sourceHealth)} source` : 'Public signal not present in current payload'}</small>
              </button>
              <button type="button" className={`m365-source-card is-${entraTone}`} onClick={() => openProvider('entra')}>
                <span>Identity dependency</span>
                <strong>{snapshot.entra?.provider || 'Microsoft Entra ID'}</strong>
                <small>{snapshot.entra ? `${stateLabel(snapshot.entra.serviceState)} service · ${stateLabel(snapshot.entra.sourceHealth)} source` : 'Dedicated Entra signal not present in current payload'}</small>
              </button>
              <div className="m365-source-card is-boundary">
                <span>Tenant service health</span>
                <strong>Authenticated Microsoft Graph</strong>
                <small>{MICROSOFT_GRAPH_SERVICE_HEALTH_PERMISSION} · never exposed to the public browser or status payload</small>
              </div>
            </div>

            <div className="m365-content-grid">
              <main>
                <div className="m365-section-heading">
                  <div><span>Coverage matrix</span><h3>Core MSP Microsoft estate</h3></div>
                  <b>{snapshot.serviceFacetCount} protected facets</b>
                </div>
                <div className="m365-service-grid">
                  {MICROSOFT_365_CRITICAL_SERVICES.map(service => {
                    const source = service.providerId === 'entra' ? snapshot.entra : snapshot.microsoft365;
                    const tone = microsoft365PublicTone(source);
                    return (
                      <article key={service.id} className={`m365-service-card is-${tone}`} data-m365-service={service.id}>
                        <header><span>{service.label}</span><em>{service.coverageMode === 'dedicated-public' ? 'Dedicated public + tenant' : 'Public umbrella + tenant'}</em></header>
                        <p>{service.operatorImpact}</p>
                        <footer>
                          <b>{source ? stateLabel(source.serviceState) : 'signal unavailable'}</b>
                          <small>{service.coverageMode === 'dedicated-public' ? 'Dedicated public signal available; tenant Graph remains authoritative for tenant impact.' : 'Detailed tenant impact requires Microsoft Graph service health.'}</small>
                        </footer>
                      </article>
                    );
                  })}
                </div>
              </main>

              <aside className="m365-rail">
                <section>
                  <span>Truth boundary</span>
                  <h3>Public does not mean tenant-complete</h3>
                  <p>Microsoft publishes broad public health, while detailed Microsoft 365 Business/Enterprise service health is tenant-scoped. This product keeps those evidence classes separate.</p>
                </section>
                <section>
                  <span>Backend contract</span>
                  <h3>Graph service communications</h3>
                  <code>{MICROSOFT_GRAPH_HEALTH_OVERVIEWS_PATH}</code>
                  <code>{MICROSOFT_GRAPH_ISSUES_PATH}</code>
                  <p>Least-privilege permission: <b>{MICROSOFT_GRAPH_SERVICE_HEALTH_PERMISSION}</b>. Any future tenant bridge must run in an authenticated private backend and must not publish tenant identifiers or tenant-only incident detail to this public app.</p>
                </section>
                <section>
                  <span>Operator rule</span>
                  <h3>Escalate Microsoft first</h3>
                  <p>When Microsoft 365 or Entra signals degrade, validate Microsoft tenant service health before changing DNS, identity, mail flow, endpoint, or collaboration configuration.</p>
                </section>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
