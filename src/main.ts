import { renderLoadError, renderStatus } from './render';
import type { StatusPayload } from './types';
import './styles/hud.css';

const liveStatusUrl = 'https://raw.githubusercontent.com/dmo18/sst/main/status.json';
const fallbackStatusUrl = 'status.json';

async function fetchStatusJson(url: string): Promise<StatusPayload> {
  const response = await fetch(`${url}?ts=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return await response.json() as StatusPayload;
}

async function loadStatus(): Promise<void> {
  try {
    renderStatus(await fetchStatusJson(liveStatusUrl));
  } catch (liveError) {
    try {
      renderStatus(await fetchStatusJson(fallbackStatusUrl));
    } catch (fallbackError) {
      renderLoadError(fallbackError instanceof Error ? fallbackError : liveError);
    }
  }
}

void loadStatus();
window.setInterval(() => void loadStatus(), 60_000);
