import type { Incident, ProviderStatus, StatusColor, StatusPayload } from './types';

const priorityProviders = ['Microsoft 365', 'Entra ID', 'Cloudflare', 'AWS', 'Google Workspace', 'OpenAI'];
const shortNames: Record<string, string> = {
  'Microsoft 365': 'M365',
  'Entra ID': 'Entra',
  'Google Workspace': 'Google',
  'Cloudflare': 'Cloudflare',
  AWS: 'AWS',
  OpenAI: 'OpenAI'
};

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

function statusWord(value: string): string {
  const text = String(value || '').toLowerCase();
  if (/active|degrad|partial|investigat|monitor|issue|disruption|error|outage/.test(text)) return 'Issue';
  if (/operational|normal|ok|no active|all systems/.test(text)) return 'OK';
  if (/limited|needed|reachable/.test(text)) return 'Info';
  return 'Info';
}

function providerRailItem(provider: ProviderStatus): string {
  const label = shortNames[provider.name] || provider.name;
  return `<div class="provider ${escapeHtml(provider.color)}" title="${escapeHtml(`${provider.name}: ${provider.status}`)}"><span class="provider-mark"></span><b>${escapeHtml(label)}</b><small>${escapeHtml(statusWord(provider.status))}</small></div>`;
}

function incidentCard(incident: Incident, hero: boolean): string {
  const mode = hero ? 'hero' : 'row';
  return `<article class="incident ${mode} ${escapeHtml(incident.color)}"><div class="incident-top"><span class="provider-name">${escapeHtml(incident.provider)}</span><span class="source">${escapeHtml(incident.source)}</span><span class="time">${escapeHtml(incident.time)}</span></div><div class="title">${escapeHtml(incident.title)}</div><div class="note">${escapeHtml(incident.note)}</div></article>`;
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
  setHtml('ticker', `<span>${ticker} | ${ticker}</span>`);

  setHtml('legend', providers.map(provider => `<div class="mini ${escapeHtml(provider.color)}"><div class="mini-head"><span class="mini-mark"></span><div><b>${escapeHtml(provider.name)}</b><span>${escapeHtml(provider.status)}</span></div></div><small>${escapeHtml(provider.message ?? '')}${provider.message ? '<br>' : ''}${escapeHtml(provider.source)}</small></div>`).join(''));
}

export function renderLoadError(error: unknown): void {
  setText('updated', 'status.json failed');
  setHtml('queue', `<article class="incident hero red"><div class="incident-top"><span class="provider-name">Status data</span></div><div class="title">Could not load status.json</div><div class="note">${escapeHtml(error instanceof Error ? error.message : String(error))}</div></article>`);
}