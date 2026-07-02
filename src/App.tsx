import { useEffect, useMemo, useState } from 'react';
import type { Incident, ProviderStatus, StatusColor, StatusPayload } from './types';

const APP_VERSION = 'v7';
const priorityNames = ['Microsoft 365', 'Entra ID', 'Cloudflare', 'AWS', 'Google Workspace', 'OpenAI'];
const rank: Record<StatusColor, number> = { red: 4, amber: 3, blue: 2, green: 1 };

type LoadState = { data?: StatusPayload; error?: string };

async function fetchStatus(): Promise<StatusPayload> {
  const response = await fetch(`status.json?ts=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`status.json returned HTTP ${response.status}`);
  return await response.json() as StatusPayload;
}

function shortTime(value?: string): string {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function labelFor(color: StatusColor): string {
  if (color === 'red') return 'major';
  if (color === 'amber') return 'degraded';
  if (color === 'green') return 'clear';
  return 'limited';
}

function sortProvider(a: ProviderStatus, b: ProviderStatus): number {
  return (rank[b.color] - rank[a.color]) || ((b.priority ?? 0) - (a.priority ?? 0)) || a.name.localeCompare(b.name);
}

function sortIncident(a: Incident, b: Incident): number {
  return (rank[b.color] - rank[a.color]) || (b.priority - a.priority) || String(b.rawTime ?? '').localeCompare(String(a.rawTime ?? ''));
}

function serviceInitials(name: string): string {
  return name.split(/\s+/).map(part => part[0] ?? '').join('').slice(0, 3).toUpperCase();
}

function StatusPixel({ color, title }: { color: StatusColor; title: string }): JSX.Element {
  return <span className={`status-pixel ${color}`} title={title} aria-label={`${title} ${labelFor(color)}`} />;
}

function RadarRing({ red, amber, limited, clear }: { red: number; amber: number; limited: number; clear: number }): JSX.Element {
  return <div className="radar" aria-label="status count radar">
    <div className="radar-core"><strong>{red + amber}</strong><span>impacting</span></div>
    <div className="radar-stat red"><b>{red}</b><span>major</span></div>
    <div className="radar-stat amber"><b>{amber}</b><span>degraded</span></div>
    <div className="radar-stat green"><b>{clear}</b><span>clear</span></div>
    <div className="radar-stat blue"><b>{limited}</b><span>limited</span></div>
  </div>;
}

function PriorityNode({ provider }: { provider: ProviderStatus }): JSX.Element {
  return <article className={`priority-node ${provider.color}`}>
    <b>{serviceInitials(provider.name)}</b>
    <span>{labelFor(provider.color)}</span>
  </article>;
}

function IncidentFocus({ incident }: { incident?: Incident }): JSX.Element {
  if (!incident) return <section className="focus clear"><span>NO ACTIVE INCIDENTS</span><b>All clear</b><p>Readable official feeds report no active issues.</p></section>;
  return <section className={`focus ${incident.color}`}>
    <span>{incident.provider} / {incident.time}</span>
    <b>{incident.title}</b>
    <p>{incident.note}</p>
  </section>;
}

function Ticker({ incidents }: { incidents: Incident[] }): JSX.Element {
  const text = incidents.length
    ? incidents.slice(0, 4).map(incident => `${incident.provider}: ${incident.title}`).join('  •  ')
    : 'No active incidents from readable official status feeds';
  return <div className="ticker"><span>{text}</span></div>;
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
  const sortedProviders = useMemo(() => [...providers].sort(sortProvider), [providers]);
  const priority = useMemo(() => priorityNames.map(name => providers.find(provider => provider.name === name)).filter((provider): provider is ProviderStatus => Boolean(provider)), [providers]);
  const red = providers.filter(provider => provider.color === 'red').length;
  const amber = providers.filter(provider => provider.color === 'amber').length;
  const clear = providers.filter(provider => provider.color === 'green').length;
  const limited = providers.filter(provider => provider.color === 'blue' || !provider.ok).length;

  if (!data) return <main className="tile-shell"><section className="tile loading"><b>{state.error ? 'DATA FAILED' : 'LOADING'}</b><span>{state.error ?? 'Reading status.json'}</span><em>{APP_VERSION}</em></section></main>;

  return <main className="tile-shell">
    <section className={`tile ${data.summary.overall}`}>
      <header className="tile-head">
        <div><b>MSP STATUS</b><em>{APP_VERSION}</em></div>
        <span>{data.summary.active_incident_count} active / {providers.length} sources / {shortTime(data.generated_at)}</span>
      </header>

      <section className="tile-body">
        <RadarRing red={red} amber={amber} limited={limited} clear={clear} />
        <IncidentFocus incident={incidents[0]} />
        <aside className="priority-stack">{priority.map(provider => <PriorityNode key={provider.id} provider={provider} />)}</aside>
      </section>

      <section className="source-ribbon" aria-label="all provider status pixels">
        {sortedProviders.map(provider => <StatusPixel key={provider.id} color={provider.color} title={provider.name} />)}
      </section>

      <Ticker incidents={incidents} />
    </section>
  </main>;
}
