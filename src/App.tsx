import { useEffect, useMemo, useState } from 'react';
import type { Incident, ProviderStatus, StatusColor, StatusPayload } from './types';

const APP_VERSION = 'v8';
const rank: Record<StatusColor, number> = { red: 4, amber: 3, blue: 2, green: 1 };

type LoadState = { data?: StatusPayload; error?: string };

async function fetchStatus(): Promise<StatusPayload> {
  const response = await fetch(`status.json?ts=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`status.json returned HTTP ${response.status}`);
  return await response.json() as StatusPayload;
}

function sortIncident(a: Incident, b: Incident): number {
  return (rank[b.color] - rank[a.color]) || (b.priority - a.priority) || String(b.rawTime ?? '').localeCompare(String(a.rawTime ?? ''));
}

function sortProvider(a: ProviderStatus, b: ProviderStatus): number {
  return (rank[b.color] - rank[a.color]) || ((b.priority ?? 0) - (a.priority ?? 0)) || a.name.localeCompare(b.name);
}

function labelFor(color: StatusColor): string {
  if (color === 'red') return 'major';
  if (color === 'amber') return 'degraded';
  if (color === 'green') return 'ok';
  return 'limited';
}

function timeLabel(value?: string): string {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function IssueCard({ incident, featured = false }: { incident: Incident; featured?: boolean }): JSX.Element {
  return <article className={`issue-card ${incident.color} ${featured ? 'featured' : ''}`}>
    <header><b>{incident.provider}</b><span>{incident.status || labelFor(incident.color)}</span></header>
    <h2>{incident.title}</h2>
    <p>{incident.note}</p>
    <footer><time>{incident.time}</time><span>{incident.source}</span></footer>
  </article>;
}

function EmptyPanel(): JSX.Element {
  return <section className="empty-panel"><b>No active issues</b><span>Readable official status feeds are clear.</span></section>;
}

function DiagRow({ provider }: { provider: ProviderStatus }): JSX.Element {
  return <tr className={provider.color}>
    <td><span className={`diag-dot ${provider.color}`} />{provider.name}</td>
    <td>{labelFor(provider.color)}</td>
    <td>{provider.status}</td>
    <td><a href={provider.source} target="_blank" rel="noreferrer">{provider.source}</a></td>
  </tr>;
}

export function App(): JSX.Element {
  const [state, setState] = useState<LoadState>({});

  useEffect(() => {
    let active = true;
    async function refresh(): Promise<void> {
      try {
        const data = await fetchStatus();
        if (active) setState({ data });
      } catch (error) {
        if (active) setState(previous => ({ ...previous, error: error instanceof Error ? error.message : String(error) }));
      }
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), 60000);
    return () => { active = false; window.clearInterval(id); };
  }, []);

  const data = state.data;
  const incidents = useMemo(() => [...(data?.incidents ?? [])].sort(sortIncident), [data]);
  const providers = useMemo(() => [...(data?.providers ?? [])].sort(sortProvider), [data]);
  const issueProviders = providers.filter(provider => provider.color === 'red' || provider.color === 'amber');

  if (!data) return <main className="app-frame"><section className="control-panel loading"><b>{state.error ? 'DATA FAILED' : 'LOADING'}</b><span>{state.error ?? 'Reading status.json'}</span><em>{APP_VERSION}</em></section></main>;

  return <main className="app-frame">
    <section className={`control-panel ${data.summary.overall}`}>
      <header className="control-head">
        <div><b>ISSUES ONLY</b><em>{APP_VERSION}</em></div>
        <span>{incidents.length} active incidents</span>
      </header>

      {incidents.length ? <section className="issue-grid">
        <IssueCard incident={incidents[0]} featured />
        <div className="issue-list">{incidents.slice(1, 4).map(incident => <IssueCard key={`${incident.providerId}-${incident.title}`} incident={incident} />)}</div>
      </section> : <EmptyPanel />}
    </section>

    <section className="diag-panel">
      <header><div><b>DIAGNOSTIC PROVIDER LIST</b><span>Testing only. Shows every source, status, and URL.</span></div><em>{providers.length} providers / {issueProviders.length} issue sources / updated {timeLabel(data.generated_at)}</em></header>
      <table>
        <thead><tr><th>Provider</th><th>Status</th><th>Message</th><th>URL</th></tr></thead>
        <tbody>{providers.map(provider => <DiagRow key={provider.id} provider={provider} />)}</tbody>
      </table>
    </section>
  </main>;
}
