import { useEffect, useMemo, useState } from 'react';
import { componentStatusIsProblem } from './componentStatus';
import { ProviderIcon } from './providerIcon';
import { effectiveIncidentTime } from './statusContract';
import type { DiagnosticSource, IssueBrief, IssueConsoleModel } from './statusViewModel';
import type { DataLifecycle, Maintenance, ServiceState } from './types';

/**
 * The default operator screen. One verdict, then what is wrong in the vendor's
 * own words, then every service on one line. Collection detail lives in the
 * technical console, not here.
 */

const EASTERN = 'America/New_York';
const PAYLOAD_WARNING_MS = 20 * 60 * 1000;

export const STATE_WORD: Record<ServiceState, string> = {
  major: 'Major outage',
  degraded: 'Degraded',
  unknown: 'Not confirmed',
  operational: 'Working'
};

const STATE_ORDER: Record<ServiceState, number> = { major: 0, degraded: 1, unknown: 2, operational: 3 };

function parseTime(value?: string): number {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function clock(value: string | number | undefined): string {
  const timestamp = typeof value === 'number' ? value : parseTime(value);
  if (!timestamp) return 'time unknown';
  return new Intl.DateTimeFormat('en-US', { timeZone: EASTERN, hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' }).format(new Date(timestamp));
}

function dayAndClock(value: string | undefined, now: number): string {
  const timestamp = parseTime(value);
  if (!timestamp) return 'time unknown';
  const day = (ms: number) => new Intl.DateTimeFormat('en-US', { timeZone: EASTERN, month: 'short', day: 'numeric' }).format(new Date(ms));
  return day(timestamp) === day(now) ? clock(timestamp) : `${day(timestamp)}, ${clock(timestamp)}`;
}

export function agoWords(value: string | undefined, now: number): string {
  const timestamp = parseTime(value);
  if (!timestamp) return 'at an unknown time';
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

function count(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

export function verdict(summary: IssueConsoleModel['summary'], total: number): { tone: ServiceState; headline: string; detail: string } {
  const { major_count: major, degraded_count: degraded, unknown_count: unknown, confirmed_operational_count: working } = summary;
  const parts: string[] = [];
  if (major) parts.push(count(major, 'major outage', 'major outages'));
  if (degraded) parts.push(`${degraded} degraded`);
  if (unknown) parts.push(`${unknown} not confirmed`);
  parts.push(`${working} working`);
  const detail = parts.join(', ');
  if (major) return { tone: 'major', headline: `${count(major, 'service has', 'services have')} a major outage`, detail };
  if (degraded) return { tone: 'degraded', headline: `${count(degraded, 'service is', 'services are')} degraded`, detail };
  if (unknown) return { tone: 'unknown', headline: 'No outages reported', detail: `${count(unknown, 'service', 'services')} could not be confirmed. ${working} working.` };
  return { tone: 'operational', headline: `All ${total} services are working`, detail: 'No vendor is reporting a problem.' };
}

/** Vendors often publish one long paragraph. Start a new paragraph at each of the vendor's own section labels. */
export function paragraphs(note: string): string {
  return note.replace(/\s+(More info:|Current status:|Scope of impact:|Next update by:|Previous status:|Start time:|Root cause:|Next steps:)/gi, '\n\n$1');
}

function StateIcon({ state }: { state: ServiceState }): JSX.Element {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', 'aria-hidden': true } as const;
  if (state === 'operational') return <svg {...common}><circle cx="12" cy="12" r="11" fill="currentColor" /><path d="M6.5 12.5l3.6 3.6 7.4-7.6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (state === 'major') return <svg {...common}><path d="M7.4 1h9.2L23 7.4v9.2L16.6 23H7.4L1 16.6V7.4z" fill="currentColor" /><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /></svg>;
  if (state === 'degraded') return <svg {...common}><path d="M12 1.5L23 21.5H1z" fill="currentColor" /><path d="M12 9v6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /><circle cx="12" cy="18.2" r="1.4" fill="#fff" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M9.2 9.4a2.9 2.9 0 1 1 4.2 2.6c-.9.5-1.4 1-1.4 2" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><circle cx="12" cy="17.4" r="1.4" fill="currentColor" /></svg>;
}

function StateLabel({ state }: { state: ServiceState }): JSX.Element {
  return <span className={`sh-state is-${state}`}><StateIcon state={state} /><span>{STATE_WORD[state]}</span></span>;
}

function IncidentText({ item, now, full }: { item: IssueBrief; now: number; full: boolean }): JSX.Element {
  const updates = full ? (item.updates || []).filter(update => update.note && update.note !== item.note) : [];
  return (
    <div className="sh-incident">
      <h3>{item.title}</h3>
      {item.note && item.note !== item.title && <p>{paragraphs(item.note)}</p>}
      <p className="sh-when">Last update {agoWords(effectiveIncidentTime(item), now)} ({dayAndClock(effectiveIncidentTime(item), now)}){item.affected_service ? `. Affects ${item.affected_service}.` : '.'}</p>
      {updates.length > 0 && (
        <ol className="sh-updates" aria-label="Earlier updates from the vendor">
          {updates.map((update, index) => <li key={`${update.at || ''}-${index}`}><b>{dayAndClock(update.at, now)}</b><span>{paragraphs(update.note)}</span></li>)}
        </ol>
      )}
    </div>
  );
}

function problemComponentNames(source: DiagnosticSource): string[] {
  return source.componentStatus.filter(component => componentStatusIsProblem(component.status)).map(component => component.name);
}

function ProblemBox({ source, incidents, now }: { source: DiagnosticSource; incidents: IssueBrief[]; now: number }): JSX.Element {
  const components = problemComponentNames(source);
  return (
    <article className={`sh-problem is-${source.serviceState}`}>
      <div className="sh-problem-body">
        {incidents.length
          ? incidents.map(item => <IncidentText key={item.id} item={item} now={now} full />)
          : <div className="sh-incident"><h3>{source.status || STATE_WORD[source.serviceState]}</h3>{source.message && <p>{source.message}</p>}</div>}
        {components.length > 0 && <p className="sh-parts"><b>Parts affected:</b> {components.slice(0, 40).join(', ')}</p>}
      </div>
    </article>
  );
}

/** One issue card: who, how bad, the vendor's headline, how recent. Opens the detail panel. */
function ProblemRow({ source, incidents, now, onOpen }: { source: DiagnosticSource; incidents: IssueBrief[]; now: number; onOpen: (id: string) => void }): JSX.Element {
  const titles = incidents.length ? incidents.map(item => item.title) : [source.status || STATE_WORD[source.serviceState]];
  const latest = incidents.length ? effectiveIncidentTime(incidents[0]) : source.lastSemanticChangeAt;
  return (
    <li>
      <button type="button" className={`sh-row is-${source.serviceState}`} onClick={() => onOpen(source.id)}>
        <ProviderIcon id={source.id} name={source.provider} />
        <span className="sh-row-text">
          <span className="sh-row-head"><b>{source.provider}</b>{titles.length > 1 && <em>{titles.length} issues</em>}</span>
          {titles.slice(0, 2).map((title, index) => <span className="sh-row-title" key={index}>{title}</span>)}
          {titles.length > 2 && <span className="sh-row-more">and {titles.length - 2} more</span>}
        </span>
        <span className="sh-row-when">{parseTime(latest) ? agoWords(latest, now) : ''}</span>
        <svg className="sh-chevron" width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </li>
  );
}

function firstSentence(text: string): string {
  const sentence = text.split(/(?<=[.!?])\s/)[0] || text;
  return sentence.length > 180 ? `${sentence.slice(0, 177).trimEnd()}...` : sentence;
}

function unknownReason(source: DiagnosticSource): string {
  if (source.sourceHealth === 'blind') return 'The vendor status page could not be read, so we cannot say if this is up or down.';
  return firstSentence(source.message || source.status || 'The vendor has not published a clear status.');
}

function ServiceDetail({ source, incidents, maintenance, now, onClose }: { source: DiagnosticSource; incidents: IssueBrief[]; maintenance: Maintenance[]; now: number; onClose: () => void }): JSX.Element {
  const troubled = source.serviceState === 'major' || source.serviceState === 'degraded';
  return (
    <div className="sh-drawer-layer">
      <button type="button" className="sh-drawer-backdrop" onClick={onClose} aria-label="Close details" />
      <aside className="sh-drawer" role="dialog" aria-modal="true" aria-label={`${source.provider} details`}>
        <header className="sh-drawer-head">
          <ProviderIcon id={source.id} name={source.provider} />
          <div><h2>{source.provider}</h2><StateLabel state={source.serviceState} /></div>
          <button type="button" className="sh-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </button>
        </header>
        <div className="sh-drawer-body">
          {troubled && <ProblemBox source={source} incidents={incidents} now={now} />}
          {source.serviceState === 'operational' && <div className="sh-plain"><p>{source.provider} reports that everything is working.</p></div>}
          {source.serviceState === 'unknown' && <div className="sh-plain"><p>{unknownReason(source)}</p><p>This is not shown as working until the vendor confirms it.</p></div>}
          {maintenance.length > 0 && (
            <section className="sh-block">
              <h3>Planned maintenance</h3>
              <ul className="sh-lines">{maintenance.map(item => <li key={item.id}><b>{item.title}</b><span>{item.status === 'in_progress' ? 'In progress now' : `Starts ${dayAndClock(item.starts_at, now)}`}</span></li>)}</ul>
            </section>
          )}
          {source.id === 'microsoft365' && <p className="sh-note">This is what Microsoft publishes for everyone. It is not the health of one customer tenant.</p>}
          <details className="sh-how">
            <summary>How we know this</summary>
            <dl>
              <div><dt>Source</dt><dd>{source.sourceHost || 'Unknown'}</dd></div>
              <div><dt>Last read</dt><dd>{agoWords(source.lastSuccessAt || source.checkedAt, now)} ({dayAndClock(source.lastSuccessAt || source.checkedAt, now)})</dd></div>
              <div><dt>Reading the source</dt><dd>{source.sourceHealth === 'healthy' ? 'Read successfully' : source.sourceHealth === 'watch' ? 'Read with warnings' : 'Could not be read'}</dd></div>
              <div><dt>What the vendor says</dt><dd>{source.status || 'Nothing published'}</dd></div>
            </dl>
          </details>
        </div>
        <footer className="sh-drawer-foot"><a className="sh-button" href={incidents[0]?.url || source.source} target="_blank" rel="noopener noreferrer">Open the vendor's status page</a></footer>
      </aside>
    </div>
  );
}

type ServiceFilter = 'all' | 'issues' | 'working';

export function StatusHome({ model, lifecycle, now, onRefresh }: { model: IssueConsoleModel | null; lifecycle: DataLifecycle; now: number; onRefresh: () => void }): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ServiceFilter>('all');

  const services = useMemo(() => [...(model?.diagnostics || [])].sort((a, b) =>
    STATE_ORDER[a.serviceState] - STATE_ORDER[b.serviceState] || a.provider.localeCompare(b.provider)), [model]);
  const incidentsFor = (id: string) => (model?.briefs || []).filter(item => item.providerId === id)
    .sort((a, b) => parseTime(effectiveIncidentTime(b)) - parseTime(effectiveIncidentTime(a)));

  const selected = selectedId ? services.find(source => source.id === selectedId) || null : null;

  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const generatedAt = parseTime(model?.generatedAt);
  const ageMs = generatedAt ? now - generatedAt : 0;
  const old = Boolean(model) && (lifecycle.phase === 'stale' || ageMs > PAYLOAD_WARNING_MS);
  const busy = lifecycle.phase === 'loading' || lifecycle.phase === 'refreshing';

  const header = (
    <header className="sh-top">
      <div className="sh-top-inner">
        <span className="sh-brand"><span className="sh-brand-mark" aria-hidden="true" />Service status</span>
        <div className="sh-top-right">
          <span className={`sh-live${old || !model ? ' is-old' : ''}`}><i aria-hidden="true" />{model ? `Updated ${agoWords(model.generatedAt, now)}` : 'Not loaded yet'}</span>
          <button type="button" className="sh-button is-quiet" onClick={onRefresh} disabled={busy}>{busy ? 'Checking' : 'Check again'}</button>
        </div>
      </div>
    </header>
  );

  const footer = (
    <footer className="sh-foot">
      <p>Every status comes from the vendor's own official status page. Nothing is guessed.</p>
      <p><a href="?view=wallboard">Wallboard</a><a href="?console=full">Technical console</a></p>
    </footer>
  );

  if (!model) {
    const loading = lifecycle.phase === 'loading';
    return (
      <div className="sh-shell">
        {header}
        <div className="sh-page">
          <section className="sh-verdict is-unknown" aria-live="polite">
            <div className="sh-verdict-main">
              <StateIcon state="unknown" />
              <div>
                <h1>{loading ? 'Loading status' : 'Status is not available right now'}</h1>
                <p>{loading ? 'Reading the latest information.' : 'No service is shown as working until fresh information loads.'}</p>
              </div>
            </div>
            {!loading && <button type="button" className="sh-button" onClick={onRefresh}>Try again</button>}
          </section>
          {loading && <div className="sh-skeleton" aria-hidden="true"><span /><span /><span /><span /></div>}
          {footer}
        </div>
      </div>
    );
  }

  const summary = verdict(model.summary, services.length);
  const majors = services.filter(source => source.serviceState === 'major');
  const degradeds = services.filter(source => source.serviceState === 'degraded');
  const unconfirmed = services.filter(source => source.serviceState === 'unknown');
  const working = services.filter(source => source.serviceState === 'operational');
  const ongoingMaintenance = model.maintenance.filter(item => item.status === 'in_progress');
  const needle = query.trim().toLowerCase();
  const listed = services.filter(source =>
    (filter === 'all' || (filter === 'working' ? source.serviceState === 'operational' : source.serviceState !== 'operational'))
    && (!needle || source.provider.toLowerCase().includes(needle)));
  const tiles: Array<{ state: ServiceState; count: number; label: string }> = [
    { state: 'major', count: majors.length, label: 'Major outage' },
    { state: 'degraded', count: degradeds.length, label: 'Degraded' },
    { state: 'unknown', count: unconfirmed.length, label: 'Not confirmed' },
    { state: 'operational', count: working.length, label: 'Working' }
  ];
  const quiet = !majors.length && !degradeds.length && !unconfirmed.length && !ongoingMaintenance.length;

  return (
    <div className="sh-shell">
      {header}
      <div className="sh-page">
        {old && <div className="sh-warning" role="status"><b>This information may be out of date.</b> It was last collected {agoWords(model.generatedAt, now)}.</div>}

        <section className={`sh-verdict is-${summary.tone}`} aria-live="polite">
          <div className="sh-verdict-main">
            <StateIcon state={summary.tone} />
            <div><h1>{summary.headline}</h1><p>{summary.detail}</p></div>
          </div>
          <ul className="sh-tiles" aria-label="Service totals">
            {tiles.map(tile => <li key={tile.state} className={`is-${tile.state}`}><b>{tile.count}</b><span>{tile.label}</span></li>)}
          </ul>
          <div className="sh-bar" aria-hidden="true">
            {tiles.filter(tile => tile.count > 0).map(tile => <span key={tile.state} className={`is-${tile.state}`} style={{ flexGrow: tile.count }} />)}
          </div>
        </section>

        <div className="sh-grid">
          <div className="sh-col">
            {majors.length > 0 && (
              <section className="sh-section" aria-labelledby="sh-major">
                <h2 id="sh-major"><StateIcon state="major" />Major outage <span>{majors.length}</span></h2>
                <ul className="sh-rows">{majors.map(source => <ProblemRow key={source.id} source={source} incidents={incidentsFor(source.id)} now={now} onOpen={setSelectedId} />)}</ul>
              </section>
            )}

            {degradeds.length > 0 && (
              <section className="sh-section" aria-labelledby="sh-degraded">
                <h2 id="sh-degraded"><StateIcon state="degraded" />Degraded <span>{degradeds.length}</span></h2>
                <ul className="sh-rows">{degradeds.map(source => <ProblemRow key={source.id} source={source} incidents={incidentsFor(source.id)} now={now} onOpen={setSelectedId} />)}</ul>
              </section>
            )}

            {unconfirmed.length > 0 && (
              <section className="sh-section" aria-labelledby="sh-unknown">
                <h2 id="sh-unknown"><StateIcon state="unknown" />Not confirmed <span>{unconfirmed.length}</span></h2>
                <ul className="sh-rows">{unconfirmed.map(source => (
                  <li key={source.id}>
                    <button type="button" className="sh-row is-unknown" onClick={() => setSelectedId(source.id)}>
                      <ProviderIcon id={source.id} name={source.provider} />
                      <span className="sh-row-text"><span className="sh-row-head"><b>{source.provider}</b></span><span className="sh-row-title">{unknownReason(source)}</span></span>
                    </button>
                  </li>
                ))}</ul>
              </section>
            )}

            {ongoingMaintenance.length > 0 && (
              <section className="sh-section" aria-labelledby="sh-maintenance">
                <h2 id="sh-maintenance">Planned maintenance in progress <span>{ongoingMaintenance.length}</span></h2>
                <ul className="sh-lines">{ongoingMaintenance.map(item => <li key={item.id}><b>{item.provider}</b><span>{item.title}</span></li>)}</ul>
              </section>
            )}

            {quiet && <div className="sh-plain"><p>No vendor is reporting a problem right now.</p></div>}
          </div>

          <section className="sh-side" aria-labelledby="sh-all">
            <div className="sh-all-head">
              <h2 id="sh-all">All services <span>{services.length}</span></h2>
              <div className="sh-tabs" role="group" aria-label="Filter services">
                {(['all', 'issues', 'working'] as const).map(value => <button key={value} type="button" className={filter === value ? 'is-on' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : value === 'issues' ? 'Issues' : 'Working'}</button>)}
              </div>
            </div>
            <label className="sh-find"><span>Find a service</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a service" /></label>
            {listed.length
              ? <ul className="sh-services">{listed.map(source => (
                  <li key={source.id}>
                    <button type="button" className={`sh-service is-${source.serviceState}`} onClick={() => setSelectedId(source.id)}>
                      <ProviderIcon id={source.id} name={source.provider} />
                      <span className="sh-service-name">{source.provider}</span>
                      <StateLabel state={source.serviceState} />
                    </button>
                  </li>
                ))}</ul>
              : <p className="sh-empty">No service matches.</p>}
          </section>
        </div>
        {footer}
      </div>
      {selected && <ServiceDetail source={selected} incidents={incidentsFor(selected.id)} maintenance={model.maintenance.filter(item => item.providerId === selected.id)} now={now} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
