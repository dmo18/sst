import fs from 'node:fs';

function replaceExact(path, before, after, label) {
  const current = fs.readFileSync(path, 'utf8');
  if (!current.includes(before)) throw new Error(`Missing ${label} in ${path}`);
  const next = current.replace(before, after);
  if (next === current) throw new Error(`No change for ${label} in ${path}`);
  fs.writeFileSync(path, next);
}

replaceExact(
  'scripts/full-review-source-adapters.mjs',
  "  crowdstrike: {\n",
  "  stripe: {\n    mode: 'statuspage-json',\n    url: 'https://www.stripestatus.com/api/v2/summary.json',\n    pageUrl: 'https://www.stripestatus.com/',\n    sourceName: 'Stripe official Statuspage JSON',\n    regionScope: 'global'\n  },\n  paypal: {\n    mode: 'status-html',\n    url: 'https://www.paypal-status.com/product/production',\n    pageUrl: 'https://www.paypal-status.com/product/production',\n    sourceName: 'PayPal production status page',\n    render: true,\n    discoverFeeds: false,\n    regionScope: 'global'\n  },\n  crowdstrike: {\n",
  'PayPal and Stripe source overrides'
);

const conclusionMarker = 'export function fullReviewConclusion(provider, value) {';
const current = fs.readFileSync('scripts/full-review-source-adapters.mjs', 'utf8');
if (!current.includes(conclusionMarker)) throw new Error('Missing full review conclusion marker');
const parser = `export function parsePayPalProductionStatus(value) {\n  const text = clean(value);\n  if (!/\\bPayPal Status Page\\b/i.test(text) || !/\\bProduction Sandbox Services\\b/i.test(text)) return null;\n\n  if (/\\bAll Production Systems Operational\\b/i.test(text)) {\n    return {\n      kind: 'healthy',\n      status: 'All Production Systems Operational',\n      components: [{ name: 'PayPal Production', status: 'Operational' }],\n      maintenance: []\n    };\n  }\n\n  const start = text.search(/\\bProduction Sandbox Services\\b/i);\n  const end = text.search(/\\bView history\\b/i);\n  const currentSection = start >= 0 ? text.slice(start, end > start ? end : start + 12000) : text.slice(0, 12000);\n  const explicit = /\\b(?:Production Systems? (?:Degraded|Unavailable)|Service (?:Outage|Disruption)|Major Outage|Degraded Performance|Partial Outage)\\b/i.exec(currentSection);\n  if (explicit) {\n    return {\n      kind: 'component-state',\n      status: 'PayPal production status reports current service impact',\n      color: /major outage|unavailable|service outage/i.test(explicit[0]) ? 'red' : 'amber',\n      message: clean(currentSection.slice(Math.max(0, explicit.index - 500), Math.min(currentSection.length, explicit.index + 1600))),\n      components: [{ name: 'PayPal Production', status: explicit[0] }],\n      maintenance: []\n    };\n  }\n\n  return {\n    kind: 'limited',\n    message: 'The PayPal production status page rendered, but did not expose an explicit current operational or service-impact state.'\n  };\n}\n\n`;
fs.writeFileSync('scripts/full-review-source-adapters.mjs', current.replace(conclusionMarker, parser + conclusionMarker));

replaceExact(
  'scripts/full-review-source-adapters.mjs',
  "  if (provider.id === 'kaseya' || provider.id === 'lastpass') return parseStatuspageSummary(value, provider, source);\n",
  "  if (provider.id === 'kaseya' || provider.id === 'lastpass' || provider.id === 'stripe') return parseStatuspageSummary(value, provider, source);\n  if (provider.id === 'paypal') return parsePayPalProductionStatus(value);\n",
  'PayPal and Stripe conclusion dispatch'
);

const catalogPath = 'config/providers.json';
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const updates = {
  stripe: {
    sourceType: 'statuspage-json',
    url: 'https://www.stripestatus.com/api/v2/summary.json',
    message: 'Current Stripe service health is read from the official Stripe Statuspage JSON summary.'
  },
  paypal: {
    sourceType: 'rendered-official',
    url: 'https://www.paypal-status.com/product/production',
    message: 'Current PayPal production health is read from the official rendered Production status page.'
  }
};
for (const [id, update] of Object.entries(updates)) {
  const provider = catalog.find(item => item.id === id);
  if (!provider) throw new Error(`Missing provider ${id}`);
  Object.assign(provider, update);
}
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');

console.log('Applied PayPal and Stripe current-health repair.');
