import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { ProviderIcon } from './providerIcon';
import { relativeAgeAt } from './liveTelemetry';
import type { DataLifecycle } from './types';
import type { IssueConsoleModel } from './statusViewModel';

const EASTERN_TIME_ZONE = 'America/New_York';
const CAROUSEL_START_DELAY_MS = 2600;
const CAROUSEL_STEP_MS = 5200;

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

function usePriorityCarousel(listRef: RefObject<HTMLDivElement>, itemCount: number): void {
  useEffect(() => {
    const list = listRef.current;
    if (!list || itemCount < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let stepTimer = 0;
    let startTimer = 0;
    let resizeObserver: ResizeObserver | null = null;
    let currentIndex = 0;

    const rows = () => Array.from(list.querySelectorAll<HTMLElement>(':scope > article'));
    const hasOverflow = () => list.scrollHeight > list.clientHeight + 2;

    const showIndex = (index: number, behavior: ScrollBehavior) => {
      const items = rows();
      if (!items.length) return;
      currentIndex = ((index % items.length) + items.length) % items.length;
      list.scrollTo({ top: items[currentIndex].offsetTop, behavior });
    };

    const advance = () => {
      if (!hasOverflow()) {
        if (list.scrollTop !== 0) list.scrollTo({ top: 0, behavior: 'auto' });
        currentIndex = 0;
        return;
      }

      const items = rows();
      if (!items.length) return;
      showIndex(currentIndex + 1 >= items.length ? 0 : currentIndex + 1, 'smooth');
    };

    const start = () => {
      window.clearInterval(stepTimer);
      stepTimer = window.setInterval(advance, CAROUSEL_STEP_MS);
    };

    startTimer = window.setTimeout(start, CAROUSEL_START_DELAY_MS);
    resizeObserver = new ResizeObserver(() => {
      const items = rows();
      if (!items.length) return;
      const nearest = items.reduce((best, item, index) => {
        const distance = Math.abs(item.offsetTop - list.scrollTop);
        return distance < best.distance ? { index, distance } : best;
      }, { index: 0, distance: Number.POSITIVE_INFINITY });
      currentIndex = nearest.index;
      showIndex(currentIndex, 'auto');
    });
    resizeObserver.observe(list);

    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(stepTimer);
      resizeObserver?.disconnect();
    };
  }, [itemCount, listRef]);
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
  const priorityListRef = useRef<HTMLDivElement>(null);

  const signals = useMemo(() => (model?.actionQueue || [])
    .filter(item => item.kind === 'incident')
    .sort((a, b) => {
      const timeDifference = timestamp(b.updatedAt) - timestamp(a.updatedAt);
      return timeDifference || a.provider.localeCompare(b.provider) || a.title.localeCompare(b.title);
    }), [model?.actionQueue]);

  usePriorityCarousel(priorityListRef, signals.length);

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
          <div className="wallboard-priority-list" ref={priorityListRef}>
            {signals.length ? signals.map(item => (
              <article key={item.id} className={`attention-${item.attention}`}>
                <span className="wallboard-signal-icon"><ProviderIcon id={item.providerId} name={item.provider} /></span>
                <div><b>{item.provider}</b><h3>{item.title}</h3><p>{item.detail}</p></div>
                <time>{relativeAgeAt(item.updatedAt, now)}</time>
              </article>
            )) : <div className="empty-state"><b>No active vendor incidents</b></div>}
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
