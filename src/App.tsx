import { useEffect, useMemo, useState } from 'react';
import providerCatalog from '../config/providers.json';
import { IssueConsole } from './IssueConsole';
import { buildIssueConsoleModel } from './statusViewModel';
import type { ProviderConfig, StatusPayload } from './types';

const APP_VERSION = 'v2.1.3';
const CATALOG = providerCatalog as ProviderConfig[];

type LoadState = { data: StatusPayload; error?: string };

function fallbackStatus(): StatusPayload {
  return {
    generated_at: new Date().toISOString(),
    summary: {
      overall: 'blue',
      active_incident_count: 0,
      providers_ok: 0,
      providers_total: CATALOG.length
    },
    providers: [],
    incidents: [],
    history: []
  };
}

async function fetchStatus(): Promise<StatusPayload> {
  const response = await fetch(`status.json?ts=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`status.json returned HTTP ${response.status}`);
  return await response.json() as StatusPayload;
}

export function App(): JSX.Element {
  const [state, setState] = useState<LoadState>({ data: fallbackStatus() });

  useEffect(() => {
    let active = true;
    async function refresh(): Promise<void> {
      try {
        const data = await fetchStatus();
        if (active) setState({ data });
      } catch (error) {
        if (active) setState({ data: fallbackStatus(), error: error instanceof Error ? error.message : String(error) });
      }
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), 60000);
    return () => { active = false; window.clearInterval(id); };
  }, []);

  const model = useMemo(() => buildIssueConsoleModel(state.data, APP_VERSION, CATALOG), [state.data]);

  return <main className="app-frame"><IssueConsole model={model} /></main>;
}
