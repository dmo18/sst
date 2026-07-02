import { useEffect, useMemo, useState } from 'react';
import type { Incident, ProviderStatus, StatusColor, StatusPayload } from './types';

const APP_VERSION = 'v6';
const primaryNames = ['Microsoft 365', 'Entra ID', 'Cloudflare', 'AWS', 'Google Workspace', 'OpenAI'];
const rank: Record<StatusColor, number> = { red: 4, amber: 3, blue: 2, green: 1 };

type LoadState = { data?: StatusPayload; error?: string };
type ProviderGroup = [string, ProviderStatus[]];

async function fetchStatus(): Promise<StatusPayload> {
  const response = await fetch(`status.json?ts=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`status.json returned HTTP ${response.status}`);
  return await response.json() as StatusPayload;
}

function timeLabel(value?: string): string {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function labelFor(color: StatusColor): string {
  if (color === 'red') return 'Major';
  if (color === 'amber') return 'Degraded';
  if (color === 'green') return 'Clear';
  return 'Limited';
}

function sortProvider(a: ProviderStatus, b: ProviderStatus): number {
  return (rank[b.color] - rank[a.color]) || ((b.priority ?? 0) - (a.priority ?? 0)) || a.name.localeCompare(b.name);
}

function sortIncident(a: Incident, b: Incident): number {
  return (rank[b.color] - rank[a.color]) || (b.priority - a.priority) || String(b.rawTime ?? '').localeCompare(String(a.rawTime ?? ''));
}

function groupProviders(providers: ProviderStatus[]): ProviderGroup[] {
  const map = new Map<string, ProviderStatus[]>();
  for (const provider of providers) {
    const existing = map.get(provider.category) ?? [];
    map.set(provider.category, [...existing, provider]);
  }
  return Array.from(map.entries())
    .map(([name, items]): ProviderGroup => [name, [...items].sort(sortProvider)])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

function Dot({ color }: { color: StatusColor }): JSX.Element {
  return <span className={`dot ${color}`} aria-hidden="true" />;
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: StatusColor }): JSX.Element {
  return <div className={`metric ${tone ?? 'blue'}`}><span>{label}</span><strong>{value}</strong></div>;
}

function PrimaryTile({ provider }: { provider: ProviderStatus }): JSX.Element {
  return <article className={`primary-tile ${provider.color}`}>
    <div><Dot color={provider.color} /><b>{provider.name}</b></div>
    <strong>{labelFor(provider.color)}</strong>
    <span>{provider.status}</span>
  </article>;
}

function IncidentPanel({ incident }: { incident: Incident }): JSX.Element {
  return <article className={`incident-panel ${incident.color}`}>
    <div className="incident-kicker"><span>{incident.provider}</span><time>{incident.time}</time></div>
    <h2>{incident.title}</h2>
    <p>{incident.note}</p>
    <div className="incident-meta"><span>{incident.status || labelFor(incident.color)}</span><span>{incident.source}</span></div>
  </article>;
}

function IncidentLine({ incident }: { incident: Incident }): JSX.Element {
  return <article className={`incident-line ${incident.color}`}>
    <Dot color={incident.color} />
    <div><b>{incident.provider}</b><span>{incident.title}</span></div>
    <time>{incident.time}</time>
  </article>;
}

function ProviderLine({ provider }: { provider: ProviderStatus }): JSX.Element {
  return <div className={`provider-line ${provider.color}`}>
    <Dot color={provider.color} />
    <div><b>{provider.name}</b><span>{provider.status}</span></div>
    <small>{provider.ok ? 'readable' : 'limited'}</small>
  </div>;
}

function SourceGroup({ name, providers }: { name: string; providers: ProviderStatus[] }): JSX.Element {
  return <section className="source-group">
    <header><h3>{name}</h3><span>{providers.length}</span></header>
    {providers.map(provider => <ProviderLine key={provider.id} provider={provider} />)}
  </section>;
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
  const providers = data?.providers ?? [];
  const incidents = useMemo(() => [...(data?.incidents ?? [])].sort(sortIncident), [data]);
  const groups = useMemo(() => groupProviders(providers), [providers]);
  const primary = useMemo(() => primaryNames.map(name => providers.find(provider => provider.name === name)).filter((provider): provider is ProviderStatus => Boolean(provider)), [providers]);
  const red = providers.filter(provider => provider.color === 'red').length;
  const amber = providers.filter(provider => provider.color === 'amber').length;
  const green = providers.filter(provider => provider.color === 'green').length;
  const limited = providers.filter(provider => provider.color === 'blue' || !provider.ok).length;

  if (!data) return <main className="command"><section className="boot"><b>{state.error ? 'Status data failed' : 'Loading status wall'}</b><span>{state.error ?? 'Reading generated status.json'}</span><em>{APP_VERSION}</em></section></main>;

  return <main className="command">
    <header className={`mast ${data.summary.overall}`}>
      <div className="mast-left">
        <p>MSP STATUS WALL <em>{APP_VERSION}</em></p>
        <h1>{labelFor(data.summary.overall)} service posture</h1>
        <span>Updated {timeLabel(data.generated_at)} from official provider status sources.</span>
      </div>
      <div className="mast-count"><strong>{data.summary.active_incident_count}</strong><span>active incidents</span></div>
    </header>

    <section className="metrics">
      <Metric label="Major" value={red} tone="red" />
      <Metric label="Degraded" value={amber} tone="amber" />
      <Metric label="Clear" value={green} tone="green" />
      <Metric label="Limited" value={limited} tone="blue" />
      <Metric label="Sources" value={`${data.summary.providers_ok}/${data.summary.providers_total}`} tone="blue" />
    </section>

    <section className="primary-grid">{primary.map(provider => <PrimaryTile key={provider.id} provider={provider} />)}</section>

    <section className="main-grid">
      <section className="now-card">
        <header><p>NOW</p><h2>Active incident detail</h2></header>
        {incidents[0] ? <IncidentPanel incident={incidents[0]} /> : <div className="empty"><b>All clear</b><span>No active incidents from readable official feeds.</span></div>}
      </section>

      <section className="queue-card">
        <header><p>QUEUE</p><h2>Next issues</h2></header>
        <div className="queue-list">{incidents.slice(1, 8).map(incident => <IncidentLine key={`${incident.providerId}-${incident.title}`} incident={incident} />)}{incidents.length <= 1 ? <div className="empty compact">No additional active issues.</div> : null}</div>
      </section>
    </section>

    <section className="sources-card">
      <header><p>SOURCES</p><h2>Provider health matrix</h2><span>{providers.length} providers</span></header>
      <div className="source-grid">{groups.map(([name, items]) => <SourceGroup key={name} name={name} providers={items} />)}</div>
    </section>
  </main>;
}
