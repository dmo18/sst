import { renderLoadError, renderStatus } from './render';
import type { StatusPayload } from './types';
import './styles/hud.css';

async function loadStatus(): Promise<void> {
  try {
    const response = await fetch(`status.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as StatusPayload;
    renderStatus(data);
  } catch (error) {
    renderLoadError(error);
  }
}

void loadStatus();
window.setInterval(() => void loadStatus(), 60_000);
