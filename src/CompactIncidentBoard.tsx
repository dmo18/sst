import { useEffect, useMemo, useRef, useState } from 'react';
import { ProviderIcon } from './providerIcon';
import { compactDescription, compactHeadline, compactSignals } from './compactWallboard';
import type { ActionItem } from './statusViewModel';
import type { DataLifecycle } from './types';

function age(value: string | number | null | undefined, now: number): string {
  const time = typeof value === 'number' ? value : Date.parse(value || '');
  if (!Number.isFinite(time) || time <= 0) return '—';
  const minutes = Math.max(0, Math.floor((now - time) / 60000));
  return minutes < 1 ? 'now' : minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`;
}

export function CompactIncidentBoard({ signals, now, generatedAt, checkedAt, lifecycle, filtered }: {
  signals: ActionItem[];
  now: number;
  generatedAt?: string;
  checkedAt: number | null;
  lifecycle: DataLifecycle;
  filtered: boolean;
}): JSX.Element {
  const ordered = useMemo(() => compactSignals(signals), [signals]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
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
  const critical = ordered.filter(item => item.attention === 'critical').length;
  const providers = new Set(ordered.map(item => item.providerId)).size;
  const ready = (lifecycle.phase === 'ready' || lifecycle.phase === 'refreshing');

  return (
    <section className="compact-incident-board" data-scrolling={loopHeight > 0} data-total={ordered.length} aria-label="Active service issues">
      <div className="compact-board-heading">
        <h2><span className={ordered.length ? 'compact-alert-dot' : 'compact-quiet-dot'} />{ordered.length} {ready ? 'active' : 'reported'} {ordered.length === 1 ? 'issue' : 'issues'}</h2>
        <span>{critical > 0 ? <b className="compact-critical-count">{critical} critical · </b> : null}{providers} providers</span>
      </div>
      <div className="compact-board-rows" ref={viewportRef}>
        <div className={`compact-scroll-track${loopHeight ? ' is-scrolling' : ''}`} style={{ '--compact-scroll-distance': `${loopHeight}px`, '--compact-scroll-duration': `${Math.max(12, loopHeight / 18)}s` } as React.CSSProperties}>
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
      <div className="compact-board-footer">
        <span className={ready ? '' : 'compact-data-warning'}>{ready ? 'Updated' : `Data ${lifecycle.phase} · updated`} {age(generatedAt, now) === 'now' ? 'just now' : `${age(generatedAt, now)} ago`}</span>
        <span>Checked {age(checkedAt, now) === 'now' ? 'just now' : `${age(checkedAt, now)} ago`}{filtered ? ' · filtered view' : ''}</span>
      </div>
    </section>
  );
}
