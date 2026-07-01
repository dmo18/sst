import type { Incident, ProviderStatus, StatusColor, StatusPayload } from './types';
import { logoSrc } from './logos';

const priorityProviders = ['Microsoft 365', 'Entra ID', 'Cloudflare', 'AWS', 'Google Workspace', 'OpenAI'];

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[match] ?? match);
}

function shortGenerated(value: string): string {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function logo(providerId: string, name: string): string {
  return `<img class="logo" src="${escapeHtml(logoSrc(providerId))}" alt="${escapeHtml(name)}">`;
}

function providerRailItem(provider: ProviderStatus): string {
  return `<div class="provider ${escapeHtml(provider.color)}" title="${escapeHtml(`${provider.name}: ${provider.status}`)}">${logo(provider.id, provider.name)}</div>`;
}

function incidentCard(incident: Incident, hero: boolean): string {
  const mode = hero ? 'hero' : 'row';
  return `<article class="incident ${mode} ${escapeHtml(incident.color)}">${logo(incident.providerId, incident.provider)}<div class="copy"><div class="meta"><span class="provider-name">${escapeHtml(incident.provider)}</span><span class="source">${escapeHtml(incident.source)}</span><span class="time">${escapeHtml(incident.time)}</span></div><div class="title">${escapeHtml(incident.title)}</div><div class="note">${escapeHtml(incident.note)}</div></div></article>`;
}

function setHtml(id: string, html: string): void {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  element.innerHTML = html;
}

function setText(id: string, text: string): void {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  element.textContent = text;
}

export function renderStatus(data: StatusPayload): void {
  const providers = data.providers ?? [];
  const first = priorityProviders
    .map(name => providers.find(provider => provider.name === name))
    .filter((provider): provider is ProviderStatus => Boolean(provider));

  setHtml('providers', first.map(providerRailItem).join(''));

  const incidents = (data.incidents ?? []).slice(0, 3);
  const queue = document.getElementById('queue');
  if (!queue) throw new Error('Missing element: queue');
  queue.className = `incidents ${incidents.length === 1 ? 'one' : incidents.length === 2 ? 'two' : 'three'}`;
  queue.innerHTML = incidents.length
    ? incidents.map((incident, index) => incidentCard(incident, index === 0)).join('')
    : '<div class="allclear"><div><b>All clear</b><span>No active monitored incidents</span></div></div>';

  const count = data.summary?.active_incident_count ?? incidents.length;
  const overall: StatusColor = data.summary?.overall ?? 'blue';
  setHtml('summaryPill', `<span class="dot ${escapeHtml(overall)}"></span>${count} active`);
  setText('updated', `Updated ${shortGenerated(data.generated_at)}`);

  const history = data.history?.length ? data.history : ['No active incidents across readable feeds'];
  const ticker = history.map(item => `<b>${escapeHtml(item)}</b>`).join(' | ');
  setHtml('ticker', `${ticker} | ${ticker}`);

  setHtml('legend', providers.map(provider => `<div class="mini"><div class="mini-head">${logo(provider.id, provider.name)}<div><b>${escapeHtml(provider.name)}</b><span class="${escapeHtml(provider.color)}">${escapeHtml(provider.status)}</span></div></div><small>${escapeHtml(provider.message ?? '')}${provider.message ? '<br>' : ''}${escapeHtml(provider.source)}</small></div>`).join(''));
}

export function renderLoadError(error: unknown): void {
  setText('updated', 'status.json failed');
  setHtml('queue', `<article class="incident hero red"><div></div><div class="copy"><div class="title">Could not load status.json</div><div class="note">${escapeHtml(error instanceof Error ? error.message : String(error))}</div></div></article>`);
}
