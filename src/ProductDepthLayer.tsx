import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { IssueConsoleModel } from './statusViewModel';
import {
  buildChangeDigest,
  buildHandoffText,
  buildUniverseGraph,
  buildWorkspaceSearchIndex,
  effectiveOperatorStatus,
  readOperatorWorkspace,
  relatedCorrelation,
  removeLens,
  saveLens,
  searchWorkspace,
  togglePinnedProvider,
  updateIncidentAction,
  writeOperatorWorkspace,
  type OperatorWorkspaceState,
  type WorkspaceSearchEntry
} from './operatorWorkspace';

interface ProductDepthLayerProps {
  model: IssueConsoleModel | null;
}

type ProductCommandDetail = {
  command?: 'universe' | 'search' | 'changes' | 'watchlist' | 'focus';
  target?: string;
};

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function relativeLabel(value?: string): string {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return 'unknown';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

function focusFromLocation(): string | null {
  return new URLSearchParams(location.search).get('focus');
}

function lensFromLocation(): string | null {
  return new URLSearchParams(location.search).get('lens');
}

function replaceProductLocation(focus: string | null, lensId?: string | null): void {
  const search = new URLSearchParams(location.search);
  if (focus) search.set('focus', focus); else search.delete('focus');
  if (lensId) search.set('lens', lensId); else search.delete('lens');
  history.replaceState(null, '', `${location.pathname}${search.size ? `?${search}` : ''}${location.hash}`);
}

function copyText(value: string): Promise<void> {
  return navigator.clipboard.writeText(value);
}

function activateSvgButton(event: ReactKeyboardEvent<SVGGElement>, action: () => void): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  action();
}

function SearchResult({ entry, onOpen }: { entry: WorkspaceSearchEntry; onOpen: (target: string) => void }): JSX.Element {
  return (
    <button type="button" className="depth-search-result" onClick={() => onOpen(entry.target)}>
      <span className={`depth-kind depth-kind-${entry.kind}`}>{entry.kind}</span>
      <span><b>{entry.title}</b><small>{entry.subtitle}</small></span>
      <em>Open</em>
    </button>
  );
}

function WorkspaceBadge({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: string }): JSX.Element {
  return <div className={`depth-stat depth-stat-${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

export function ProductDepthLayer({ model }: ProductDepthLayerProps): JSX.Element | null {
  const [focus, setFocus] = useState<string | null>(() => focusFromLocation());
  const [selectedLensId, setSelectedLensId] = useState<string | null>(() => lensFromLocation());
  const [workspace, setWorkspace] = useState<OperatorWorkspaceState>(() => readOperatorWorkspace());
  const [query, setQuery] = useState('');
  const [lensName, setLensName] = useState('');
  const [replayIndex, setReplayIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const searchIndex = useMemo(() => model ? buildWorkspaceSearchIndex(model) : [], [model]);
  const searchResults = useMemo(() => searchWorkspace(searchIndex, query), [searchIndex, query]);
  const graph = useMemo(() => model ? buildUniverseGraph(model) : { nodes: [], edges: [] }, [model]);
  const digest = useMemo(() => model ? buildChangeDigest(model, workspace.lastSeenGeneratedAt) : null, [model, workspace.lastSeenGeneratedAt]);
  const history = useMemo(() => model ? [...model.history].sort((a, b) => Date.parse(a.detected_at) - Date.parse(b.detected_at)) : [], [model]);
  const replayChange = history.length ? history[Math.min(replayIndex, history.length - 1)] : undefined;
  const replayTrailIds = useMemo(() => new Set(history.slice(Math.max(0, replayIndex - 7), replayIndex + 1).map(change => change.provider_id)), [history, replayIndex]);
  const selectedLens = workspace.lenses.find(lens => lens.id === selectedLensId);
  const lensProviderIds = useMemo(() => new Set(selectedLens?.providerIds || []), [selectedLens]);

  const incidentId = focus?.startsWith('incident:') ? focus.slice('incident:'.length) : null;
  const providerId = focus?.startsWith('provider:') ? focus.slice('provider:'.length) : null;
  const categoryFocus = focus?.startsWith('category:') ? focus.slice('category:'.length) : null;
  const correlationId = focus?.startsWith('correlation:') ? focus.slice('correlation:'.length) : null;
  const incident = model?.briefs.find(item => item.id === incidentId);
  const provider = model?.diagnostics.find(item => item.id === providerId);
  const correlation = incident && model ? relatedCorrelation(model, incident) : correlationId ? model?.correlations.find(item => item.id === correlationId) : undefined;
  const incidentSource = incident ? model?.diagnostics.find(item => item.id === incident.providerId) : undefined;
  const operatorAction = incident ? workspace.actions[incident.id] : undefined;
  const actionStatus = effectiveOperatorStatus(operatorAction);

  useEffect(() => {
    writeOperatorWorkspace(workspace);
  }, [workspace]);

  useEffect(() => {
    if (!history.length) return;
    setReplayIndex(history.length - 1);
  }, [history.length]);

  useEffect(() => {
    const onPopState = () => {
      setFocus(focusFromLocation());
      setSelectedLensId(lensFromLocation());
    };
    const onProductCommand = (event: Event) => {
      const detail = (event as CustomEvent<ProductCommandDetail>).detail || {};
      if (detail.command === 'focus' && detail.target) openTarget(detail.target);
      else if (detail.command) openTarget(detail.command);
    };
    const onKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && focus) {
        event.preventDefault();
        close();
        return;
      }
      const target = event.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if (typing) return;
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openTarget('search');
      }
      if (event.key.toLowerCase() === 'g' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        openTarget('universe');
      }
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('serviceops:product-command', onProductCommand);
    window.addEventListener('keydown', onKeyboard);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('serviceops:product-command', onProductCommand);
      window.removeEventListener('keydown', onKeyboard);
    };
  });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!model) return null;

  function openTarget(target: string, lensId?: string | null): void {
    setFocus(target);
    setSelectedLensId(lensId || null);
    replaceProductLocation(target, lensId);
    if (target === 'search') setQuery('');
  }

  function close(): void {
    setFocus(null);
    setSelectedLensId(null);
    replaceProductLocation(null);
  }

  function updateWorkspace(next: OperatorWorkspaceState): void {
    setWorkspace(next);
  }

  async function copyShareLink(): Promise<void> {
    try {
      await copyText(location.href);
      setToast('Shareable investigation link copied');
    } catch {
      setToast('Clipboard unavailable');
    }
  }

  async function copyHandoff(): Promise<void> {
    if (!incident) return;
    try {
      await copyText(buildHandoffText(incident, incidentSource, operatorAction, correlation));
      setToast('Operator handoff copied');
    } catch {
      setToast('Clipboard unavailable');
    }
  }

  function setAction(status: 'open' | 'acknowledged' | 'following' | 'snoozed' | 'resolved'): void {
    if (!incident) return;
    const snoozedUntil = status === 'snoozed' ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : undefined;
    updateWorkspace(updateIncidentAction(workspace, incident.id, { status, snoozedUntil }));
    setToast(status === 'snoozed' ? 'Signal snoozed locally for 30 minutes' : `Local operator state: ${status}`);
  }

  const focusOpen = Boolean(focus);
  if (!focusOpen) return null;

  return (
    <div className="depth-layer" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) close();
    }}>
      <section className={`depth-shell depth-shell-${focus?.split(':')[0] || 'unknown'}`} role="dialog" aria-modal="true" aria-label="ServiceOps product command workspace">
        <header className="depth-header">
          <div><span>ServiceOps / Command system</span><h2>{focus === 'universe' || categoryFocus || correlationId ? 'Dependency Universe' : focus === 'search' ? 'Search everything' : focus === 'changes' ? 'What changed' : focus === 'watchlist' ? 'My operational lens' : incident ? 'Incident Focus' : provider ? 'Provider Focus' : 'Command system'}</h2></div>
          <nav aria-label="Product command workspace">
            <button type="button" aria-current={focus === 'universe' || Boolean(categoryFocus) || Boolean(correlationId) ? 'page' : undefined} onClick={() => openTarget('universe')}>Universe</button>
            <button type="button" aria-current={focus === 'changes' ? 'page' : undefined} onClick={() => openTarget('changes')}>Changes{digest?.changes.length ? <em>{digest.changes.length}</em> : null}</button>
            <button type="button" aria-current={focus === 'search' ? 'page' : undefined} onClick={() => openTarget('search')}>Search</button>
            <button type="button" aria-current={focus === 'watchlist' ? 'page' : undefined} onClick={() => openTarget('watchlist')}>Watchlist{workspace.pinnedProviderIds.length ? <em>{workspace.pinnedProviderIds.length}</em> : null}</button>
          </nav>
          <div className="depth-header-actions"><button type="button" onClick={copyShareLink}>Share</button><button type="button" className="depth-close" aria-label="Close product command workspace" onClick={close}>×</button></div>
        </header>

        {(focus === 'universe' || categoryFocus || correlationId) && <div className="depth-universe-layout">
          <main className="depth-universe-stage">
            <div className="depth-stage-heading"><div><span>Live dependency field</span><h3>{selectedLens ? selectedLens.name : categoryFocus || correlation?.label || 'Your monitored service estate'}</h3><p>Category gravity shows dependency domains. Bright links are vendor-timed temporal correlations only, never inferred causality.</p></div><div className="depth-stage-legend"><span className="is-critical">Major / blind</span><span className="is-warning">Degraded / watch</span><span className="is-positive">Operational</span><span className="is-correlation">Temporal cluster</span></div></div>
            <svg className="dependency-universe" viewBox="0 0 1200 720" role="group" aria-label="Interactive provider dependency universe">
              <defs>
                <radialGradient id="depth-core" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="rgba(104,129,255,.24)"/><stop offset="100%" stopColor="rgba(104,129,255,0)"/></radialGradient>
                <filter id="depth-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>
              <circle cx="600" cy="360" r="235" fill="url(#depth-core)" />
              {graph.edges.map(edge => {
                const from = graph.nodes.find(node => node.id === edge.from);
                const to = graph.nodes.find(node => node.id === edge.to);
                if (!from || !to) return null;
                return <line key={edge.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={`depth-edge depth-edge-${edge.kind} ${edge.confidence ? `is-${edge.confidence}` : ''}`} />;
              })}
              {graph.nodes.filter(node => node.kind === 'category').map(node => <g key={node.id} className={`depth-node depth-category-node depth-tone-${node.tone}`} onClick={() => openTarget(`category:${node.category}`)} onKeyDown={event => activateSvgButton(event, () => openTarget(`category:${node.category}`))} role="button" aria-label={`${node.label} category`} tabIndex={0}>
                <circle cx={node.x} cy={node.y} r="33" />
                <text x={node.x} y={node.y + 4}>{node.label.slice(0, 18)}</text>
                <title>{`${node.label} category`}</title>
              </g>)}
              {graph.nodes.filter(node => node.kind === 'provider').map(node => {
                const dimmed = selectedLens && node.providerId ? !lensProviderIds.has(node.providerId) : categoryFocus ? node.category !== categoryFocus : false;
                const replayed = node.providerId ? replayTrailIds.has(node.providerId) : false;
                const pinned = node.providerId ? workspace.pinnedProviderIds.includes(node.providerId) : false;
                const showLabel = node.tone !== 'positive' || node.criticality === 'high' || pinned || replayed;
                const openProvider = () => node.providerId && openTarget(`provider:${node.providerId}`);
                return <g key={node.id} className={`depth-node depth-provider-node depth-tone-${node.tone} ${dimmed ? 'is-dimmed' : ''} ${replayed ? 'is-replayed' : ''} ${pinned ? 'is-pinned' : ''}`} onClick={openProvider} onKeyDown={event => activateSvgButton(event, openProvider)} role="button" aria-label={`${node.label}, ${node.category}, ${node.tone}`} tabIndex={0}>
                  <circle cx={node.x} cy={node.y} r={node.criticality === 'high' ? 10 : 7} />
                  {showLabel && <text x={node.x + 13} y={node.y + 4}>{node.label.slice(0, 18)}</text>}
                  <title>{`${node.label} · ${node.category} · ${node.tone}`}</title>
                </g>;
              })}
            </svg>
            <div className="depth-replay">
              <div><span>Signal replay</span><b>{replayChange ? `${replayChange.provider}: ${replayChange.title}` : 'No bounded history yet'}</b><small>{replayChange ? `${titleCase(replayChange.type)} · ${relativeLabel(replayChange.detected_at)}` : 'Replay highlights recorded changes only; it does not reconstruct unobserved service state.'}</small></div>
              <input aria-label="Replay recorded operational changes" type="range" min="0" max={Math.max(0, history.length - 1)} value={Math.min(replayIndex, Math.max(0, history.length - 1))} onChange={event => setReplayIndex(Number(event.target.value))} disabled={!history.length} />
              <span>{history.length ? `${replayIndex + 1} / ${history.length}` : '0 / 0'}</span>
            </div>
          </main>
          <aside className="depth-universe-rail">
            <section><span className="depth-eyebrow">Live posture</span><div className="depth-stat-grid"><WorkspaceBadge label="Incidents" value={model.incidentCount} tone={model.incidentCount ? 'critical' : 'positive'} /><WorkspaceBadge label="Correlations" value={model.correlations.length} tone={model.correlations.length ? 'warning' : 'neutral'} /><WorkspaceBadge label="Blind" value={model.blindSpotCount} tone={model.blindSpotCount ? 'critical' : 'positive'} /><WorkspaceBadge label="Coverage" value={`${model.summary.coverage_percent}%`} tone="positive" /></div></section>
            <section><div className="depth-section-title"><span>Active correlation clusters</span><b>{model.correlations.length}</b></div>{model.correlations.length ? <div className="depth-correlation-list">{model.correlations.slice(0, 6).map(item => <button key={item.id} type="button" onClick={() => openTarget(`correlation:${item.id}`)}><span className={`confidence-${item.confidence}`}>{item.confidence}</span><b>{item.label}</b><small>{item.providers.join(' · ')}</small><p>{item.rationale}</p></button>)}</div> : <div className="depth-empty"><b>No active temporal clusters</b><span>The current vendor-timed incident set does not cross the cautious correlation thresholds.</span></div>}</section>
            <section><div className="depth-section-title"><span>Saved lenses</span><b>{workspace.lenses.length}</b></div>{workspace.lenses.length ? <div className="depth-lens-list">{workspace.lenses.map(lens => <button type="button" key={lens.id} className={selectedLensId === lens.id ? 'is-active' : ''} onClick={() => openTarget('universe', lens.id)}><b>{lens.name}</b><small>{lens.providerIds.length} providers</small></button>)}</div> : <div className="depth-empty"><span>Create a lens from Watchlist to isolate the dependencies you care about.</span></div>}</section>
          </aside>
        </div>}

        {focus === 'search' && <div className="depth-search-view">
          <div className="depth-search-hero"><span className="depth-eyebrow">Universal command search</span><h3>Find any provider, incident, maintenance window, correlation, category, or recorded change.</h3><label><span>⌕</span><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Try Microsoft, identity, source failure, Kaseya…" /></label><small>Shortcut: Command/Ctrl + Shift + K</small></div>
          <div className="depth-search-results">{searchResults.map(entry => <SearchResult key={entry.id} entry={entry} onOpen={openTarget} />)}{!searchResults.length && <div className="depth-empty depth-empty-large"><b>No matches</b><span>Search covers live providers, incidents, maintenance, correlations, categories, and bounded change history.</span></div>}</div>
        </div>}

        {focus === 'changes' && digest && <div className="depth-changes-view">
          <section className="depth-change-hero"><div><span className="depth-eyebrow">Since your last catch-up</span><h3>{digest.changes.length ? `${digest.changes.length} meaningful operating-model changes` : 'You are caught up'}</h3><p>This view compares bounded recorded changes against the last payload you explicitly marked as reviewed. It does not infer events that were never observed.</p></div><button type="button" onClick={() => { updateWorkspace({ ...workspace, lastSeenGeneratedAt: model.generatedAt }); setToast('Current payload marked reviewed'); }}>Mark current payload reviewed</button></section>
          <section className="depth-change-kpis"><WorkspaceBadge label="New incidents" value={digest.newIncidents} tone={digest.newIncidents ? 'critical' : 'neutral'} /><WorkspaceBadge label="Recoveries" value={digest.recoveries} tone={digest.recoveries ? 'positive' : 'neutral'} /><WorkspaceBadge label="Source changes" value={digest.sourceChanges} tone={digest.sourceChanges ? 'warning' : 'neutral'} /><WorkspaceBadge label="Maintenance" value={digest.maintenanceChanges} /><WorkspaceBadge label="Severity" value={digest.severityChanges} tone={digest.severityChanges ? 'warning' : 'neutral'} /></section>
          <section className="depth-change-stream">{digest.changes.length ? digest.changes.map(change => <button type="button" key={change.id} onClick={() => openTarget(`provider:${change.provider_id}`)}><span className={`depth-change-dot depth-attention-${change.attention}`} /><div><b>{change.provider}</b><h4>{change.title}</h4><small>{titleCase(change.type)} · {relativeLabel(change.detected_at)}</small></div><em>Investigate</em></button>) : <div className="depth-empty depth-empty-large"><b>No recorded changes since your last review</b><span>Current service truth and source trust remain visible in the main workspace.</span></div>}</section>
        </div>}

        {focus === 'watchlist' && <div className="depth-watchlist-view">
          <section className="depth-watchlist-hero"><div><span className="depth-eyebrow">Browser-local operator workspace</span><h3>Build the lens you actually work from.</h3><p>Pins, lenses, acknowledgements, notes, assignees, follows, and snoozes stay in this browser. They never alter public vendor truth or pretend to be shared team state.</p></div><div className="depth-lens-composer"><input value={lensName} onChange={event => setLensName(event.target.value)} placeholder="Lens name" /><button type="button" disabled={!lensName.trim() || !workspace.pinnedProviderIds.length} onClick={() => { updateWorkspace(saveLens(workspace, lensName, workspace.pinnedProviderIds)); setLensName(''); setToast('Watchlist saved as a lens'); }}>Save pinned lens</button></div></section>
          <div className="depth-watchlist-grid">
            <section><div className="depth-section-title"><span>Pinned providers</span><b>{workspace.pinnedProviderIds.length}</b></div>{workspace.pinnedProviderIds.length ? <div className="depth-provider-list">{workspace.pinnedProviderIds.map(id => model.diagnostics.find(item => item.id === id)).filter((item): item is NonNullable<typeof item> => Boolean(item)).map(item => <article key={item.id}><button type="button" className="depth-provider-open" onClick={() => openTarget(`provider:${item.id}`)}><span className={`depth-provider-orb depth-tone-${item.serviceState === 'major' || item.sourceHealth === 'blind' ? 'critical' : item.serviceState === 'degraded' || item.sourceHealth === 'watch' ? 'warning' : 'positive'}`} /><span><b>{item.provider}</b><small>{item.category} · {item.serviceState} · source {item.sourceHealth}</small></span></button><button type="button" className="depth-unpin" onClick={() => updateWorkspace(togglePinnedProvider(workspace, item.id))}>Unpin</button></article>)}</div> : <div className="depth-empty"><b>No pinned providers yet</b><span>Open any provider from the Dependency Universe and pin it here.</span></div>}</section>
            <section><div className="depth-section-title"><span>Saved lenses</span><b>{workspace.lenses.length}</b></div>{workspace.lenses.length ? <div className="depth-saved-lenses">{workspace.lenses.map(lens => <article key={lens.id}><button type="button" onClick={() => openTarget('universe', lens.id)}><b>{lens.name}</b><small>{lens.providerIds.length} providers · saved {relativeLabel(lens.createdAt)}</small></button><button type="button" aria-label={`Delete ${lens.name}`} onClick={() => updateWorkspace(removeLens(workspace, lens.id))}>×</button></article>)}</div> : <div className="depth-empty"><b>No saved lenses</b><span>Pin the dependencies that matter and save them as a reusable universe view.</span></div>}</section>
          </div>
        </div>}

        {provider && <div className="depth-focus-view">
          <section className="depth-focus-hero"><div><span className="depth-eyebrow">Provider focus</span><h3>{provider.provider}</h3><p>{provider.message || provider.status}</p><div className="depth-focus-tags"><span>{provider.category}</span><span>{provider.criticality} criticality</span><span>{provider.truthBasis}</span></div></div><div className="depth-focus-actions"><button type="button" onClick={() => updateWorkspace(togglePinnedProvider(workspace, provider.id))}>{workspace.pinnedProviderIds.includes(provider.id) ? 'Unpin' : 'Pin to watchlist'}</button><a href={provider.source} target="_blank" rel="noopener noreferrer">Official source ↗</a></div></section>
          <section className="depth-focus-metrics"><WorkspaceBadge label="Service" value={titleCase(provider.serviceState)} tone={provider.serviceState === 'major' ? 'critical' : provider.serviceState === 'degraded' ? 'warning' : 'positive'} /><WorkspaceBadge label="Source" value={titleCase(provider.sourceHealth)} tone={provider.sourceHealth === 'blind' ? 'critical' : provider.sourceHealth === 'watch' ? 'warning' : 'positive'} /><WorkspaceBadge label="Quality" value={`${provider.dataQualityScore}/100`} /><WorkspaceBadge label="Incidents" value={provider.activeIncidentCount} tone={provider.activeIncidentCount ? 'critical' : 'neutral'} /><WorkspaceBadge label="Observed" value={relativeLabel(provider.lastSuccessAt || provider.checkedAt)} /></section>
          <div className="depth-focus-columns"><section><div className="depth-section-title"><span>Active incident rooms</span><b>{provider.activeIncidentCount}</b></div>{model.briefs.filter(item => item.providerId === provider.id).length ? model.briefs.filter(item => item.providerId === provider.id).map(item => <button type="button" className="depth-incident-card" key={item.id} onClick={() => openTarget(`incident:${item.id}`)}><span className={`depth-priority depth-priority-${item.service_state}`}>{item.service_state}</span><h4>{item.title}</h4><p>{item.note}</p><small>{item.operatorPriority}</small></button>) : <div className="depth-empty"><b>No active vendor incident</b><span>Provider truth may still be unknown or source-limited; inspect the source state before assuming health.</span></div>}</section><section><div className="depth-section-title"><span>Evidence and collection</span><b>{provider.sourceConfidence}</b></div><dl className="depth-facts"><div><dt>Truth basis</dt><dd>{titleCase(provider.truthBasis)}</dd></div><div><dt>Evidence tier</dt><dd>{titleCase(provider.evidenceTier)}</dd></div><div><dt>Source host</dt><dd>{provider.sourceHost || 'Unknown'}</dd></div><div><dt>Request latency</dt><dd>{Math.round(provider.sourceLatencyMs)} ms</dd></div><div><dt>Failures</dt><dd>{provider.consecutiveFailures}</dd></div><div><dt>Freshness</dt><dd>{titleCase(provider.freshnessState)}</dd></div></dl></section></div>
        </div>}

        {incident && <div className="depth-incident-room">
          <section className="depth-incident-hero"><div><span className={`depth-priority depth-priority-${incident.service_state}`}>{incident.operatorPriority}</span><span className="depth-eyebrow">Incident Focus / {incident.provider}</span><h3>{incident.title}</h3><p>{incident.note}</p><div className="depth-focus-tags"><span>{incident.category}</span><span>{incident.evidenceLabel}</span><span>updated {relativeLabel(incident.latest_update || incident.first_detected || incident.observed_at)}</span></div></div><div className="depth-room-state"><span>Local operator state</span><strong>{titleCase(actionStatus)}</strong><small>Browser-only workflow state</small></div></section>
          <div className="depth-room-grid">
            <main>
              <section className="depth-room-panel depth-room-actions"><div className="depth-section-title"><span>Operator action loop</span><b>Local only</b></div><div className="depth-action-buttons"><button type="button" className={actionStatus === 'acknowledged' ? 'is-active' : ''} onClick={() => setAction('acknowledged')}>Acknowledge</button><button type="button" className={actionStatus === 'following' ? 'is-active' : ''} onClick={() => setAction('following')}>Follow</button><button type="button" className={actionStatus === 'snoozed' ? 'is-active' : ''} onClick={() => setAction('snoozed')}>Snooze 30m</button><button type="button" className={actionStatus === 'resolved' ? 'is-active' : ''} onClick={() => setAction('resolved')}>Mark handled</button><button type="button" onClick={() => setAction('open')}>Reset local state</button></div><div className="depth-operator-fields"><label><span>Local assignee</span><input value={operatorAction?.assignee || ''} onChange={event => updateWorkspace(updateIncidentAction(workspace, incident.id, { assignee: event.target.value }))} placeholder="Name or shift" /></label><label><span>Operator note</span><textarea value={operatorAction?.note || ''} onChange={event => updateWorkspace(updateIncidentAction(workspace, incident.id, { note: event.target.value }))} placeholder="What have you checked? What should the next operator know?" /></label></div><div className="depth-room-cta"><button type="button" onClick={copyHandoff}>Copy handoff bundle</button><button type="button" onClick={async () => { try { await copyText(incident.clientDraft); setToast('Client-safe draft copied'); } catch { setToast('Clipboard unavailable'); } }}>Copy client-safe update</button><a href={incident.url} target="_blank" rel="noopener noreferrer">Official incident ↗</a></div></section>
              <section className="depth-room-panel"><div className="depth-section-title"><span>Vendor timeline</span><b>{incident.updates?.length || 0} updates</b></div>{incident.updates?.length ? <ol className="depth-vendor-timeline">{incident.updates.map((update, index) => <li key={`${update.at || 'unknown'}-${index}`}><time>{update.at ? relativeLabel(update.at) : 'time unavailable'}</time><div><b>{titleCase(update.status || 'update')}</b><p>{update.note}</p></div></li>)}</ol> : <div className="depth-empty"><span>No structured vendor update timeline is available for this incident.</span></div>}</section>
            </main>
            <aside>
              <section className="depth-room-panel"><div className="depth-section-title"><span>Impact and next move</span></div><div className="depth-guidance"><span>Likely MSP impact</span><p>{incident.mspImpact}</p><span>Technician action</span><p>{incident.technicianAction}</p><span>Client-safe language</span><p>{incident.clientDraft}</p></div></section>
              <section className="depth-room-panel"><div className="depth-section-title"><span>Evidence</span><b>{incidentSource?.dataQualityScore ?? 0}/100</b></div><dl className="depth-facts"><div><dt>Truth basis</dt><dd>{incidentSource ? titleCase(incidentSource.truthBasis) : 'Unknown'}</dd></div><div><dt>Source trust</dt><dd>{incidentSource ? titleCase(incidentSource.sourceHealth) : 'Unknown'}</dd></div><div><dt>Evidence tier</dt><dd>{incidentSource ? titleCase(incidentSource.evidenceTier) : incident.evidenceLabel}</dd></div><div><dt>Observed</dt><dd>{relativeLabel(incident.observed_at || incident.latest_update || incident.first_detected)}</dd></div></dl></section>
              <section className="depth-room-panel"><div className="depth-section-title"><span>Correlation context</span><b>{correlation?.confidence || 'none'}</b></div>{correlation ? <div className="depth-correlation-focus"><h4>{correlation.label}</h4><p>{correlation.providers.join(' · ')}</p><small>{correlation.rationale}</small><button type="button" onClick={() => openTarget(`correlation:${correlation.id}`)}>View in Dependency Universe</button></div> : <div className="depth-empty"><span>No cautious vendor-timed temporal cluster currently includes this incident.</span></div>}</section>
            </aside>
          </div>
        </div>}
      </section>
      {toast && <div className="depth-toast" role="status">{toast}</div>}
    </div>
  );
}
