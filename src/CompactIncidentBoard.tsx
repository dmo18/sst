import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ProviderIcon } from './providerIcon';
import { compactCountdown, compactDescription, compactHeadline, compactSignals } from './compactWallboard';
import type { ActionItem } from './statusViewModel';
import type { DataLifecycle } from './types';

function age(value: string | number | null | undefined, now: number): string {
  const time = typeof value === 'number' ? value : Date.parse(value || '');
  if (!Number.isFinite(time) || time <= 0) return '—';
  const minutes = Math.max(0, Math.floor((now - time) / 60000));
  return minutes < 1 ? 'now' : minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`;
}

export function CompactIncidentBoard({ signals, now, generatedAt, nextRefreshAt, validCount, invalidCount, lifecycle, filtered }: {
  signals: ActionItem[];
  now: number;
  generatedAt?: string;
  nextRefreshAt: number | null;
  validCount?: number;
  invalidCount?: number;
  lifecycle: DataLifecycle;
  filtered: boolean;
}): JSX.Element {
  const ordered = useMemo(() => compactSignals(signals), [signals]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollOffset = useRef(0);
  const [loopHeight, setLoopHeight] = useState(0);
  useEffect(() => {
    const viewport = viewportRef.current;
    const group = groupRef.current;
    if (!viewport || !group) return;
    let frame = 0;
    const measure = () => {
      const height = group.offsetHeight;
      setLoopHeight(height > viewport.clientHeight + 2 ? height : 0);
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(viewport);
    observer.observe(group);
    measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [ordered.length]);
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || !loopHeight) { scrollOffset.current = 0; return; }
    // A signage feed must keep looping even when global reduced-motion CSS
    // disables ordinary UI animations. Preserve pixel position on remeasurement.
    const duration = Math.max(12000, loopHeight / 18 * 1000);
    const animation = track.animate([
      { transform: 'translate3d(0, 0, 0)' },
      { transform: `translate3d(0, -${loopHeight}px, 0)` }
    ], { duration, iterations: Infinity, easing: 'linear' });
    animation.currentTime = (scrollOffset.current % loopHeight) / loopHeight * duration;
    track.dataset.durationMs = String(duration);
    return () => {
      const time = typeof animation.currentTime === 'number' ? animation.currentTime : 0;
      scrollOffset.current = (time % duration) / duration * loopHeight;
      animation.cancel();
    };
  }, [loopHeight]);
  const critical = ordered.filter(item => item.attention === 'critical').length;
  const affectedProviders = ordered.filter((item, index) => ordered.findIndex(other => other.providerId === item.providerId) === index);
  const providers = affectedProviders.length;
  const collectedAt = Date.parse(generatedAt || '');
  const collectedTime = Number.isFinite(collectedAt) ? new Date(collectedAt).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }) + ' ET' : 'unknown';
  const ready = (lifecycle.phase === 'ready' || lifecycle.phase === 'refreshing');
  const refreshLabel = lifecycle.phase === 'refreshing' ? 'in progress' : nextRefreshAt === null ? 'pending' : nextRefreshAt <= now ? 'due / waiting' : `in ${compactCountdown(nextRefreshAt, now)}`;

  return (
    <section className="compact-incident-board" data-scrolling={loopHeight > 0} data-total={ordered.length} aria-label="Active service issues">
      <div className="compact-board-heading">
        <h2><span className={ordered.length ? 'compact-alert-dot' : 'compact-quiet-dot'} />{ordered.length} {ready ? '' : 'reported '}{ordered.length === 1 ? 'issue' : 'issues'}</h2>
        <div className="compact-affected-providers" aria-label="Providers with active issues">
          {affectedProviders.slice(0, 8).map(item => <span key={item.providerId} title={item.provider} aria-label={item.provider}><ProviderIcon id={item.providerId} name={item.provider} /></span>)}
          {providers > 8 ? <small>+{providers - 8}</small> : null}
        </div>
        <span>{critical > 0 ? <b className="compact-critical-count">{critical} critical · </b> : null}{providers} providers</span>
      </div>
      <div className="compact-board-rows" ref={viewportRef}>
        <div className={`compact-scroll-track${loopHeight ? ' is-scrolling' : ''}`} ref={trackRef}>
          {[false, ...(loopHeight ? [true] : [])].map(copy => (
            <div className="compact-scroll-group" key={String(copy)} ref={copy ? undefined : groupRef} aria-hidden={copy || undefined}>
              {ordered.map(item => (
                <article key={item.id} className={`compact-issue attention-${item.attention}`} data-provider-id={item.providerId} data-updated-at={item.updatedAt} title={`${item.provider}: ${item.title}\n${item.detail}`}>
                  <ProviderIcon id={item.providerId} name={item.provider} />
                  <div className="compact-issue-text">
                    <div className="compact-issue-meta"><b>{item.provider}</b><span className="compact-severity">{item.attention === 'critical' ? 'CRITICAL' : item.attention === 'action' ? 'ISSUE' : 'WATCH'}</span><time aria-label="Latest vendor update">{age(item.updatedAt, now) === 'now' ? 'just now' : `${age(item.updatedAt, now)} ago`}</time></div>
                    <h3>{item.title.trim() || compactHeadline(item)}</h3>
                    {compactDescription(item) ? <p>{compactDescription(item)}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          ))}
        </div>
        {!ordered.length ? <div className="compact-board-empty"><b>{ready ? 'No active issues' : 'Status not confirmed'}</b><span>{filtered ? 'Within the selected providers / time window' : 'Monitored public vendor sources'}{!ready ? ` · ${lifecycle.phase}` : ''}</span></div> : null}
      </div>
      <div className="compact-board-footer" aria-label="Data freshness and provider status">
        <span className={ready ? '' : 'compact-data-warning'} title={`Last successful data update: ${collectedTime}`}>{!ready ? `${lifecycle.phase.toUpperCase()} · ` : ''}Data {age(generatedAt, now) === 'now' ? 'just updated' : age(generatedAt, now) === '—' ? 'age unknown' : `${age(generatedAt, now)} old`}</span>
        <span>Refresh {refreshLabel}</span>
        <span><b>{validCount ?? '—'} valid</b> / <b className={invalidCount ? 'compact-data-warning' : ''}>{invalidCount ?? '—'} invalid</b></span>
      </div>
    </section>
  );
}
