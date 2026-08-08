import fs from 'node:fs';

function replaceExact(path, before, after, label) {
  const current = fs.readFileSync(path, 'utf8');
  if (!current.includes(before)) throw new Error(`Missing ${label} in ${path}`);
  const next = current.replace(before, after);
  if (next === current) throw new Error(`No change for ${label} in ${path}`);
  fs.writeFileSync(path, next);
}

const catalogPath = 'config/providers.json';
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const catalogUpdates = {
  lastpass: {
    sourceType: 'rootly-json',
    url: 'https://status.lastpass.com/api/v1/status.json'
  },
  '8x8': {
    sourceType: 'statuscast-json',
    url: 'https://8x8status.status.page/summary.json'
  },
  proofpoint: {
    sourceType: 'rendered-official',
    url: 'https://proofpoint.my.site.com/community/s/proofpoint-current-incidents'
  },
  backblaze: {
    sourceType: 'firehydrant-json',
    url: 'https://status.backblaze.com/data/payload.json'
  },
  crowdstrike: {
    sourceType: 'authenticated-status-reference',
    url: 'https://www.crowdstrike.com/en-us/contact-us/',
    message: 'CrowdStrike current technical notices and Tech Alerts require authenticated Support Portal access; the public source verifies the official access channel without inferring Falcon service health.'
  },
  intermedia: {
    sourceType: 'authenticated-status-reference',
    url: 'https://support.intermedia.com/',
    message: 'Intermedia current System Status is displayed after authenticated HostPilot login; the public support source verifies the official access channel without inferring service health.'
  }
};
for (const [id, update] of Object.entries(catalogUpdates)) {
  const provider = catalog.find(item => item.id === id);
  if (!provider) throw new Error(`Missing provider ${id}`);
  Object.assign(provider, update);
}
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

replaceExact(
  'scripts/validate-providers.mjs',
  "    'okta-html'\n]);",
  "    'okta-html',\n    'rootly-json',\n    'statuscast-json',\n    'firehydrant-json',\n    'rendered-official',\n    'authenticated-status-reference'\n]);",
  'source type allowlist'
);

replaceExact(
  'scripts/structured-source-adapters.mjs',
  "  lastpass: ['https://status.lastpass.com/api/v2/summary.json', 'LastPass'],\n",
  '',
  'obsolete LastPass Statuspage candidate'
);

const publicRepairsPath = 'scripts/public-source-repairs.mjs';
let repairs = fs.readFileSync(publicRepairsPath, 'utf8');
for (const block of [
`  crowdstrike: {\n    mode: 'status-html',\n    url: 'https://status.crowdstrike.com/',\n    sourceName: 'CrowdStrike public status page',\n    render: true,\n    regionScope: 'us'\n  },\n`,
`  proofpoint: {\n    mode: 'status-html',\n    url: 'https://status.proofpoint.com/',\n    sourceName: 'Proofpoint public status page',\n    render: true,\n    regionScope: 'us'\n  },\n`,
`  '8x8': {\n    mode: 'status-html',\n    url: 'https://status.8x8.com/',\n    sourceName: '8x8 public service status page',\n    render: true,\n    regionScope: 'us'\n  },\n`,
`  intermedia: {\n    mode: 'status-html',\n    url: 'https://status.intermedia.net/',\n    sourceName: 'Intermedia public service status page',\n    render: true,\n    regionScope: 'us'\n  },\n`,
`  kaseya: {\n    mode: 'status-html',\n    url: 'https://status.kaseya.com/',\n    feedCandidates: [\n      'https://status.kaseya.com/history.rss',\n      'https://status.kaseya.com/history.atom'\n    ],\n    sourceName: 'Kaseya public status page',\n    regionScope: 'us'\n  },\n`,
`  backblaze: {\n    mode: 'status-html',\n    url: 'https://status.backblaze.com/',\n    sourceName: 'Backblaze public status page',\n    render: true\n  }\n`
]) {
  if (!repairs.includes(block)) throw new Error(`Missing obsolete public repair block beginning ${block.slice(0, 40)}`);
  repairs = repairs.replace(block, '');
}
repairs = repairs.replace(/,\n};\n\nObject\.assign\(additionalPublicOverrides, incidentDetailOverrides\);/, '\n};\n\nObject.assign(additionalPublicOverrides, incidentDetailOverrides);');
fs.writeFileSync(publicRepairsPath, repairs);

replaceExact(
  'scripts/update-public-status.mjs',
  "  backblaze: {\n    mode: 'status-html',\n    url: 'https://status.backblaze.com/',\n    sourceName: 'Backblaze public status page'\n  },\n",
  '',
  'obsolete Backblaze fallback override'
);

console.log('Applied source policy hygiene.');
