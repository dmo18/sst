import { useEffect, useMemo, useState } from 'react';
import { ProviderIcon } from './providerIcon';
import type { DataLifecycle } from './types';
import type { DiagnosticSource, IssueConsoleModel } from './statusViewModel';
import { dataAge, gridDimensions, paginate, rotationEnabled, type WallboardScreen, type WallboardSettings } from './wallboard';

const screenOrder: WallboardScreen[] = ['heads-up', 'providers', 'sources'];
const label: Record<WallboardScreen, string> = { 'heads-up': 'Heads Up', providers: 'All Providers', sources: 'Source Health' };
const formatTime = (value: string | Date) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function ProviderTile({ provider }: { provider: DiagnosticSource }): JSX.Element {
  return <article className={`wall-tile service-${provider.serviceState} source-${provider.sourceState}`}>
    <ProviderIcon id={provider.id} name={provider.provider} />
    <div><b>{provider.provider}</b><small>{provider.category}</small></div>
    <strong>{provider.serviceState}</strong><span>source {provider.sourceState}</span>
  </article>;
}

export function Wallboard({ model, lifecycle, settings, onOperator }: { model: IssueConsoleModel | null; lifecycle: DataLifecycle; settings: WallboardSettings; onOperator: () => void }): JSX.Element {
  const [screen, setScreen] = useState(settings.screen);
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [browserCheckedAt, setBrowserCheckedAt] = useState(() => new Date());
  const [viewport, setViewport] = useState(() => ({ width: innerWidth, height: innerHeight }));
  const [wake, setWake] = useState(false);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const grid = gridDimensions(viewport.width, viewport.height, settings.density);
  const pages = useMemo(() => paginate(model?.diagnostics || [], grid.capacity), [model, grid.capacity]);
  const age = dataAge(model?.generatedAt || '', now.getTime());

  useEffect(() => { const tick = window.setInterval(() => setNow(new Date()), 1000); return () => clearInterval(tick); }, []);
  useEffect(() => { const resize = () => setViewport({ width: innerWidth, height: innerHeight }); addEventListener('resize', resize); return () => removeEventListener('resize', resize); }, []);
  useEffect(() => { setPage(0); }, [screen, grid.capacity]);
  useEffect(() => { if (model) setBrowserCheckedAt(new Date()); }, [model]);
  useEffect(() => {
    if (!rotationEnabled(settings.rotateSeconds, reduced)) return;
    const timer = window.setInterval(() => {
      if (screen === 'providers' && page + 1 < pages.length) setPage(value => value + 1);
      else { setPage(0); setScreen(value => screenOrder[(screenOrder.indexOf(value) + 1) % screenOrder.length]); }
    }, settings.rotateSeconds * 1000);
    return () => clearInterval(timer);
  }, [page, pages.length, reduced, screen, settings.rotateSeconds]);

  const toggleWake = async () => {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
    if (!nav.wakeLock) return;
    const lock = await nav.wakeLock.request('screen'); setWake(true);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { void lock.release(); setWake(false); } }, { once: true });
  };
  const fullscreen = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  const sourceProblems = model?.diagnostics.filter(item => item.sourceState !== 'available') || [];

  return <div className={`wallboard density-${settings.density} stale-${age.level}`}>
    <header className="wall-header"><div><p className="eyebrow">MSP status wallboard</p><h1>{label[screen]}</h1></div>
      <div className="wall-clock"><time>{formatTime(now)}</time><span>Generated {model ? formatTime(model.generatedAt) : '—'} · checked {formatTime(browserCheckedAt)} · age {Number.isFinite(age.minutes) ? `${age.minutes}m` : 'unknown'}</span></div>
      <nav>{screenOrder.map(item => <button key={item} aria-pressed={screen === item} onClick={() => setScreen(item)}>{label[item]}</button>)}</nav>
      <div className="wall-actions"><button onClick={() => void fullscreen()}>Fullscreen</button>{'wakeLock' in navigator && <button aria-pressed={wake} onClick={() => void toggleWake()}>Wake {wake ? 'on' : 'lock'}</button>}<button onClick={onOperator}>Operator</button></div>
    </header>
    <div className={`wall-status ${lifecycle.phase}`}>{age.level === 'critical' ? 'CRITICAL: status data is at least 60 minutes old — no current health conclusion.' : age.level === 'warning' ? 'WARNING: status data is at least 40 minutes old.' : lifecycle.phase === 'stale' ? 'Browser refresh failed; retained data may be stale.' : `Coverage ${model?.summary.coverage_percent ?? 0}% · service ${model?.summary.service_overall ?? 'unknown'} · source ${model?.summary.source_overall ?? 'unknown'}`}</div>
    {!model ? <section className="wall-empty"><h2>Status intelligence unavailable</h2><p>No provider is reported operational until a complete valid payload loads.</p></section> : screen === 'heads-up' ?
      <section className="wall-heads"><div className="wall-metrics"><article><span>Active incidents</span><b>{model.incidentCount}</b></article><article><span>Require attention</span><b>{model.attentionCount}</b></article><article><span>Confirmed operational</span><b>{model.summary.confirmed_operational_count}</b></article><article><span>Coverage</span><b>{model.summary.coverage_percent}%</b></article></div><div className="wall-alerts">{model.briefs.length ? model.briefs.map(item => <article key={item.id} className={item.service_state}><b>{item.provider}: {item.title}</b><p>{item.note}</p></article>) : <article><b>No active incident is confirmed.</b><p>Unchecked, limited, and unavailable providers remain unknown; this is not an all-clear.</p></article>}</div></section>
      : screen === 'providers' ? <section className="wall-provider-screen"><div className="wall-grid" style={{ '--grid-columns': grid.columns, '--grid-rows': grid.rows } as React.CSSProperties}>{(pages[page] || []).map(provider => <ProviderTile key={provider.id} provider={provider} />)}</div><footer><button disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1} of {Math.max(1, pages.length)} · {model.diagnostics.length} providers</span><button disabled={page + 1 >= pages.length} onClick={() => setPage(value => value + 1)}>Next</button></footer></section>
      : <section className="wall-sources"><div className="wall-metrics"><article><span>Available</span><b>{model.summary.enabled_provider_count - model.summary.limited_count - model.summary.unavailable_count - model.summary.pending_count - model.summary.stale_count}</b></article><article><span>Limited</span><b>{model.summary.limited_count}</b></article><article><span>Unavailable</span><b>{model.summary.unavailable_count}</b></article><article><span>Stale / pending</span><b>{model.summary.stale_count + model.summary.pending_count}</b></article></div><div className="source-list">{sourceProblems.slice(0, 24).map(item => <ProviderTile key={item.id} provider={item} />)}</div></section>}
  </div>;
}
