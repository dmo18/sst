import { useEffect, useMemo, useRef, useState } from 'react';
import type { IssueConsoleModel } from './statusViewModel';

interface ExperienceLayerProps {
  model: IssueConsoleModel | null;
  lifecyclePhase: string;
  onRefresh: () => void;
}

type Command = {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  icon: string;
  action: () => void;
};

function dispatchShortcut(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function pulseCopy(model: IssueConsoleModel | null): { label: string; detail: string; tone: string } {
  if (!model) return { label: 'Validating intelligence', detail: 'Waiting for a trusted operating model', tone: 'neutral' };
  if (model.summary.major_count > 0) return {
    label: `${model.summary.major_count} major ${model.summary.major_count === 1 ? 'incident' : 'incidents'}`,
    detail: `${model.affectedCount} affected providers require attention`,
    tone: 'critical'
  };
  if (model.summary.degraded_count > 0) return {
    label: `${model.summary.degraded_count} degraded ${model.summary.degraded_count === 1 ? 'provider' : 'providers'}`,
    detail: `${model.incidentCount} active vendor events in the operating model`,
    tone: 'warning'
  };
  if (model.blindSpotCount > 0) return {
    label: `${model.blindSpotCount} source ${model.blindSpotCount === 1 ? 'blind spot' : 'blind spots'}`,
    detail: 'No major incident is confirmed, but visibility needs attention',
    tone: 'warning'
  };
  return {
    label: 'Operational pulse is clear',
    detail: `${model.summary.coverage_percent}% live source coverage · quality ${model.qualityScore}`,
    tone: 'positive'
  };
}

export function ExperienceLayer({ model, lifecyclePhase, onRefresh }: ExperienceLayerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pulse = pulseCopy(model);
  const commandShortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform) ? '⌘K' : 'Ctrl K';

  const commands = useMemo<Command[]>(() => {
    const liveSignals: Command[] = (model?.actionQueue || [])
      .filter(item => item.kind === 'incident')
      .slice(0, 4)
      .map(item => ({
        id: `signal:${item.id}`,
        label: `${item.provider}: ${item.title}`,
        description: `${item.action} · ${item.detail}`,
        icon: item.attention === 'critical' ? '!' : '↑',
        action: () => {
          dispatchShortcut('2');
          setToast(`Opening ${item.provider} incident operations`);
        }
      }));

    return [
      ...liveSignals,
      { id: 'overview', label: 'Open overview', description: 'Return to the live operational posture', shortcut: '1', icon: '⌂', action: () => dispatchShortcut('1') },
      { id: 'incidents', label: 'Open incident operations', description: 'Active vendor events, impact, actions, and client-safe updates', shortcut: '2', icon: '⚡', action: () => dispatchShortcut('2') },
      { id: 'providers', label: 'Explore providers', description: 'Service state, evidence quality, latency, and freshness', shortcut: '3', icon: '◇', action: () => dispatchShortcut('3') },
      { id: 'sources', label: 'Inspect source reliability', description: 'Blind spots, SLOs, parser trust, and collection health', shortcut: '4', icon: '⌁', action: () => dispatchShortcut('4') },
      { id: 'timeline', label: 'Open audit timeline', description: 'See what changed across incidents and source health', shortcut: '5', icon: '↺', action: () => dispatchShortcut('5') },
      { id: 'wallboard', label: 'Launch wallboard', description: 'Enter the unattended signage view', shortcut: 'W', icon: '▣', action: () => dispatchShortcut('w') },
      { id: 'refresh', label: 'Refresh intelligence now', description: 'Retrieve and validate the latest deployed status payload', shortcut: 'R', icon: '↻', action: () => { onRefresh(); setToast('Validated refresh requested'); } }
    ];
  }, [model?.actionQueue, onRefresh]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter(command => `${command.label} ${command.description}`.toLowerCase().includes(needle));
  }, [commands, query]);

  useEffect(() => {
    document.documentElement.dataset.operationalTone = pulse.tone;
    return () => {
      delete document.documentElement.dataset.operationalTone;
    };
  }, [pulse.tone]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(value => !value);
        return;
      }
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (activeIndex < filtered.length) return;
    setActiveIndex(Math.max(0, filtered.length - 1));
  }, [activeIndex, filtered.length]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const run = (command: Command) => {
    command.action();
    setOpen(false);
  };

  const handleCommandKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!filtered.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => (index + 1) % filtered.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => (index - 1 + filtered.length) % filtered.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      run(filtered[activeIndex] || filtered[0]);
    }
  };

  return (
    <>
      <div className={`experience-pulse experience-${pulse.tone}`} aria-live="polite">
        <span className="experience-pulse-orb" />
        <div><b>{pulse.label}</b><span>{pulse.detail}</span></div>
        <button type="button" onClick={() => setOpen(true)} aria-label="Open command palette">
          <span>Command</span><kbd>{commandShortcut}</kbd>
        </button>
      </div>

      {open && <div className="command-layer" role="presentation" onMouseDown={event => {
        if (event.target === event.currentTarget) setOpen(false);
      }}>
        <section className="command-palette" role="dialog" aria-modal="true" aria-label="ServiceOps command palette">
          <header>
            <div className="command-brand"><span className="command-brand-mark">S</span><div><b>ServiceOps Command</b><small>{lifecyclePhase === 'ready' ? 'Live operating model' : lifecyclePhase}</small></div></div>
            <kbd>ESC</kbd>
          </header>
          <label className="command-search">
            <span>⌕</span>
            <input
              ref={inputRef}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Jump anywhere or run an action…"
              onKeyDown={handleCommandKey}
              aria-activedescendant={filtered[activeIndex] ? `command-${filtered[activeIndex].id}` : undefined}
            />
          </label>
          <div className="command-context">
            <span>Live context</span>
            <b>{model ? `${model.incidentCount} incidents · ${model.blindSpotCount} blind · ${model.summary.coverage_percent}% coverage` : 'Awaiting validated data'}</b>
          </div>
          <div className="command-list" role="listbox" aria-label="Available commands">
            {filtered.map((command, index) => <button
              type="button"
              id={`command-${command.id}`}
              key={command.id}
              className={index === activeIndex ? 'is-active' : undefined}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => run(command)}
            >
              <span className="command-icon">{command.icon}</span>
              <span><b>{command.label}</b><small>{command.description}</small></span>
              {command.shortcut && <kbd>{command.shortcut}</kbd>}
              {index === activeIndex && query && <em>Enter</em>}
            </button>)}
            {!filtered.length && <div className="command-empty"><b>No matching command</b><span>Try overview, incidents, providers, sources, wallboard, refresh, or a live provider name.</span></div>}
          </div>
          <footer><span><kbd>↑</kbd><kbd>↓</kbd> browse</span><span><kbd>↵</kbd> run selection</span><span><kbd>ESC</kbd> close</span></footer>
        </section>
      </div>}

      {toast && <div className="experience-toast" role="status"><span>✓</span>{toast}</div>}
    </>
  );
}