import { useMemo, useState } from 'react';
import type { IssueConsoleModel } from './statusViewModel';
import {
  MICROSOFT_365_CRITICAL_SERVICES,
  MICROSOFT_GRAPH_HEALTH_OVERVIEWS_PATH,
  MICROSOFT_GRAPH_ISSUES_PATH,
  MICROSOFT_GRAPH_SERVICE_HEALTH_PERMISSION,
  microsoft365CoverageSnapshot,
  microsoft365EvidenceLabel,
  microsoft365EvidenceTone,
  microsoft365FacetAssessment,
  microsoft365ServiceTone
} from './microsoft365Coverage';

function stateLabel(value?: string): string {
  return (value || 'unknown').replaceAll('_', ' ');
}

function publicSourceSummary(provider: 'Microsoft 365' | 'Microsoft Entra ID', source: ReturnType<typeof microsoft365CoverageSnapshot>['microsoft365']): string {
  if (!source) return `${provider} public signal is not present in the current payload`;
  return `${stateLabel(source.serviceState)} service · ${microsoft365EvidenceLabel(source)}`;
}

export function Microsoft365CriticalSuite({ model }: { model: IssueConsoleModel | null }): JSX.Element {
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).get('m365') === '1');
  const snapshot = useMemo(() => microsoft365CoverageSnapshot(model), [model]);
  const microsoftTone = microsoft365ServiceTone(snapshot.microsoft365);
  const entraTone = microsoft365ServiceTone(snapshot.entra);
  const microsoftEvidenceTone = microsoft365EvidenceTone(snapshot.microsoft365);
  const entraEvidenceTone = microsoft365EvidenceTone(snapshot.entra);
  const activeMicrosoftIncidents = useMemo(() => (model?.briefs || [])
    .filter(item => item.providerId === 'microsoft365' || item.providerId === 'entra')
    .sort((a, b) => Date.parse(b.latest_update || '') - Date.parse(a.latest_update || '')),
  [model?.briefs]);
  const overallTone = microsoftTone === 'critical' || entraTone === 'critical'
    ? 'critical'
    : microsoftTone === 'warning' || entraTone === 'warning'
      ? 'warning'
      : microsoftTone === 'positive' && entraTone === 'positive'
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
          <small>{activeMicrosoftIncidents.length} public incidents · {snapshot.serviceFacetCount} service facets · tenant detail private</small>
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
                <p>Service truth and evidence quality are deliberately separate. A weak public source never becomes a fake outage, and a clear umbrella feed never becomes proof that every tenant service is healthy.</p>
              </div>
              <button type="button" aria-label="Close Microsoft 365 coverage" onClick={() => setOpen(false)}>×</button>
            </header>

            <div className="m365-summary-grid">
              <button
                type="button"
                className={`m365-source-card is-${microsoftTone}`}
                data-provider-id="microsoft365"
                data-service-state={snapshot.microsoft365?.serviceState || 'unknown'}
                data-evidence-tone={microsoftEvidenceTone}
                onClick={() => openProvider('microsoft365')}
              >
                <span>Microsoft 365 broad public signal</span>
                <strong>{snapshot.microsoft365?.provider || 'Microsoft 365'}</strong>
                <small>{publicSourceSummary('Microsoft 365', snapshot.microsoft365)}</small>
              </button>
              <button
                type="button"
                className={`m365-source-card is-${entraTone}`}
                data-provider-id="entra"
                data-service-state={snapshot.entra?.serviceState || 'unknown'}
                data-evidence-tone={entraEvidenceTone}
                onClick={() => openProvider('entra')}
              >
                <span>Microsoft Entra dedicated public signal</span>
                <strong>{snapshot.entra?.provider || 'Microsoft Entra ID'}</strong>
                <small>{publicSourceSummary('Microsoft Entra ID', snapshot.entra)}</small>
              </button>
              <div className="m365-source-card is-boundary">
                <span>Tenant service health</span>
                <strong>Authenticated Microsoft Graph</strong>
                <small>{MICROSOFT_GRAPH_SERVICE_HEALTH_PERMISSION} · tenant-only health is never invented from the public feed</small>
              </div>
            </div>

            <div className="m365-content-grid">
              <main>
                <div className="m365-section-heading">
                  <div><span>Coverage matrix</span><h3>Core MSP Microsoft estate</h3></div>
                  <b>{snapshot.serviceFacetCount} tracked facets · {snapshot.tenantGranularFacetCount} require tenant detail</b>
                </div>
                <div className="m365-service-grid">
                  {MICROSOFT_365_CRITICAL_SERVICES.map(service => {
                    const assessment = microsoft365FacetAssessment(service, snapshot);
                    const publicSource = service.providerId === 'entra' ? snapshot.entra : snapshot.microsoft365;
                    return (
                      <article
                        key={service.id}
                        className={`m365-service-card is-${assessment.serviceTone}`}
                        data-m365-service={service.id}
                        data-public-service-state={publicSource?.serviceState || 'unknown'}
                        data-evidence-tone={assessment.evidenceTone}
                      >
                        <header><span>{service.label}</span><em>{service.coverageMode === 'dedicated-public' ? 'Dedicated public + tenant' : 'Broad public + tenant detail'}</em></header>
                        <p>{service.operatorImpact}</p>
                        <footer>
                          <b>{assessment.serviceLabel}</b>
                          <small>Evidence: {assessment.evidenceLabel}. {service.coverageMode === 'dedicated-public'
                            ? 'Tenant Graph remains authoritative for tenant-specific impact.'
                            : 'Facet-specific health requires Microsoft service communications for the tenant.'}</small>
                        </footer>
                      </article>
                    );
                  })}
                </div>
              </main>

              <aside className="m365-rail">
                <section className={activeMicrosoftIncidents.length ? 'is-active' : 'is-clear'} data-m365-current-incidents={activeMicrosoftIncidents.length}>
                  <span>Current public incidents</span>
                  <h3>{activeMicrosoftIncidents.length ? `${activeMicrosoftIncidents.length} active Microsoft signal${activeMicrosoftIncidents.length === 1 ? '' : 's'}` : 'No active public Microsoft incident'}</h3>
                  {activeMicrosoftIncidents.length ? activeMicrosoftIncidents.slice(0, 4).map(item => (
                    <article className="m365-incident" key={item.id}>
                      <b>{item.provider}</b>
                      <strong>{item.title}</strong>
                      <small>{stateLabel(item.status)} · {item.affectedServiceLabel}</small>
                    </article>
                  )) : <p>The current payload contains no active Microsoft 365 or Entra public incident. Source-quality warnings remain evidence warnings only.</p>}
                </section>
                <section>
                  <span>Truth boundary</span>
                  <h3>Public does not mean tenant-complete</h3>
                  <p>Microsoft publishes broad public health and dedicated Entra public status, while detailed Microsoft 365 Business and Enterprise service health is tenant-scoped. Those evidence classes remain separate.</p>
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
                  <h3>Escalate evidence, not assumptions</h3>
                  <p>Act on Microsoft public incident state when Microsoft reports one. Treat source-health watch states as evidence-quality warnings. Validate tenant service health before changing DNS, identity, mail flow, endpoint, or collaboration configuration.</p>
                </section>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
