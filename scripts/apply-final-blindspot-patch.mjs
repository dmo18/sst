import fs from 'node:fs';

function patch(path, replacements) {
  let text = fs.readFileSync(path, 'utf8');
  for (const [before, after, label] of replacements) {
    if (!text.includes(before)) throw new Error(`${path}: missing patch anchor ${label}`);
    text = text.replace(before, after);
  }
  fs.writeFileSync(path, text);
}

patch('scripts/public-source-repairs.mjs', [
  [
`  ringcentral: {
    mode: 'status-html',
    url: 'https://status.ringcentral.com/',
    sourceName: 'RingCentral public status dashboard',
    render: true
  },`,
`  ringcentral: {
    mode: 'status-html',
    url: 'https://status.ringcentral.com/',
    sourceName: 'RingCentral public status dashboard',
    render: true
  },
  crowdstrike: {
    mode: 'status-html',
    url: 'https://status.crowdstrike.com/',
    sourceName: 'CrowdStrike public status page',
    render: true,
    regionScope: 'us'
  },
  proofpoint: {
    mode: 'status-html',
    url: 'https://status.proofpoint.com/',
    sourceName: 'Proofpoint public status page',
    render: true,
    regionScope: 'us'
  },
  '8x8': {
    mode: 'status-html',
    url: 'https://status.8x8.com/',
    sourceName: '8x8 public service status page',
    render: true,
    regionScope: 'us'
  },
  intermedia: {
    mode: 'status-html',
    url: 'https://status.intermedia.net/',
    sourceName: 'Intermedia public service status page',
    render: true,
    regionScope: 'us'
  },`,
    'public render overrides'
  ],
  [
`  kaseya: {
    mode: 'status-html',
    url: 'https://status.kaseya.com/',
    feedCandidates: [
      'https://status.kaseya.com/history.rss',
      'https://status.kaseya.com/history.atom'
    ],
    sourceName: 'Kaseya public status page',
    regionScope: 'us'
  },`,
`  kaseya: {
    mode: 'feed',
    url: 'https://status.kaseya.com/history.rss',
    pageUrl: 'https://status.kaseya.com/',
    sourceName: 'Kaseya public status RSS',
    maxAgeHours: 72,
    regionScope: 'us'
  },`,
    'Kaseya bounded feed'
  ],
  [
`    case 'sophos':
      return /All systems normal/i.test(text) ? healthy('Sophos reports all systems normal') : null;`,
`    case '8x8': {
      const statusStart = text.search(/Service Status/i);
      if (statusStart < 0) return null;
      const status = text.slice(statusStart, statusStart + 24000);
      const americasStart = status.search(/\\bAmericas\\b/i);
      if (americasStart < 0) return null;
      const tail = status.slice(americasStart);
      const nextRegion = tail.search(/\\b(?:EMEA|APAC)\\b/i);
      const americas = nextRegion > 0 ? tail.slice(0, nextRegion) : tail.slice(0, 10000);
      const problem = /\\b(?:Investigating|Monitoring|Identified|Performance Issue|Service Outage|Outage)\\b/i.exec(americas);
      if (problem) return { kind: 'limited', message: `8x8 Americas currently reports ${problem[0]}; a specific incident record was not derived from the service matrix.` };
      const normalCount = (americas.match(/\\bNormal\\b/gi) || []).length;
      return normalCount >= 5 ? healthy('8x8 Americas services report normal status') : null;
    }
    case 'sophos':
      return /All systems normal/i.test(text) ? healthy('Sophos reports all systems normal') : null;`,
    '8x8 current matrix parser'
  ],
  [
`      '--virtual-time-budget=12000',`,
`      '--virtual-time-budget=20000',`,
    'renderer virtual time'
  ],
  [
`      timeout: 25000,`,
`      timeout: 35000,`,
    'renderer timeout'
  ]
]);

patch('scripts/structured-source-adapters.mjs', [
  [
`  const extras = { maintenance, components };
  if (incidents.length) return { kind: 'issues', incidents, ...extras };
  const indicator = String(json.status?.indicator || '').toLowerCase();
  if (indicator === 'none') return { kind: 'healthy', status: clean(json.status?.description) || \`${'${provider.name || \'Provider\'}'} reports all systems operational\`, ...extras };
  if (staleIncidentCount) return { kind: 'limited', message: \`${'${provider.name || \'Provider\'}'} lists ${'${staleIncidentCount}'} unresolved incident record${'${staleIncidentCount === 1 ? \'\' : \'s\'}'} without an official update in the last ${'${INCIDENT_MAX_AGE_DAYS}'} days. The records were not presented as current.\`, ...extras };`,
`  const extras = { maintenance, components };
  if (incidents.length) return { kind: 'issues', incidents, ...extras };
  const indicator = String(json.status?.indicator || '').toLowerCase();
  if (indicator === 'none') return { kind: 'healthy', status: clean(json.status?.description) || \`${'${provider.name || \'Provider\'}'} reports all systems operational\`, ...extras };
  const problemComponents = components.filter(component => !/^(?:operational|available|up|ok|none|good)$/i.test(String(component.status || '')));
  if (problemComponents.length && indicator && indicator !== 'none') {
    const status = clean(json.status?.description) || \`${'${provider.name || \'Provider\'}'} reports current component degradation\`;
    const names = uniqueNames(problemComponents.map(component => component.name));
    return {
      kind: 'component-state',
      status,
      color: /major|critical/i.test(indicator) ? 'red' : 'amber',
      message: names ? \`Current structured component state: ${'${names}'}\` : 'The official structured source reports current component degradation.',
      ...extras
    };
  }
  if (staleIncidentCount) return { kind: 'limited', message: \`${'${provider.name || \'Provider\'}'} lists ${'${staleIncidentCount}'} unresolved incident record${'${staleIncidentCount === 1 ? \'\' : \'s\'}'} without an official update in the last ${'${INCIDENT_MAX_AGE_DAYS}'} days. The records were not presented as current.\`, ...extras };`,
    'structured component state'
  ]
]);

patch('scripts/update-public-status.mjs', [
  [
`async function parsePublicHtml(provider, source) {
  const requestProvider = { ...provider, url: source.url, sourceType: source.mode };
  const result = await fetchPublicHtml(requestProvider, source);
  const logs = [...(result.logs || [result.log])];
  if (!result.ok) {
    const feedResult = await tryFeedCandidates(provider, source, '', logs);
    if (feedResult?.source_state === 'available') return feedResult;
    return providerStatus(provider, source, \`Source unavailable: HTTP ${'${result.status || \'failed\'}'}\`, 'blue', false, result.log?.error || result.log?.message, logs, [], [], 'unavailable');
  }
  let pageBody = result.body;
  let conclusion = htmlIssueConclusion(provider, source, pageBody);
  if ((conclusion.kind === 'limited' || (conclusion.kind === 'issue' && isGenericIncidentTitle(conclusion.title))) && source.render === true) {
    const rendered = await renderPublicPage(source);
    logs.push(rendered.log);
    if (rendered.ok) {
      pageBody = rendered.body;
      conclusion = htmlIssueConclusion(provider, source, pageBody);
    }
  }`,
`async function parsePublicHtml(provider, source) {
  const requestProvider = { ...provider, url: source.url, sourceType: source.mode };
  const result = await fetchPublicHtml(requestProvider, source);
  const logs = [...(result.logs || [result.log])];
  let pageBody = result.ok ? result.body : '';
  let renderedAlready = false;
  if (!result.ok) {
    const feedResult = await tryFeedCandidates(provider, source, '', logs);
    if (feedResult?.source_state === 'available') return feedResult;
    if (source.render === true) {
      const rendered = await renderPublicPage(source);
      logs.push(rendered.log);
      if (rendered.ok) {
        pageBody = rendered.body;
        renderedAlready = true;
      } else {
        return providerStatus(provider, source, \`Source unavailable: HTTP ${'${result.status || \'failed\'}'}\`, 'blue', false, rendered.log?.error || result.log?.error || result.log?.message, logs, [], [], 'unavailable');
      }
    } else {
      return providerStatus(provider, source, \`Source unavailable: HTTP ${'${result.status || \'failed\'}'}\`, 'blue', false, result.log?.error || result.log?.message, logs, [], [], 'unavailable');
    }
  }
  let conclusion = htmlIssueConclusion(provider, source, pageBody);
  if ((conclusion.kind === 'limited' || (conclusion.kind === 'issue' && isGenericIncidentTitle(conclusion.title))) && source.render === true && !renderedAlready) {
    const rendered = await renderPublicPage(source);
    logs.push(rendered.log);
    if (rendered.ok) {
      pageBody = rendered.body;
      conclusion = htmlIssueConclusion(provider, source, pageBody);
      renderedAlready = true;
    }
  }`,
    'browser fallback after fetch failure'
  ],
  [
`  if (conclusion.kind === 'issues') {`,
`  if (conclusion.kind === 'component-state') {
    return providerStatus(provider, source, conclusion.status || \`${'${provider.name}'} reports current component degradation\`, conclusion.color === 'red' ? 'red' : 'amber', true, conclusion.message || '', logs, [], maintenance, undefined, extras);
  }
  if (conclusion.kind === 'issues') {`,
    'component-state provider mapping'
  ],
  [
`export function reconcileProviderIncidentEvidence(result, now = Date.now()) {
  const incidents = (result?.incidents || []).filter(item => activeIncident(item, now));
  if (incidents.length || !['major', 'degraded'].includes(result?.service_state)) return { ...result, incidents };`,
`export function reconcileProviderIncidentEvidence(result, now = Date.now()) {
  const incidents = (result?.incidents || []).filter(item => activeIncident(item, now));
  const hasCurrentComponentIssue = Array.isArray(result?.component_status) && result.component_status.some(component => !/^(?:operational|available|up|ok|none|good)$/i.test(String(component?.status || '')));
  if (incidents.length || hasCurrentComponentIssue || !['major', 'degraded'].includes(result?.service_state)) return { ...result, incidents };`,
    'preserve current component degradation'
  ]
]);

console.log('Applied final blind-spot source patches.');
