import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fullscreenSupported, wakeLockSupported } from './browserCapabilities';
import { ProviderIcon } from './providerIcon';
import type { DataLifecycle } from './types';
import type { DiagnosticSource, IssueConsoleModel } from './statusViewModel';
import { dataAge, formatAge, paginate, providerPageSize, rotationAllowed, SCREEN_LABELS, type WallboardScreen, type WallboardSettings } from './wallboardConfig';

const labelTime = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'unknown';
const labelDate = (date: Date) => date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

const Clock = memo(function Clock({ generatedAt }: { generatedAt: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(id); }, []);
  const age = dataAge(generatedAt, now.getTime());
  return <div className="tv-clock"><time>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time><span>{labelDate(now)} · {formatAge(age.ageMs)}</span></div>;
});

function ProviderTile({ provider }: { provider: DiagnosticSource }) {
  const symbol = provider.serviceState === 'major' ? '!' : provider.serviceState === 'degraded' ? '▲' : provider.serviceState === 'operational' ? '✓' : '?';
  return <article className={`provider-tile state-${provider.serviceState} source-${provider.sourceState}`}>
    <ProviderIcon id={provider.id} name={provider.provider} />
    <div><strong title={provider.provider}>{provider.provider}</strong><span>{symbol} {provider.serviceState}</span></div>
    <small>{provider.sourceState}{provider.changed ? ' · NEW' : ''}</small>
  </article>;
}

function IncidentTile({ incident, stale }: { incident: IssueConsoleModel['briefs'][number]; stale: boolean }) {
  return <article className={`tv-incident state-${incident.service_state}`}>
    <header><ProviderIcon id={incident.providerId} name={incident.provider} /><div><strong>{incident.provider}</strong><span>{incident.service_state} · {incident.attention}</span></div><b>Official source</b></header>
    <h3 title={incident.title}>{incident.title}</h3>
    <p>{incident.affected_service || 'Affected service not specified'} · Updated {labelTime(incident.latest_update)}</p>
    <p className="impact">{incident.client_impact || 'Confirm client impact before communicating.'}</p>
    {stale && <em>Based on stale data</em>}
  </article>;
}

function Metric({ label, value, tone = '' }: { label: string; value: number | string; tone?: string }) { return <div className={`tv-metric ${tone}`}><span>{label}</span><b>{value}</b></div>; }

export function Wallboard({ model, lifecycle, settings, onSettings, onMode, onRefresh, lastSuccess, lastFailure }: {
  model: IssueConsoleModel; lifecycle: DataLifecycle; settings: WallboardSettings; onSettings: (next: Partial<WallboardSettings>) => void; onMode: () => void; onRefresh: () => void; lastSuccess?: string; lastFailure?: string;
}) {
  const [screen, setScreen] = useState<WallboardScreen>(settings.screen);
  const [providerPage, setProviderPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [allowReducedMotionRotation, setAllowReducedMotionRotation] = useState(false);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [wakeEnabled, setWakeEnabled] = useState(() => localStorage.getItem('sst-wake-lock') === 'true');
  const [wakeActive, setWakeActive] = useState(false);
  const wakeRef = useRef<{ release: () => Promise<void>; addEventListener?: (type: string, listener: () => void) => void }>();
  const [ageNow, setAgeNow] = useState(Date.now());
  const latestNewId = model.changes.find(x => x.type === 'incident_new')?.id;
  const [newVisible, setNewVisible] = useState(() => Boolean(latestNewId && localStorage.getItem('sst-last-announced-change') !== latestNewId));
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const age = dataAge(model.generatedAt, ageNow);
  const stale = age.state !== 'normal' || lifecycle.phase === 'stale';
  const enabledProviders = model.diagnostics.filter(x => x.sourceState !== 'disabled');
  const pageSize = providerPageSize(viewport.width, viewport.height, settings.density);
  const providerPages = useMemo(() => paginate(enabledProviders, pageSize), [enabledProviders, pageSize]);
  const sourceProviders = model.diagnostics.filter(x => ['unavailable', 'limited', 'stale', 'disabled'].includes(x.sourceState));
  const sourcePages = useMemo(() => paginate(sourceProviders, pageSize), [sourceProviders, pageSize]);
  const availableScreens = useMemo<WallboardScreen[]>(() => sourceProviders.length ? ['heads-up', 'providers', 'sources'] : ['heads-up', 'providers'], [sourceProviders.length]);
  const critical = model.briefs.some(x => x.attention === 'critical');

  useEffect(() => { setScreen(settings.screen); }, [settings.screen]);
  useEffect(() => { const id = window.setInterval(() => setAgeNow(Date.now()), 60_000); return () => window.clearInterval(id); }, []);
  useEffect(() => { if (!latestNewId || !newVisible) return; const id = window.setTimeout(() => { localStorage.setItem('sst-last-announced-change', latestNewId); setNewVisible(false); }, 120_000); return () => window.clearTimeout(id); }, [latestNewId, newVisible]);
  useEffect(() => { const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight }); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
  useEffect(() => { const update = () => setFullscreen(Boolean(document.fullscreenElement)); document.addEventListener('fullscreenchange', update); return () => document.removeEventListener('fullscreenchange', update); }, []);
  useEffect(() => {
    if (!rotationAllowed(settings.rotateSeconds, paused, window.matchMedia('(prefers-reduced-motion: reduce)').matches, allowReducedMotionRotation)) return;
    const id = window.setInterval(() => {
      if (critical) { setScreen('heads-up'); return; }
      if ((screen === 'providers' || screen === 'sources') && providerPage < (screen === 'providers' ? providerPages.length : sourcePages.length) - 1) { setProviderPage(page => page + 1); return; }
      setProviderPage(0); const index = availableScreens.indexOf(screen); const next = availableScreens[(index + 1) % availableScreens.length]; setScreen(next); onSettings({ screen: next });
    }, settings.rotateSeconds * 1000);
    return () => window.clearInterval(id);
  }, [allowReducedMotionRotation, availableScreens, critical, onSettings, paused, providerPage, providerPages.length, sourcePages.length, screen, settings.rotateSeconds]);

  const requestWake = useCallback(async () => {
    if (!wakeEnabled || document.hidden || !wakeLockSupported()) return;
    try { const lock = await (navigator as Navigator & { wakeLock: { request: (type: 'screen') => Promise<typeof wakeRef.current> } }).wakeLock.request('screen'); wakeRef.current = lock; setWakeActive(true); lock?.addEventListener?.('release', () => setWakeActive(false)); } catch { setWakeActive(false); }
  }, [wakeEnabled]);
  useEffect(() => { const visible = () => { if (!document.hidden) void requestWake(); }; document.addEventListener('visibilitychange', visible); return () => document.removeEventListener('visibilitychange', visible); }, [requestWake]);
  useEffect(() => { if (wakeEnabled) void requestWake(); }, [requestWake, wakeEnabled]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => { if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey && !/input|select|textarea/i.test((event.target as HTMLElement)?.tagName || '')) { event.preventDefault(); if (fullscreen) void document.exitFullscreen(); else if (fullscreenSupported()) void document.documentElement.requestFullscreen(); } };
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  }, [fullscreen]);
  useEffect(() => () => { void wakeRef.current?.release(); }, []);

  const changeScreen = (next: WallboardScreen) => { setPaused(true); setProviderPage(0); setScreen(next); onSettings({ screen: next }); };
  const activePages = screen === 'providers' ? providerPages : screen === 'sources' ? sourcePages : [[]];
  const pageTotal = activePages.length;
  const page = providerPage + 1;
  const criticalCount = model.diagnostics.filter(x => x.attention === 'critical').length;
  const actionCount = model.diagnostics.filter(x => x.attention === 'action').length;
  return <div className={`wallboard density-${settings.density} stale-${age.state}`} data-view-mode="wallboard" data-screen={screen}>
    <header className="tv-status-bar">
      <div className="tv-brand"><span>MSP operations</span><h1>Service Heads-Up</h1></div>
      <Clock generatedAt={model.generatedAt} />
      <div className="tv-data-times"><span>Generated {labelTime(model.generatedAt)}</span><span>Browser check {labelTime(lastSuccess)}</span>{lastFailure && <span>Last failure {labelTime(lastFailure)}</span>}</div>
      <div className="tv-overall"><span>Service <b>{stale ? 'unknown' : model.summary.service_overall}</b></span><span>Sources <b>{model.summary.source_overall}</b></span><span>Coverage <b>{model.summary.coverage_percent}%</b></span></div>
      <div className="tv-tools"><button onClick={async () => { if (!fullscreen && fullscreenSupported()) await document.documentElement.requestFullscreen(); else if (fullscreen) await document.exitFullscreen(); }} disabled={!fullscreenSupported()}>{fullscreen ? 'Exit full screen' : 'Full screen'}</button><button onClick={async () => { const next = !wakeEnabled; setWakeEnabled(next); localStorage.setItem('sst-wake-lock', String(next)); if (next) { setWakeEnabled(true); } else { await wakeRef.current?.release(); setWakeActive(false); } }}>{wakeActive ? 'Awake ✓' : wakeEnabled ? 'Wake pending' : 'Keep awake'}</button></div>
    </header>
    <div className="tv-alerts">{newVisible && <div className="tv-new-incident" role="status">New incident detected — review the Heads Up screen.</div>}{stale && <div className="tv-stale" role="status">{age.state === 'critical' || age.state === 'invalid' ? 'CRITICAL: status data is stale or invalid' : 'Warning: status data is aging'} — active incidents remain visible but are not current. {lastFailure && 'Latest browser refresh failed.'}</div>}</div>
    <section className="tv-metrics" aria-label="Technician heads-up metrics">
      <Metric label="Critical" value={criticalCount} tone="critical"/><Metric label="Action" value={actionCount}/><Metric label="Major" value={model.summary.major_count}/><Metric label="Degraded" value={model.summary.degraded_count}/><Metric label="New" value={model.newIncidentCount}/><Metric label="Resolved" value={model.resolvedCount}/><Metric label="New source gaps" value={model.newUnavailableCount}/><Metric label="Operational" value={model.summary.confirmed_operational_count}/><Metric label="Limited" value={model.summary.limited_count}/><Metric label="Unavailable" value={model.summary.unavailable_count}/>
    </section>
    <main className="tv-content">
      {screen === 'heads-up' && <section className="tv-heads-up"><header><h2>Confirmed active incidents</h2><span>{model.incidentCount ? `${model.incidentCount} require review` : 'No confirmed active incidents'}</span></header><div className="tv-incident-grid">{model.briefs.length ? model.briefs.slice(0, viewport.height <= 740 ? 2 : 4).map(x => <IncidentTile key={x.id} incident={x} stale={stale}/>) : <div className="tv-healthy"><h3>No confirmed active incidents</h3><p>{model.summary.confirmed_operational_count} providers explicitly operational · {model.summary.coverage_percent}% source coverage</p><p>{model.summary.limited_count} limited · {model.summary.unavailable_count} unavailable · unchecked providers are not treated as healthy</p><p>Next scheduled generation is normally within 30 minutes.</p></div>}</div><div className="tv-actions"><h3>Technician attention</h3>{model.diagnostics.filter(x => x.attention !== 'informational').slice(0, 4).map(x => <span key={x.id}><b>{x.provider}</b> — {x.technicianAction || x.status}</span>)}</div></section>}
      {screen === 'providers' && <section className="tv-provider-screen"><header><h2>All enabled providers</h2><span>{enabledProviders.length} providers · page {page} of {pageTotal}</span></header><div className="provider-tile-grid">{providerPages[providerPage]?.map(x => <ProviderTile key={x.id} provider={x}/>)}</div></section>}
      {screen === 'sources' && <section className="tv-source-screen"><header><h2>Official source health</h2><p>A source gap does not prove a vendor outage. {model.summary.unavailable_count} unavailable · {model.summary.limited_count} limited · {model.summary.stale_count} stale · {model.summary.disabled_count} disabled.</p></header><div className="provider-tile-grid source-tile-grid">{sourcePages[providerPage]?.map(x => <ProviderTile key={x.id} provider={x}/>)}</div></section>}
    </main>
    <footer className="tv-page-controls"><nav aria-label="Wallboard screens">{availableScreens.map(value => <button key={value} aria-pressed={screen === value} onClick={() => changeScreen(value)}>{SCREEN_LABELS[value]}</button>)}</nav><span>Page {page} / {pageTotal} · {paused || !settings.rotateSeconds ? 'rotation paused' : `rotates every ${settings.rotateSeconds}s`}</span><div><button onClick={() => { setPaused(true); setProviderPage(Math.max(0, providerPage - 1)); }}>Previous</button><button onClick={() => { if (paused) setAllowReducedMotionRotation(true); setPaused(value => !value); }}>{paused ? 'Resume' : 'Pause'}</button><button onClick={() => { setPaused(true); setProviderPage(Math.min(activePages.length - 1, providerPage + 1)); }}>Next</button><button onClick={onRefresh}>Check now</button><button onClick={onMode}>Operator mode</button></div></footer>
  </div>;
}
