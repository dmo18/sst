import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ProviderIcon } from './providerIcon';
import { relativeAgeAt } from './liveTelemetry';
import { isAlertWithinWindow } from './wallboardRoute';
import type { DataLifecycle } from './types';
import type { ActionItem, IssueConsoleModel } from './statusViewModel';

const EASTERN_TIME_ZONE = 'America/New_York';
const LOOP_SPEED_PX_PER_SECOND = 22;
const PROVIDER_LOOP_SPEED_PX_PER_SECOND = 28;
const YODECK_WIDTH = 458;
const YODECK_HEIGHT = 291;
const LAYOUT_PROBE_ATTEMPTS = 40;
const HEADER_MODE_KEY = 'sst-wallboard-header-mode';
const CONTROLS_AUTO_HIDE_MS = 3200;
const RESTORE_PEEK_MS = 2400;

type HeaderMode = 'auto' | 'open' | 'closed';

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

function compactAgeLabel(value: string | number | null | undefined, now: number): string {
  const parsed = typeof value === 'number' ? value : Date.parse(value || '');
  if (!Number.isFinite(parsed) || parsed <= 0) return 'unknown';
  const seconds = Math.max(0, Math.floor((now - parsed) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function readHeaderMode(): HeaderMode {
  try {
    const value = localStorage.getItem(HEADER_MODE_KEY);
    return value === 'open' || value === 'closed' ? value : 'auto';
  }
  catch {
    return 'auto';
  }
}

function persistHeaderMode(mode: HeaderMode): void {
  try {
    localStorage.setItem(HEADER_MODE_KEY, mode);
  }
  catch {
    // Storage can be unavailable on locked-down signage browsers. Runtime behavior still works in memory.
  }
}

function useWallboardControls(): {
  headerMode: HeaderMode;
  controlsVisible: boolean;
  restoreVisible: boolean;
  setHeaderMode: (mode: HeaderMode) => void;
} {
  const [headerMode, setHeaderModeState] = useState<HeaderMode>(() => readHeaderMode());
  const [controlsVisible, setControlsVisible] = useState(() => readHeaderMode() === 'open');
  const [restoreVisible, setRestoreVisible] = useState(false);
  const controlsTimer = useRef<number | null>(null);
  const restoreTimer = useRef<number | null>(null);

  const clearControlsTimer = useCallback(() => {
    if (controlsTimer.current !== null) window.clearTimeout(controlsTimer.current);
    controlsTimer.current = null;
  }, []);

  const clearRestoreTimer = useCallback(() => {
    if (restoreTimer.current !== null) window.clearTimeout(restoreTimer.current);
    restoreTimer.current = null;
  }, []);

  const setHeaderMode = useCallback((mode: HeaderMode) => {
    clearControlsTimer();
    clearRestoreTimer();
    persistHeaderMode(mode);
    setHeaderModeState(mode);
    setRestoreVisible(false);

    if (mode === 'open') {
      setControlsVisible(true);
      return;
    }

    if (mode === 'closed') {
      setControlsVisible(false);
      return;
    }

    setControlsVisible(true);
    controlsTimer.current = window.setTimeout(() => {
      setControlsVisible(false);
      controlsTimer.current = null;
    }, CONTROLS_AUTO_HIDE_MS);
  }, [clearControlsTimer, clearRestoreTimer]);

  const revealControls = useCallback(() => {
    clearControlsTimer();
    clearRestoreTimer();

    if (headerMode === 'closed') {
      setControlsVisible(false);
      setRestoreVisible(true);
      restoreTimer.current = window.setTimeout(() => {
        setRestoreVisible(false);
        restoreTimer.current = null;
      }, RESTORE_PEEK_MS);
      return;
    }

    setRestoreVisible(false);
    setControlsVisible(true);
    if (headerMode === 'auto') {
      controlsTimer.current = window.setTimeout(() => {
        setControlsVisible(false);
        controlsTimer.current = null;
      }, CONTROLS_AUTO_HIDE_MS);
    }
  }, [clearControlsTimer, clearRestoreTimer, headerMode]);

  useEffect(() => {
    window.addEventListener('pointermove', revealControls, { passive: true });
    window.addEventListener('pointerdown', revealControls, { passive: true });
    window.addEventListener('keydown', revealControls);
    return () => {
      window.removeEventListener('pointermove', revealControls);
      window.removeEventListener('pointerdown', revealControls);
      window.removeEventListener('keydown', revealControls);
    };
  }, [revealControls]);

  useEffect(() => () => {
    clearControlsTimer();
    clearRestoreTimer();
  }, [clearControlsTimer, clearRestoreTimer]);

  return { headerMode, controlsVisible, restoreVisible, setHeaderMode };
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

    let resizeObserver: ResizeObserver | null = null;

    const measure = () => {
      const groupHeight = Math.ceil(group.getBoundingClientRect().height);
      const shouldLoop = itemCount > 1 && groupHeight > viewport.clientHeight + 2;

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

    const scheduleMeasure = () => {
      window.requestAnimationFrame(measure);
    };
    resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(viewport);
    resizeObserver.observe(group);
    scheduleMeasure();

    return () => {
      resizeObserver?.disconnect();
      track.classList.remove('is-looping');
    };
  }, [groupRef, itemCount, trackRef, viewportRef]);
}

function useProviderMarquee(
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

    let resizeObserver: ResizeObserver | null = null;

    const measure = () => {
      const groupWidth = Math.ceil(group.getBoundingClientRect().width);
      const shouldLoop = itemCount > 1 && groupWidth > viewport.clientWidth + 2;

      track.classList.remove('is-looping');
      track.style.removeProperty('--wallboard-provider-loop-distance');
      track.style.removeProperty('--wallboard-provider-loop-duration');

      if (!shouldLoop || groupWidth <= 0) return;

      const durationSeconds = Math.max(10, groupWidth / PROVIDER_LOOP_SPEED_PX_PER_SECOND);
      track.style.setProperty('--wallboard-provider-loop-distance', `${groupWidth}px`);
      track.style.setProperty('--wallboard-provider-loop-duration', `${durationSeconds}s`);
      void track.offsetWidth;
      track.classList.add('is-looping');
    };

    const scheduleMeasure = () => {
      window.requestAnimationFrame(measure);
    };
    resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(viewport);
    resizeObserver.observe(group);
    scheduleMeasure();

    return () => {
      resizeObserver?.disconnect();
      track.classList.remove('is-looping');
    };
  }, [groupRef, itemCount, trackRef, viewportRef]);
}

function rectsOverlap(first: DOMRect, second: DOMRect): boolean {
  return first.left < second.right
    && first.right > second.left
    && first.top < second.bottom
    && first.bottom > second.top;
}

function isVisiblyRendered(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && Number(style.opacity || '1') > 0.05
    && element.getBoundingClientRect().width > 0
    && element.getBoundingClientRect().height > 0;
}

function useWallboardLayoutProbe(
  shellRef: RefObject<HTMLElement>,
  alertWindowMs: number | null,
  signalCount: number,
  providerCount: number
): void {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('layoutProbe') !== 'yodeck') return;

    const shell = shellRef.current;
    if (!shell) return;

    shell.dataset.layoutProbe = 'pending';
    let attempts = 0;
    let timer = 0;

    const evaluate = () => {
      attempts += 1;
      const reasons: string[] = [];
      const priority = shell.querySelector<HTMLElement>('.wallboard-priority-v2');
      const heading = priority?.querySelector<HTMLElement>(':scope > h2') || null;
      const telemetry = heading?.querySelector<HTMLElement>('.wallboard-mini-telemetry') || null;
      const providerRail = priority?.querySelector<HTMLElement>('.wallboard-alert-provider-rail') || null;
      const priorityList = priority?.querySelector<HTMLElement>('.wallboard-priority-list') || null;
      const priorityTrack = priority?.querySelector<HTMLElement>('.wallboard-priority-track') || null;
      const priorityGroup = priority?.querySelector<HTMLElement>('.wallboard-priority-group:not(.wallboard-priority-copy)') || null;
      const providerTrack = priority?.querySelector<HTMLElement>('.wallboard-alert-provider-track') || null;
      const providerGroup = priority?.querySelector<HTMLElement>('.wallboard-alert-provider-group:not(.wallboard-alert-provider-copy)') || null;
      const providerPanel = shell.querySelector<HTMLElement>('.wallboard-providers');
      const footer = shell.querySelector<HTMLElement>(':scope > footer');
      const overlayHeader = shell.querySelector<HTMLElement>(':scope > header');
      const overlayKpis = shell.querySelector<HTMLElement>(':scope > .wallboard-kpis');
      const primaryArticles = Array.from(priority?.querySelectorAll<HTMLElement>('.wallboard-priority-group:not(.wallboard-priority-copy) > article') || []);
      const emptyState = priority?.querySelector<HTMLElement>('.wallboard-priority-list .empty-state') || null;

      if (Math.abs(window.innerWidth - YODECK_WIDTH) > 2) reasons.push(`viewport-width:${window.innerWidth}`);
      if (Math.abs(window.innerHeight - YODECK_HEIGHT) > 2) reasons.push(`viewport-height:${window.innerHeight}`);
      if (!priority || !heading || !providerRail || !priorityList) reasons.push('required-layout-node-missing');

      if (priority && heading && providerRail && priorityList) {
        const shellRect = shell.getBoundingClientRect();
        const priorityRect = priority.getBoundingClientRect();
        const headingRect = heading.getBoundingClientRect();
        const providerRailRect = providerRail.getBoundingClientRect();
        const priorityListRect = priorityList.getBoundingClientRect();

        if (shellRect.width < YODECK_WIDTH - 2 || shellRect.height < YODECK_HEIGHT - 2) reasons.push('shell-does-not-fill-viewport');
        if (priorityRect.width < YODECK_WIDTH - 16 || priorityRect.height < YODECK_HEIGHT - 16) reasons.push('priority-panel-collapsed');
        if (headingRect.bottom > providerRailRect.top + 2) reasons.push('heading-overlaps-provider-rail');
        if (providerRailRect.bottom > priorityListRect.top + 2) reasons.push('provider-rail-overlaps-list');
        if (priorityListRect.height < 80) reasons.push(`priority-list-too-short:${Math.round(priorityListRect.height)}`);
        if (priorityRect.left < -1 || priorityRect.top < -1 || priorityRect.right > window.innerWidth + 1 || priorityRect.bottom > window.innerHeight + 1) reasons.push('priority-panel-outside-viewport');

        if (isVisiblyRendered(overlayHeader) && rectsOverlap(overlayHeader.getBoundingClientRect(), priorityRect)) reasons.push('header-overlay-obscures-content');
        if (isVisiblyRendered(overlayKpis) && rectsOverlap(overlayKpis.getBoundingClientRect(), priorityRect)) reasons.push('kpi-overlay-obscures-content');
      }

      if (providerPanel && window.getComputedStyle(providerPanel).display !== 'none') reasons.push('provider-watch-visible-in-compact-mode');
      if (footer && window.getComputedStyle(footer).display !== 'none') reasons.push('footer-visible-in-compact-mode');
      if (document.documentElement.scrollWidth > window.innerWidth + 1) reasons.push(`horizontal-page-overflow:${document.documentElement.scrollWidth}`);
      if (document.documentElement.scrollHeight > window.innerHeight + 1) reasons.push(`vertical-page-overflow:${document.documentElement.scrollHeight}`);
      if (!telemetry || !isVisiblyRendered(telemetry)) reasons.push('freshness-telemetry-missing');

      if (signalCount > 0 && primaryArticles.length !== signalCount) reasons.push(`signal-count:${primaryArticles.length}/${signalCount}`);
      if (signalCount === 0 && !emptyState) reasons.push('empty-state-missing');

      if (alertWindowMs !== null) {
        const cutoff = Date.now() - alertWindowMs;
        const outsideWindow = primaryArticles.filter(article => {
          const updatedAt = Date.parse(article.dataset.updatedAt || '');
          return !Number.isFinite(updatedAt) || updatedAt < cutoff;
        });
        if (outsideWindow.length) reasons.push(`alerts-outside-window:${outsideWindow.length}`);
      }

      if (priorityList && priorityTrack && priorityGroup && signalCount > 1) {
        const contentHeight = Math.ceil(priorityGroup.getBoundingClientRect().height);
        if (contentHeight > priorityList.clientHeight + 2 && !priorityTrack.classList.contains('is-looping')) reasons.push('priority-marquee-not-running');
      }

      if (providerRail && providerTrack && providerGroup && providerCount > 1) {
        const contentWidth = Math.ceil(providerGroup.getBoundingClientRect().width);
        if (contentWidth > providerRail.clientWidth + 2 && !providerTrack.classList.contains('is-looping')) reasons.push('provider-marquee-not-running');
      }

      const dataReady = signalCount === 0 ? Boolean(emptyState) : primaryArticles.length === signalCount;
      if (!dataReady || !telemetry || !priority) {
        shell.dataset.layoutProbeDetail = 'waiting-for-wallboard-data';
        return;
      }

      if (reasons.length && attempts < LAYOUT_PROBE_ATTEMPTS) {
        shell.dataset.layoutProbeDetail = reasons.join('|');
        return;
      }

      shell.dataset.layoutProbe = reasons.length ? 'fail' : 'pass';
      shell.dataset.layoutProbeDetail = reasons.length
        ? reasons.join('|')
        : `viewport:${window.innerWidth}x${window.innerHeight};signals:${signalCount};providers:${providerCount}`;
      window.clearInterval(timer);
    };

    timer = window.setInterval(evaluate, 250);
    window.requestAnimationFrame(evaluate);

    return () => window.clearInterval(timer);
  }, [alertWindowMs, providerCount, shellRef, signalCount]);
}

function SignalRows({ signals, now, copy = false }: { signals: ActionItem[]; now: number; copy?: boolean }): JSX.Element {
  return (
    <div className={`wallboard-priority-group${copy ? ' wallboard-priority-copy' : ''}`} aria-hidden={copy || undefined}>
      {signals.map(item => (
        <article
          key={`${copy ? 'copy:' : ''}${item.id}`}
          className={`attention-${item.attention}`}
          data-updated-at={copy ? undefined : item.updatedAt}
          data-provider-id={copy ? undefined : item.providerId}
        >
          <span className="wallboard-signal-icon"><ProviderIcon id={item.providerId} name={item.provider} /></span>
          <div><b>{item.provider}</b><h3>{item.title}</h3><p>{item.detail}</p></div>
          <time>{relativeAgeAt(item.updatedAt, now)}</time>
        </article>
      ))}
    </div>
  );
}

function AlertProviderChips({ providers, copy = false }: { providers: ActionItem[]; copy?: boolean }): JSX.Element {
  return (
    <div
      className={`wallboard-alert-provider-group${copy ? ' wallboard-alert-provider-copy' : ''}`}
      aria-hidden={copy || undefined}
    >
      {providers.map(item => (
        <span
          className="wallboard-alert-provider-chip"
          key={`${copy ? 'copy:' : ''}${item.providerId}`}
          title={item.provider}
          aria-label={copy ? undefined : item.provider}
        >
          <ProviderIcon id={item.providerId} name={item.provider} />
          <b>{item.provider}</b>
        </span>
      ))}
    </div>
  );
}

export function WallboardV2({
  model,
  lifecycle,
  now,
  browserCheckedAt,
  alertWindowMs,
  onExit
}: {
  model: IssueConsoleModel | null;
  lifecycle: DataLifecycle;
  now: number;
  browserCheckedAt: number | null;
  alertWindowMs: number | null;
  onExit: () => void;
}): JSX.Element {
  const shellRef = useRef<HTMLElement>(null);
  const priorityViewportRef = useRef<HTMLDivElement>(null);
  const priorityTrackRef = useRef<HTMLDivElement>(null);
  const priorityGroupRef = useRef<HTMLDivElement>(null);
  const providerViewportRef = useRef<HTMLDivElement>(null);
  const providerTrackRef = useRef<HTMLDivElement>(null);
  const providerGroupRef = useRef<HTMLDivElement>(null);
  const { headerMode, controlsVisible, restoreVisible, setHeaderMode } = useWallboardControls();

  const signals = useMemo(() => (model?.actionQueue || [])
    .filter(item => item.kind === 'incident' && isAlertWithinWindow(item.updatedAt, now, alertWindowMs))
    .sort((a, b) => {
      const timeDifference = timestamp(b.updatedAt) - timestamp(a.updatedAt);
      return timeDifference || a.provider.localeCompare(b.provider) || a.title.localeCompare(b.title);
    }), [alertWindowMs, model?.actionQueue, now]);

  const alertProviders = useMemo(() => {
    const seen = new Set<string>();
    return signals.filter(item => {
      if (seen.has(item.providerId)) return false;
      seen.add(item.providerId);
      return true;
    });
  }, [signals]);

  usePriorityMarquee(priorityViewportRef, priorityTrackRef, priorityGroupRef, signals.length);
  useProviderMarquee(providerViewportRef, providerTrackRef, providerGroupRef, alertProviders.length);
  useWallboardLayoutProbe(shellRef, alertWindowMs, signals.length, alertProviders.length);

  const providers = useMemo(() => (model?.diagnostics || [])
    .filter(item => item.attention !== 'informational' || item.sourceHealth !== 'healthy')
    .slice(0, 24), [model?.diagnostics]);

  const shellClassName = [
    'wallboard-shell',
    'wallboard-v2',
    controlsVisible ? 'wallboard-controls-visible' : '',
    headerMode === 'open' ? 'wallboard-controls-pinned-open' : '',
    headerMode === 'closed' ? 'wallboard-controls-pinned-closed' : ''
  ].filter(Boolean).join(' ');

  return (
    <section className={shellClassName} data-header-mode={headerMode} ref={shellRef}>
      <header>
        <div><span>MSP service operations</span><h1>Enterprise service intelligence</h1></div>
        <div className="wallboard-clock"><strong>{clockLabel(now)}</strong><span>{dateLabel(now)} · ET</span></div>
        <div className="wallboard-connection"><span className={`connection-indicator lifecycle-${lifecycle.phase}`} /><b>{titleCase(lifecycle.phase)}</b><small>{relativeAgeAt(model?.generatedAt, now)}</small></div>
        <div className="wallboard-overlay-actions">
          <button
            type="button"
            className="wallboard-overlay-action wallboard-overlay-pin"
            aria-pressed={headerMode === 'open'}
            onClick={() => setHeaderMode(headerMode === 'open' ? 'auto' : 'open')}
          >
            {headerMode === 'open' ? 'Auto hide' : 'Pin open'}
          </button>
          <button type="button" className="wallboard-overlay-action" onClick={() => setHeaderMode('closed')}>Minimize</button>
        </div>
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
        <section
          className="wallboard-priority wallboard-priority-v2"
          data-alert-window-ms={alertWindowMs ?? undefined}
        >
          <h2>
            <span>Priority signals</span>
            <span className="wallboard-mini-telemetry" aria-label="Wallboard freshness telemetry">
              <span>Payload <b>{compactAgeLabel(model?.generatedAt, now)}</b></span>
              <span>Browser <b>{compactAgeLabel(browserCheckedAt, now)}</b></span>
            </span>
          </h2>
          <div
            className="wallboard-alert-provider-rail"
            aria-label="Providers with active alerts"
            ref={providerViewportRef}
          >
            {alertProviders.length ? (
              <div className="wallboard-alert-provider-track" ref={providerTrackRef}>
                <div ref={providerGroupRef}><AlertProviderChips providers={alertProviders} /></div>
                <AlertProviderChips providers={alertProviders} copy />
              </div>
            ) : null}
          </div>
          <div className="wallboard-priority-list" ref={priorityViewportRef}>
            {signals.length ? (
              <div className="wallboard-priority-track" ref={priorityTrackRef}>
                <div ref={priorityGroupRef}><SignalRows signals={signals} now={now} /></div>
                <SignalRows signals={signals} now={now} copy />
              </div>
            ) : <div className="empty-state"><b>{alertWindowMs === null ? 'No active vendor incidents' : 'No vendor incidents in the selected alert window'}</b></div>}
          </div>
        </section>

        <section className="wallboard-providers">
          <h2>Provider watch</h2>
          <div>{providers.map(source => <article key={source.id}><ProviderIcon id={source.id} name={source.provider} /><span><b>{source.provider}</b><small>{titleCase(source.serviceState)} · {titleCase(source.sourceHealth)}</small></span><strong>{source.dataQualityScore}</strong></article>)}</div>
        </section>
      </main>

      <footer><span>{model?.version || 'loading'}</span><span>{model?.collection?.run_id || 'legacy run'}</span><span>First-party public sources · fail closed</span></footer>

      <button
        type="button"
        className={`wallboard-overlay-restore${restoreVisible ? ' is-visible' : ''}`}
        onClick={() => setHeaderMode('auto')}
      >
        Show header
      </button>
    </section>
  );
}
