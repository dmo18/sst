import { useEffect, useMemo, useState } from 'react';
import { IssueConsole } from './IssueConsole';
import { buildIssueConsoleModel } from './statusViewModel';
import type { StatusPayload } from './types';

const APP_VERSION = 'v10';

type LoadState = { data?: StatusPayload; error?: string };

async function fetchStatus(): Promise<StatusPayload> {
  const response = await fetch(`status.json?ts=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`status.json returned HTTP ${response.status}`);
  return await response.json() as StatusPayload;
}

export function App(): JSX.Element {
  const [state, setState] = useState<LoadState>({});

  useEffect(() => {
    let active = true;
    async function refresh(): Promise<void> {
      try {
        const data = await fetchStatus();
        if (active) setState({ data });
      } catch (error) {
        if (active) setState(previous => ({ ...previous, error: error instanceof Error ? error.message : String(error) }));
      }
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), 60000);
    return () => { active = false; window.clearInterval(id); };
  }, []);

  const model = useMemo(() => state.data ? buildIssueConsoleModel(state.data, APP_VERSION) : undefined, [state.data]);

  if (!model) return <main className="app-frame"><section className="briefing-console loading"><b>{state.error ? 'DATA FAILED' : 'LOADING'}</b><span>{state.error ?? 'Reading status.json'}</span><em>{APP_VERSION}</em></section></main>;

  return <main className="app-frame"><IssueConsole model={model} /></main>;
}
