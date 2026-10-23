import { useEffect, useMemo, useState } from 'react';
import { ProviderIcon } from './providerIcon';
import { COMPACT_PAGE_MS, COMPACT_PAGE_SIZE, compactHeadline, compactSignals } from './compactWallboard';
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
  const identity = ordered.map(item => item.id).join('|');
  const pages = Math.max(1, Math.ceil(ordered.length / COMPACT_PAGE_SIZE));
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
    if (pages <= 1) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setPage(current => (current + 1) % pages);
    }, COMPACT_PAGE_MS);
    return () => window.clearInterval(timer);
  }, [identity, pages]);
  const current = page % pages;
  const visible = ordered.slice(current * COMPACT_PAGE_SIZE, (current + 1) * COMPACT_PAGE_SIZE);
  const critical = ordered.filter(item => item.attention === 'critical').length;
  const providers = new Set(ordered.map(item => item.providerId)).size;
  const ready = (lifecycle.phase === 'ready' || lifecycle.phase === 'refreshing');

  return (
    <section className="compact-incident-board" data-page={current + 1} data-pages={pages} data-total={ordered.length} aria-label="Active service issues">
      <div className="compact-board-heading">
        <h2><span className={ordered.length ? 'compact-alert-dot' : 'compact-quiet-dot'} />{ordered.length} {ready ? 'active' : 'reported'} {ordered.length === 1 ? 'issue' : 'issues'}</h2>
        <span>{critical > 0 ? <b className="compact-critical-count">{critical} critical · </b> : null}{providers} providers</span>
      </div>
      <div className="compact-board-rows">
        {visible.map(item => (
          <article key={item.id} className={`compact-issue attention-${item.attention}`} data-provider-id={item.providerId} data-updated-at={item.updatedAt} title={`${item.provider}: ${item.title}\n${item.detail}`}>
            <ProviderIcon id={item.providerId} name={item.provider} />
            <div className="compact-issue-text">
              <div className="compact-issue-meta"><b>{item.provider}</b><span className="compact-severity">{item.attention === 'critical' ? 'CRITICAL' : item.attention === 'action' ? 'ACTION' : 'WATCH'}</span><time aria-label="Latest vendor update">{age(item.updatedAt, now)}</time></div>
              <h3>{compactHeadline(item)}</h3>
            </div>
          </article>
        ))}
        {!visible.length ? <div className="compact-board-empty"><b>{ready ? 'No active issues' : 'Status not confirmed'}</b><span>{filtered ? 'Within the selected providers / time window' : 'Monitored public vendor sources'}{!ready ? ` · ${lifecycle.phase}` : ''}</span></div> : null}
      </div>
      <div className="compact-board-footer">
        <span className={ready ? '' : 'compact-data-warning'}>{ready ? 'Data' : lifecycle.phase} {age(generatedAt, now)} · checked {age(checkedAt, now)}</span>
        <span>{pages > 1 ? `${current * COMPACT_PAGE_SIZE + 1}–${Math.min((current + 1) * COMPACT_PAGE_SIZE, ordered.length)} of ${ordered.length} · ${current + 1}/${pages} · 8s` : ordered.length ? 'All issues visible' : 'No issues listed'}{filtered ? ' · filtered' : ''}</span>
      </div>
    </section>
  );
}
