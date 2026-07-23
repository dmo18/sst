import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import providerCatalog from '../config/providers.json';
import packageMetadata from '../package.json';
import { dataLifecycleReducer, initialDataLifecycle } from './dataLifecycle';
import { IssueConsole } from './IssueConsole';
import { buildIssueConsoleModel } from './statusViewModel';
import type { ProviderConfig, StatusPayload } from './types';

const CATALOG = providerCatalog as ProviderConfig[];
const REFRESH_MS = 60_000;

export function isStatusPayload(value: unknown): value is StatusPayload {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<StatusPayload>;
  return item.schema_version === 1 && typeof item.generated_at === 'string' && !Number.isNaN(Date.parse(item.generated_at))
    && Array.isArray(item.providers) && Array.isArray(item.incidents) && Boolean(item.summary && typeof item.summary === 'object');
}

async function fetchStatus(signal: AbortSignal): Promise<StatusPayload> {
  const response = await fetch(`${import.meta.env.BASE_URL}status.json?ts=${Date.now()}`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`status.json returned HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!isStatusPayload(data)) throw new Error('status.json has an invalid or unsupported payload');
  return data;
}

export function App(): JSX.Element {
  const [state, dispatch] = useReducer(dataLifecycleReducer, initialDataLifecycle);
  const [nextRefresh, setNextRefresh] = useState(Date.now() + REFRESH_MS);
  const controller = useRef<AbortController>();

  const refresh = useCallback(async () => {
    if (controller.current) return;
    const request = new AbortController();
    controller.current = request;
    dispatch({ type: 'request' });
    try {
      dispatch({ type: 'success', data: await fetchStatus(request.signal) });
    } catch (error) {
      if (!request.signal.aborted) dispatch({ type: 'failure', message: error instanceof Error ? error.message : String(error) });
    } finally {
      controller.current = undefined;
      setNextRefresh(Date.now() + REFRESH_MS);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => { if (!document.hidden) void refresh(); }, REFRESH_MS);
    return () => { window.clearInterval(id); controller.current?.abort(); };
  }, [refresh]);

  const model = useMemo(() => state.data ? buildIssueConsoleModel(state.data, `v${packageMetadata.version}`, CATALOG) : null, [state.data]);
  return <main className="app-frame"><IssueConsole model={model} lifecycle={state} onRefresh={() => void refresh()} nextRefresh={nextRefresh} /></main>;
}
