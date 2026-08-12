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
  microsoft365PublicSignalTone
} from './microsoft365Coverage';

function stateLabel(value?: string): string {
  return (value || 'unknown').replaceAll('_', ' ');
}

function publicSourceSummary(
  provider: 'Microsoft 365' | 'Microsoft Entra ID',
  source: ReturnType<typeof microsoft365CoverageSnapshot>['microsoft365'],
  incidentCount: number
): string {
  if (!source) return `${provider} public signal is not present in the current payload`;
  if (source.serviceState === 'major' || source.serviceState === 'degraded') {
    return `${incidentCount || source.activeIncidentCount || 0} active public incident${(incidentCount || source.activeIncidentCount || 0) === 1 ? '' : 's'} · ${microsoft365EvidenceLabel(source)}`;
  }
  if (provider === 'Microsoft 365') {
    return `public incident feed reachable · ${incidentCount} active · not workload health`;
  }
  return `Azure public Entra signal ${stateLabel(source.status)} · not tenant health`;
}

export function Microsoft365CriticalSuite({ model }: { model: IssueConsoleModel | null }): JSX.Element {
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).get('m365') === '1');
  const snapshot = useMemo(() => microsoft365CoverageSnapshot(model), [model]);
  const microsoftTone = microsoft365PublicSignalTone(snapshot.microsoft365);
  const entraTone = microsoft365PublicSignalTone(snapshot.entra);
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
      : snapshot.publicSignalsPresent > 0
        ? 'informational'
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
          <b>Microsoft workload truth</b>
          <small>{activeMicrosoftIncidents.length} public incidents · {snapshot.serviceFacetCount} workload facets · tenant health private</small>
        </span>
        <em>{overallTone === 'informational' ? 'public clear' : overallTone}</em>
      </button>

      {open ? (
        <div className="m365-layer" role="presentation" data-m365-critical-suite="open" onMouseDown={event => {
          if (event.currentTarget === event.target) setOpen(false);
        }}>
          <section className="m365-shell" role="dialog" aria-modal="true" aria-label="Microsoft 365 critical coverage">
            <header className="m365-header">
              <div>
                <span>Microsoft workload truth</span>
                <h2>Microsoft 365 coverage</h2>
                <p>Microsoft is not one health state. Public sources can confirm a published incident, but current Exchange, Teams, SharePoint, OneDrive, Intune, Apps, Defender, Power Platform, and tenant-specific Entra health come from tenant Service Health. A clear public feed never green-lights the whole Microsoft estate.</p>
              </div>
              <button type="button" aria-label="Close Microsoft 365 coverage" onClick={() => setOpen(false)}>×</button>
            </header>

            <div className="m365-summary-grid">
              <button
                type="button"
                className={`m365-source-card is-${microsoftTone}`}
                data-provider-id="microsoft365"
                data-source-role="public-incident-fallback"
                data-service-state={snapshot.microsoft365?.serviceState || 'unknown'}
                data-evidence-tone={microsoftEvidenceTone}
                onClick={() => openProvider('microsoft365')}
              >
                <span>Public incident fallback</span>
                <strong>{snapshot.microsoft365?.provider || 'Microsoft 365 public status'}</strong>
                <small>{publicSourceSummary('Microsoft 365', snapshot.microsoft365, snapshot.microsoft365Incidents.length)}</small>
              </button>
              <button
                type="button"
                className={`m365-source-card is-${entraTone}`}
                data-provider-id="entra"
                data-source-role="azure-public-entra"
                data-service-state={snapshot.entra?.serviceState || 'unknown'}
                data-evidence-tone={entraEvidenceTone}
                onClick={() => openProvider('entra')}
              >
                <span>Azure public Entra signal</span>
                <strong>{snapshot.entra?.provider || 'Microsoft Entra ID'}</strong>
                <small>{publicSourceSummary('Microsoft Entra ID', snapshot.entra, snapshot.entraIncidents.length)}</small>
              </button>
              <div className="m365-source-card is-boundary" data-health-authority="tenant-service-health">
                <span>Tenant workload authority</span>
                <strong>Microsoft 365 Service Health</strong>
                <small>Microsoft Graph {MICROSOFT_GRAPH_SERVICE_HEALTH_PERMISSION} · authoritative per subscribed tenant service</small>
              </div>
            </div>

            <div className="m365-content-grid">
              <main>
                <div className="m365-section-heading">
                  <div><span>Coverage matrix</span><h3>Core MSP Microsoft estate</h3></div>
                  <b>{snapshot.serviceFacetCount} tracked facets · {snapshot.tenantGranularFacetCount} tenant-authoritative</b>
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
                        data-health-authority="tenant-service-health"
                        data-public-incident-count={assessment.publicIncidentCount}
                        data-public-service-state={publicSource?.serviceState || 'unknown'}
                        data-evidence-tone={assessment.evidenceTone}
                      >
                        <header>
                          <span>{service.label}</span>
                          <em>{service.coverageMode === 'dedicated-public-with-tenant-health'
                            ? 'Azure public incident signal + tenant health'
                            : 'Tenant health + scoped public incidents'}</em>
                        </header>
                        <p>{service.operatorImpact}</p>
                        <footer>
                          <b>{assessment.serviceLabel}</b>
                          <small>Evidence: {assessment.evidenceLabel}. Health authority: tenant Microsoft 365 Service Health.</small>
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
                  )) : <p>No public incident is currently published in SST. That is not a claim that every Microsoft 365 workload or tenant is healthy.</p>}
                </section>
                <section>
                  <span>Truth boundary</span>
                  <h3>Public incident feeds are not workload health</h3>
                  <p>The unauthenticated Microsoft status surface is useful for broad public incidents and fallback communications. It does not return the tenant-specific service-health table for Exchange, Teams, SharePoint, OneDrive, Intune, Apps, Defender, Power Platform, or other subscribed services.</p>
                </section>
                <section>
                  <span>Tenant authority</span>
                  <h3>One tenant, one subscribed service view</h3>
                  <p>Microsoft 365 Service Health and Graph service communications return health for services subscribed by that tenant. Until a private tenant bridge is connected, those workload cards remain unverified rather than inheriting a green public status.</p>
                </section>
                <section>
                  <span>Backend contract</span>
                  <h3>Graph service communications</h3>
                  <code>{MICROSOFT_GRAPH_HEALTH_OVERVIEWS_PATH}</code>
                  <code>{MICROSOFT_GRAPH_ISSUES_PATH}</code>
                  <p>Least-privilege permission: <b>{MICROSOFT_GRAPH_SERVICE_HEALTH_PERMISSION}</b>. Any tenant bridge must run in an authenticated private backend and must not publish tenant identifiers or tenant-only incident detail to this public app.</p>
                </section>
                <section>
                  <span>Operator rule</span>
                  <h3>Scope first, then tenant health</h3>
                  <p>Act on a public Microsoft incident only for the workload scope Microsoft actually reports. Use tenant Service Health before declaring an individual workload healthy, affected, or recovered, and before changing DNS, identity, mail, endpoint, or collaboration configuration.</p>
                </section>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
