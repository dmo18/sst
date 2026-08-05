import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { ProviderIcon } from './providerIcon';
import { relativeAgeAt } from './liveTelemetry';
import type { DataLifecycle } from './types';
import type { IssueConsoleModel } from './statusViewModel';

const EASTERN_TIME_ZONE = 'America/New_York';
const LOOP_START_DELAY_MS = 2600;
const LOOP_RESET_DELAY_MS = 1500;
const LOOP_SPEED_PX_PER_SECOND = 18;

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

function usePriorityAutoLoop(listRef: RefObject<HTMLDivElement>): void {
  const paused = useRef(false);

  useEffect(() => {
    const list = listRef.current;
    if (!list || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let lastFrame = performance.now();
    let resumeAt = lastFrame + LOOP_START_DELAY_MS;
    let resetTimer = 0;

    const animate = (now: number) => {
      const maximum = Math.max(0, list.scrollHeight - list.clientHeight);
      const elapsed = Math.min(64, now - lastFrame);
      lastFrame = now;

      if (!paused.current && maximum > 2 && now >= resumeAt) {
        list.scrollTop = Math.min(maximum, list.scrollTop + elapsed * LOOP_SPEED_PX_PER_SECOND / 1000);
        if (list.scrollTop >= maximum - 1 && !list.classList.contains('is-loop-resetting')) {
          list.classList.add('is-loop-resetting');
          resetTimer = window.setTimeout(() => {
            list.scrollTop = 0;
            list.classList.remove('is-loop-resetting');
          }, 260);
          resumeAt = now + LOOP_RESET_DELAY_MS;
        }
      }

      frame = window.requestAnimationFrame(animate);
    };

    const pause = () => { paused.current = true; };
    const resume = () => {
      paused.current = false;
      resumeAt = performance.now() + 900;
    };

    list.addEventListener('pointerenter', pause);
    list.addEventListener('pointerleave', resume);
    list.addEventListener('focusin', pause);
    list.addEventListener('focusout', resume);
    frame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(resetTimer);
      list.removeEventListener('pointerenter', pause);
      list.removeEventListener('pointerleave', resume);
      list.removeEventListener('focusin', pause);
      list.removeEventListener('focusout', resume);
    };
  }, [listRef]);
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
  usePriorityAutoLoop(priorityListRef);

  const signals = useMemo(() => [...(model?.actionQueue || [])].sort((a, b) => {
    const timeDifference = timestamp(b.updatedAt) - timestamp(a.updatedAt);
    return timeDifference || a.provider.localeCompare(b.provider) || a.title.localeCompare(b.title);
  }), [model?.actionQueue]);

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
            )) : <div className="empty-state"><b>No immediate operator actions</b></div>}
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
