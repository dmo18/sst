import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import providerCatalog from '../config/providers.json';
import packageMetadata from '../package.json';
import { dataLifecycleReducer, initialDataLifecycle } from './dataLifecycle';
import { IssueConsole } from './IssueConsole';
import { normalizeStatusPayload } from './payloadMigration';
import { RequestOwnership } from './requestOwnership';
import { buildIssueConsoleModel } from './statusViewModel';
import type { ProviderConfig, StatusPayload } from './types';
import { Wallboard } from './Wallboard';
import { parseWallboardSettings, type WallboardSettings } from './wallboardConfig';

const CATALOG = providerCatalog as ProviderConfig[];
const REFRESH_MS = 60_000;
const STORAGE_KEY = 'sst-wallboard-settings';

function savedSettings(): Partial<WallboardSettings> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<WallboardSettings>; } catch { return {}; }
}
async function fetchStatus(signal: AbortSignal): Promise<StatusPayload> {
  const response = await fetch(`${import.meta.env.BASE_URL}status.json?ts=${Date.now()}`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`status.json returned HTTP ${response.status}`);
  const data: unknown = await response.json();
  const normalized = normalizeStatusPayload(data);
  if (!normalized.payload) throw new Error(`status.json is invalid: ${normalized.errors.slice(0, 3).join('; ')}`);
  return normalized.payload;
}
export function App(): JSX.Element {
  const [state, dispatch] = useReducer(dataLifecycleReducer, initialDataLifecycle);
  const [settings, setSettings] = useState(() => parseWallboardSettings(window.location.search, savedSettings()));
  const [lastSuccess, setLastSuccess] = useState<string>();
  const [lastFailure, setLastFailure] = useState<string>();
  const ownership = useRef(new RequestOwnership());
  const mounted = useRef(true);

  const updateSettings = useCallback((next: Partial<WallboardSettings>) => {
    setSettings(current => {
      const value = { ...current, ...next };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      const query = new URLSearchParams(window.location.search);
      query.set('view', value.view); query.set('screen', value.screen); query.set('rotate', String(value.rotateSeconds)); query.set('density', value.density);
      window.history.replaceState(null, '', `${window.location.pathname}?${query.toString()}`);
      return value;
    });
  }, []);
  const refresh = useCallback(async () => {
    const slot = ownership.current.begin(); if (!slot) return;
    const { controller: request, sequence } = slot; dispatch({ type: 'request' });
    try {
      const data = await fetchStatus(request.signal);
      if (mounted.current && ownership.current.owns(request, sequence)) { dispatch({ type: 'success', data }); setLastSuccess(new Date().toISOString()); }
    } catch (error) {
      if (mounted.current && ownership.current.owns(request, sequence)) { dispatch({ type: 'failure', message: error instanceof Error ? error.message : String(error) }); setLastFailure(new Date().toISOString()); }
    } finally { ownership.current.finish(request); }
  }, []);
  useEffect(() => {
    mounted.current = true; void refresh();
    const id = window.setInterval(() => { if (!document.hidden) void refresh(); }, REFRESH_MS);
    return () => { mounted.current = false; window.clearInterval(id); ownership.current.cancel(); };
  }, [refresh]);
  const model = useMemo(() => state.data ? buildIssueConsoleModel(state.data, `v${packageMetadata.version}`, CATALOG) : null, [state.data]);
  return <main className={`app-frame mode-${settings.view}`} data-view-mode={settings.view}>
    {settings.view === 'wallboard' && model
      ? <Wallboard model={model} lifecycle={state} settings={settings} onSettings={updateSettings} onMode={() => updateSettings({ view: 'operator' })} onRefresh={() => void refresh()} lastSuccess={lastSuccess} lastFailure={lastFailure}/>
      : <IssueConsole model={model} lifecycle={state} onRefresh={() => void refresh()} onWallboard={() => updateSettings({ view: 'wallboard' })}/>}
  </main>;
}
