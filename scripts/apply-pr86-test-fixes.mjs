import fs from 'node:fs';

function replace(path, before, after, label) {
  let text = fs.readFileSync(path, 'utf8');
  if (!text.includes(before)) throw new Error(`${path}: missing ${label}`);
  text = text.replace(before, after);
  fs.writeFileSync(path, text);
}

replace('scripts/public-source-repairs.mjs', `  kaseya: {
    mode: 'feed',
    url: 'https://status.kaseya.com/history.rss',
    pageUrl: 'https://status.kaseya.com/',
    sourceName: 'Kaseya public status RSS',
    maxAgeHours: 72,
    regionScope: 'us'
  },`, `  kaseya: {
    mode: 'status-html',
    url: 'https://status.kaseya.com/',
    feedCandidates: [
      'https://status.kaseya.com/history.rss',
      'https://status.kaseya.com/history.atom'
    ],
    sourceName: 'Kaseya public status page',
    regionScope: 'us'
  },`, 'Kaseya override');

replace('scripts/public-source-repairs.mjs', `export function providerSpecificConclusion(provider, html) {
  const text = cleanRenderedText(html);
  if (!text) return null;
  const detailed = providerIncidentConclusion(provider, html);`, `function eightByEightConclusion(text) {
  const statusStart = text.search(/Service Status/i);
  if (statusStart < 0) return null;
  const status = text.slice(statusStart, statusStart + 24000);
  const americasStart = status.search(/\\bAmericas\\b/i);
  if (americasStart < 0) return null;
  const tail = status.slice(americasStart);
  const nextRegion = tail.search(/\\b(?:EMEA|APAC)\\b/i);
  const americas = nextRegion > 0 ? tail.slice(0, nextRegion) : tail.slice(0, 10000);
  const problem = /\\b(?:Investigating|Monitoring|Identified|Performance Issue|Service Outage|Outage)\\b/i.exec(americas);
  if (problem) return { kind: 'limited', message: '8x8 Americas currently reports ' + problem[0] + '; a specific incident record was not derived from the service matrix.' };
  const normalCount = (americas.match(/\\bNormal\\b/gi) || []).length;
  return normalCount >= 5 ? healthy('8x8 Americas services report normal status') : null;
}

export function providerSpecificConclusion(provider, html) {
  const text = cleanRenderedText(html);
  if (!text) return null;
  if (provider.id === '8x8') {
    const scoped = eightByEightConclusion(text);
    if (scoped) return scoped;
  }
  const detailed = providerIncidentConclusion(provider, html);`, '8x8 ordering');

replace('scripts/update-public-status.mjs', `export function resolvePublicSource(provider) {
  if (publicOverrides[provider.id]) return { ...publicOverrides[provider.id] };`, `export function resolvePublicSource(provider) {
  if (provider.id === 'kaseya' && publicOverrides.kaseya) {
    const page = publicOverrides.kaseya;
    return {
      ...page,
      mode: 'feed',
      url: page.feedCandidates?.[0] || 'https://status.kaseya.com/history.rss',
      pageUrl: page.url,
      sourceName: 'Kaseya public status RSS',
      maxAgeHours: 72
    };
  }
  if (publicOverrides[provider.id]) return { ...publicOverrides[provider.id] };`, 'Kaseya resolver');

console.log('Applied PR 86 compatibility fixes.');
