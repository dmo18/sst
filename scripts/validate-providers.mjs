import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const catalogPath = path.join(root, 'config', 'providers.json');
const allowedSourceTypes = new Set([
  'statuspage',
  'rss',
  'google-cloud-json',
  'slack-current-status',
  'heroku-current-status',
  'okta-html',
  'html-limited',
  'limited-public-page',
  'official-limited',
  'limited-microsoft'
]);

function fail(message, context) {
  const suffix = context ? ` (${context})` : '';
  return `${message}${suffix}`;
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const errors = [];
const ids = new Set();
const urls = new Set();
const categories = new Set();

if (!Array.isArray(catalog)) {
  errors.push('Provider catalog must be an array.');
} else {
  for (const [index, provider] of catalog.entries()) {
    const context = provider?.id || provider?.name || `index ${index}`;
    if (!provider || typeof provider !== 'object') {
      errors.push(fail('Provider entry must be an object.', context));
      continue;
    }
    if (!provider.id || typeof provider.id !== 'string') errors.push(fail('Provider id is required.', context));
    if (!provider.name || typeof provider.name !== 'string') errors.push(fail('Provider name is required.', context));
    if (!provider.category || typeof provider.category !== 'string') errors.push(fail('Provider category is required.', context));
    if (!provider.url || typeof provider.url !== 'string') errors.push(fail('Provider url is required.', context));
    if (!provider.sourceType || typeof provider.sourceType !== 'string') errors.push(fail('Provider sourceType is required.', context));
    if (typeof provider.enabled !== 'undefined' && typeof provider.enabled !== 'boolean') errors.push(fail('enabled must be a boolean when present.', context));
    if (typeof provider.priority !== 'undefined' && typeof provider.priority !== 'number') errors.push(fail('priority must be a number when present.', context));
    if (provider.services && (!Array.isArray(provider.services) || provider.services.some(service => typeof service !== 'string'))) errors.push(fail('services must be an array of strings when present.', context));
    if (provider.id) {
      if (ids.has(provider.id)) errors.push(fail('Duplicate provider id.', provider.id));
      ids.add(provider.id);
    }
    if (provider.url) {
      try {
        const url = new URL(provider.url);
        if (!['http:', 'https:'].includes(url.protocol)) errors.push(fail('Provider url must be HTTP or HTTPS.', context));
      } catch {
        errors.push(fail('Provider url is invalid.', context));
      }
      urls.add(provider.url);
    }
    if (provider.sourceType && !allowedSourceTypes.has(provider.sourceType)) errors.push(fail('Unknown sourceType.', `${context}: ${provider.sourceType}`));
    if (provider.category) categories.add(provider.category);
  }
}

if (errors.length) {
  console.error('Provider catalog validation failed.');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${catalog.length} providers across ${categories.size} categories and ${urls.size} unique URLs.`);
