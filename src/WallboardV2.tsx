import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { ProviderIcon } from './providerIcon';
import { relativeAgeAt } from './liveTelemetry';
import type { DataLifecycle } from './types';
import type { ActionItem, IssueConsoleModel } from './statusViewModel';

const EASTERN_TIME_ZONE = 'America/New_York';
const LOOP_SPEED_PX_PER_SECOND = 22;

function clockLabel(now: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(new Date(now));
}

function dateLabel(now: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: '2-digit'
  }).format(new Date(now));
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function timestamp(value?: string): number {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function usePriorityMarquee(
  viewportRef: RefObject<HTMLDivElement>,
  trackRef: RefObject<HTMLDivElement>,
  groupRef: RefObject<HTMLDivElement>,
  itemCount: number
): void {
  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const group = groupRef.current;
    if (!viewport || !track || !group) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let resizeObserver: ResizeObserver | null = null;

    const measure = () => {
      const groupHeight = Math.ceil(group.getBoundingClientRect().height);
      const shouldLoop = !reducedMotion.matches && itemCount > 1 && groupHeight > viewport.clientHeight + 2;

      track.classList.remove('is-looping');
      track.style.removeProperty('--wallboard-loop-distance');
      track.style.removeProperty('--wallboard-loop-duration');

      if (!shouldLoop || groupHeight <= 0) return;

      const durationSeconds = Math.max(12, groupHeight / LOOP_SPEED_PX_PER_SECOND);
      track.style.setProperty('--wallboard-loop-distance', `${groupHeight}px`);
      track.style.setProperty('--wallboard-loop-duration', `${durationSeconds}s`);
      void track.offsetHeight;
      track.classList.add('is-looping');
    };

    const scheduleMeasure = () => window.requestAnimationFrame(measure);
    resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(viewport);
    resizeObserver.observe(group);
    reducedMotion.addEventListener('change', scheduleMeasure);
    scheduleMeasure();

    return () => {
      resizeObserver?.disconnect();
      reducedMotion.removeEventListener('change', scheduleMeasure);
      track.classList.remove('is-looping');
    };
  }, [groupRef, itemCount, trackRef, viewportRef]);
}

function SignalRows({ signals, now, copy = false }: { signals: ActionItem[]; now: number; copy?: boolean }): JSX.Element {
  return (
    <div className={`wallboard-priority-group${copy ? ' wallboard-priority-copy' : ''}`} aria-hidden={copy || undefined}>
      {signals.map(item => (
        <article key={`${copy ? 'copy:' : ''}${item.id}`} className={`attention-${item.attention}`}>
          <span className="wallboard-signal-icon"><ProviderIcon id={item.providerId} name={item.provider} /></span>
          <div><b>{item.provider}</b><h3>{item.title}</h3><p>{item.detail}</p></div>
          <time>{relativeAgeAt(item.updatedAt, now)}</time>
        </article>
      ))}
    </div>
  );
}

export function WallboardV2({
  model,
  lifecycle,
  now,
  onExit
}: {
  model: IssueConsoleModel | null;
  lifecycle: DataLifecycle;
  now: number;
  onExit: () => void;
}): JSX.Element {
  const priorityViewportRef = useRef<HTMLDivElement>(null);
  const priorityTrackRef = useRef<HTMLDivElement>(null);
  const priorityGroupRef = useRef<HTMLDivElement>(null);

  const signals = useMemo(() => (model?.actionQueue || [])
    .filter(item => item.kind === 'incident')
    .sort((a, b) => {
      const timeDifference = timestamp(b.updatedAt) - timestamp(a.updatedAt);
      return timeDifference || a.provider.localeCompare(b.provider) || a.title.localeCompare(b.title);
    }), [model?.actionQueue]);

  const alertProviders = useMemo(() => {
    const seen = new Set<string>();
    return signals.filter(item => {
      if (seen.has(item.providerId)) return false;
      seen.add(item.providerId);
      return true;
    });
  }, [signals]);

  usePriorityMarquee(priorityViewportRef, priorityTrackRef, priorityGroupRef, signals.length);

  const providers = useMemo(() => (model?.diagnostics || [])
    .filter(item => item.attention !== 'informational' || item.sourceHealth !== 'healthy')
    .slice(0, 24), [model?.diagnostics]);

  return (
    <section className="wallboard-shell wallboard-v2">
      <header>
        <div><span>MSP service operations</span><h1>Enterprise service intelligence</h1></div>
        <div className="wallboard-clock"><strong>{clockLabel(now)}</strong><span>{dateLabel(now)} · ET</span></div>
        <div className="wallboard-connection"><span className={`connection-indicator lifecycle-${lifecycle.phase}`} /><b>{titleCase(lifecycle.phase)}</b><small>{relativeAgeAt(model?.generatedAt, now)}</small></div>
        <button className="ui-button ui-button-secondary" type="button" onClick={onExit}>Exit wallboard</button>
      </header>

      <section className="wallboard-kpis">
        <article className="metric-tile"><header><span>Active incidents</span><em>Live</em></header><strong>{model?.incidentCount || 0}</strong></article>
        <article className="metric-tile"><header><span>Affected providers</span><em>Live</em></header><strong>{model?.affectedCount || 0}</strong></article>
        <article className="metric-tile"><header><span>Coverage</span><em>Live</em></header><strong>{model?.summary.coverage_percent || 0}%</strong></article>
        <article className="metric-tile"><header><span>Quality</span><em>Live</em></header><strong>{model?.qualityScore || 0}</strong></article>
        <article className="metric-tile"><header><span>Blind spots</span><em>Live</em></header><strong>{model?.blindSpotCount || 0}</strong></article>
      </section>

      <main>
        <section className="wallboard-priority wallboard-priority-v2">
          <h2><span>Priority signals</span></h2>
          <div className="wallboard-alert-provider-rail" aria-label="Providers with active alerts">
            {alertProviders.map(item => (
              <span key={item.providerId} title={item.provider} aria-label={item.provider}>
                <ProviderIcon id={item.providerId} name={item.provider} />
              </span>
            ))}
          </div>
          <div className="wallboard-priority-list" ref={priorityViewportRef}>
            {signals.length ? (
              <div className="wallboard-priority-track" ref={priorityTrackRef}>
                <div ref={priorityGroupRef}><SignalRows signals={signals} now={now} /></div>
                <SignalRows signals={signals} now={now} copy />
              </div>
            ) : <div className="empty-state"><b>No active vendor incidents</b></div>}
          </div>
        </section>

        <section className="wallboard-providers">
          <h2>Provider watch</h2>
          <div>{providers.map(source => <article key={source.id}><ProviderIcon id={source.id} name={source.provider} /><span><b>{source.provider}</b><small>{titleCase(source.serviceState)} · {titleCase(source.sourceHealth)}</small></span><strong>{source.dataQualityScore}</strong></article>)}</div>
        </section>
      </main>

      <footer><span>{model?.version || 'loading'}</span><span>{model?.collection?.run_id || 'legacy run'}</span><span>First-party public sources · fail closed</span></footer>
    </section>
  );
}
