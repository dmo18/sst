import { useEffect, useMemo, useState } from 'react';
import type { Incident, ProviderStatus, StatusColor, StatusPayload } from './types';

const priorityNames = ['Microsoft 365', 'Entra ID', 'Cloudflare', 'AWS', 'Google Workspace', 'OpenAI'];
const rank: Record<StatusColor, number> = { red: 4, amber: 3, blue: 2, green: 1 };

type LoadState = { data?: StatusPayload; error?: string };

async function fetchStatus(): Promise<StatusPayload> {
  const local = `status.json?ts=${Date.now()}`;
  const response = await fetch(local, { cache: 'no-store' });
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
  if (color === 'green') return 'Operational';
  return 'Limited';
}

function groupProviders(providers: ProviderStatus[]): Array<[string, ProviderStatus[]]> {
  const map = new Map<string, ProviderStatus[]>();
  for (const provider of providers) map.set(provider.category, [...(map.get(provider.category) ?? []), provider]);
  return [...map.entries()].map(([name, items]) => [name, items.sort(sortProvider)]);
}

function sortProvider(a: ProviderStatus, b: ProviderStatus): number {
  return (rank[b.color] - rank[a.color]) || ((b.priority ?? 0) - (a.priority ?? 0)) || a.name.localeCompare(b.name);
}

function Dot({ color }: { color: StatusColor }): JSX.Element {
  return <span className={`dot ${color}`} />;
}

function Stat({ label, value, detail }: { label: string; value: string | number; detail: string }): JSX.Element {
  return <div className="stat"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function IncidentCard({ incident, feature = false }: { incident: Incident; feature?: boolean }): JSX.Element {
  return <article className={`incident ${incident.color} ${feature ? 'feature' : ''}`}>
    <header><b>{incident.provider}</b><time>{incident.time}</time></header>
    <h3>{incident.title}</h3>
    <p>{incident.note}</p>
    <footer><span>{incident.status || labelFor(incident.color)}</span><span>{incident.source}</span></footer>
  </article>;
}

function ProviderRow({ provider }: { provider: ProviderStatus }): JSX.Element {
  return <div className={`provider ${provider.color}`}>
    <Dot color={provider.color} />
    <div><b>{provider.name}</b><span>{provider.status}</span></div>
    <small>{provider.ok ? 'Readable' : 'Limited'}</small>
  </div>;
}

function Category({ name, providers }: { name: string; providers: ProviderStatus[] }): JSX.Element {
  const issues = providers.filter(provider => provider.color === 'red' || provider.color === 'amber').length;
  return <section className="category"><header><h3>{name}</h3><span>{issues} issues / {providers.length}</span></header>{providers.map(provider => <ProviderRow key={provider.id} provider={provider} />)}</section>;
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
  const groups = useMemo(() => groupProviders(data?.providers ?? []), [data]);
  const sorted = useMemo(() => [...(data?.providers ?? [])].sort(sortProvider), [data]);

  if (!data) return <main className="shell"><div className="loading"><b>{state.error ? 'Status data failed' : 'Loading status data'}</b><span>{state.error ?? 'Reading status.json'}</span></div></main>;

  const incidents = data.incidents ?? [];
  const priority = priorityNames.map(name => data.providers.find(provider => provider.name === name)).filter((provider): provider is ProviderStatus => Boolean(provider));
  const green = data.providers.filter(provider => provider.color === 'green').length;
  const limited = data.providers.filter(provider => provider.color === 'blue' || !provider.ok).length;

  return <main className="shell">
    <header className="hero">
      <div><p>MSP Status Aggregator</p><h1>Service health dashboard</h1><span>Updated {timeLabel(data.generated_at)}. Official provider status sources only.</span></div>
      <div className={`badge ${data.summary.overall}`}><Dot color={data.summary.overall} /><b>{labelFor(data.summary.overall)}</b><span>{data.summary.active_incident_count} active</span></div>
    </header>

    <section className="stats">
      <Stat label="Active incidents" value={data.summary.active_incident_count} detail="from official feeds" />
      <Stat label="Operational" value={green} detail="green providers" />
      <Stat label="Limited" value={limited} detail="listed but limited" />
      <Stat label="Sources" value={`${data.summary.providers_ok}/${data.summary.providers_total}`} detail="reachable in Action" />
    </section>

    <section className="priority">{priority.map(provider => <div key={provider.id} className={`pill ${provider.color}`}><Dot color={provider.color} /><b>{provider.name}</b><span>{provider.status}</span></div>)}</section>

    <section className="workarea">
      <section className="panel active"><header><div><p>Active issues</p><h2>What needs attention now</h2></div><span>{incidents.length} total</span></header>{incidents.length ? <div className="incident-list">{incidents.slice(0, 6).map((incident, index) => <IncidentCard key={`${incident.providerId}-${incident.title}`} incident={incident} feature={index === 0} />)}</div> : <div className="clear"><b>All clear</b><span>No active incidents from readable official feeds.</span></div>}</section>
      <aside className="panel watch"><header><div><p>Priority watch</p><h2>Severity sorted</h2></div></header>{sorted.slice(0, 14).map(provider => <ProviderRow key={provider.id} provider={provider} />)}</aside>
    </section>

    <section className="panel matrix"><header><div><p>All sources</p><h2>Provider matrix</h2></div><span>{data.providers.length} providers</span></header><div className="categories">{groups.map(([name, providers]) => <Category key={name} name={name} providers={providers} />)}</div></section>
  </main>;
}
