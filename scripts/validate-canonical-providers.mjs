import { ACTIVE_PROVIDER_CATALOG } from '../src/providerCatalog.ts';

const allowedSourceTypes = new Set([
  'statuspage', 'rss', 'google-cloud-incidents', 'google-workspace-incidents',
  'salesforce-active-incidents', 'slack-current-status', 'heroku-current-status',
  'connectwise-html', 'backblaze-html', 'quickbooks-html', 'limited-official',
  'limited-public-page', 'official-limited', 'limited-microsoft', 'html-limited',
  'okta-html', 'rootly-json', 'statuscast-json', 'firehydrant-json',
  'rendered-official', 'authenticated-status-reference', 'azure-status-html',
  'auth0-next-data'
]);

const errors = [];
const ids = new Set();

for (const [index, provider] of ACTIVE_PROVIDER_CATALOG.entries()) {
  const context = provider?.id || provider?.name || `index ${index}`;
  if (!provider || typeof provider !== 'object') {
    errors.push(`Canonical provider must be an object (${context})`);
    continue;
  }
  for (const field of ['id', 'name', 'category', 'url', 'sourceType']) {
    if (typeof provider[field] !== 'string' || !provider[field].trim()) errors.push(`Canonical provider ${context} has invalid ${field}`);
  }
  if (ids.has(provider.id)) errors.push(`Duplicate canonical provider id ${provider.id}`);
  ids.add(provider.id);
  try {
    const url = new URL(provider.url);
    if (!['http:', 'https:'].includes(url.protocol)) errors.push(`Canonical provider ${context} has non-HTTP URL`);
  } catch {
    errors.push(`Canonical provider ${context} has invalid URL`);
  }
  if (!allowedSourceTypes.has(provider.sourceType || '')) errors.push(`Canonical provider ${context} has unknown sourceType ${provider.sourceType || 'missing'}`);
  if (provider.priority !== undefined && (!Number.isInteger(provider.priority) || provider.priority < 0)) errors.push(`Canonical provider ${context} has invalid priority`);
  if (provider.criticality !== undefined && !['high', 'medium', 'low'].includes(provider.criticality)) errors.push(`Canonical provider ${context} has invalid criticality`);
  if (provider.services !== undefined && (!Array.isArray(provider.services) || provider.services.some(value => typeof value !== 'string' || !value.trim()))) errors.push(`Canonical provider ${context} has invalid services`);
  if (provider.tags !== undefined && (!Array.isArray(provider.tags) || provider.tags.some(value => typeof value !== 'string' || !value.trim()))) errors.push(`Canonical provider ${context} has invalid tags`);
  for (const field of ['client_impact', 'technician_action']) {
    const value = provider[field];
    if (value !== undefined && (typeof value !== 'string' || !value.trim() || value.length > 240)) errors.push(`Canonical provider ${context} has invalid ${field}`);
  }
}

if (errors.length) {
  console.error('Canonical provider validation failed.');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${ACTIVE_PROVIDER_CATALOG.length} canonical providers after consolidation and overrides.`);
