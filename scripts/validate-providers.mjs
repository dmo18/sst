import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const catalogPath = path.join(root, 'config', 'providers.json');
const consolidationPath = path.join(root, 'config', 'provider-consolidation.json');
const expectedRawProviderCount = 80;
const expectedActiveProviderCount = 79;
const allowedSourceTypes = new Set([
    'statuspage',
    'rss',
    'google-cloud-incidents',
    'google-workspace-incidents',
    'salesforce-active-incidents',
    'slack-current-status',
    'heroku-current-status',
    'connectwise-html',
    'backblaze-html',
    'quickbooks-html',
    'limited-official',
    'limited-public-page',
    'official-limited',
    'limited-microsoft',
    'html-limited',
    'okta-html',
    'rootly-json',
    'statuscast-json',
    'firehydrant-json',
    'rendered-official',
    'authenticated-status-reference'
]);
const limitedSourceTypes = new Set(['limited-official', 'limited-public-page', 'official-limited', 'html-limited', 'okta-html']);
function fail(message, context) {
    const suffix = context ? ` (${context})` : '';
    return `${message}${suffix}`;
}
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const consolidation = JSON.parse(fs.readFileSync(consolidationPath, 'utf8'));
const errors = [];
const ids = new Set();
const urls = new Set();
const sharedUrls = new Map();
const categories = new Set();
if (!Array.isArray(catalog)) {
    errors.push('Provider catalog must be an array.');
}
else {
    if (catalog.length !== expectedRawProviderCount) {
        errors.push(`Expected ${expectedRawProviderCount} raw providers, found ${catalog.length}.`);
    }
    for (const [index, provider] of catalog.entries()) {
        const context = provider?.id || provider?.name || `index ${index}`;
        if (!provider || typeof provider !== 'object') {
            errors.push(fail('Provider entry must be an object.', context));
            continue;
        }
        if (!provider.id || typeof provider.id !== 'string')
            errors.push(fail('Provider id is required.', context));
        if (!provider.name || typeof provider.name !== 'string')
            errors.push(fail('Provider name is required.', context));
        if (!provider.category || typeof provider.category !== 'string')
            errors.push(fail('Provider category is required.', context));
        if (!provider.url || typeof provider.url !== 'string')
            errors.push(fail('Provider url is required.', context));
        if (!provider.sourceType || typeof provider.sourceType !== 'string')
            errors.push(fail('Provider sourceType is required.', context));
        if (typeof provider.enabled !== 'undefined' && typeof provider.enabled !== 'boolean')
            errors.push(fail('enabled must be a boolean when present.', context));
        if (typeof provider.priority !== 'undefined' && (!Number.isInteger(provider.priority) || provider.priority < 0))
            errors.push(fail('priority must be a non-negative integer when present.', context));
        if (provider.services && (!Array.isArray(provider.services) || provider.services.some(service => typeof service !== 'string')))
            errors.push(fail('services must be an array of strings when present.', context));
        if (provider.tags && (!Array.isArray(provider.tags) || provider.tags.some(tag => typeof tag !== 'string' || !tag.trim())))
            errors.push(fail('tags must be an array of strings.', context));
        if (provider.criticality && !['high', 'medium', 'low'].includes(provider.criticality))
            errors.push(fail('criticality must be high, medium, or low.', context));
        for (const field of ['client_impact', 'technician_action'])
            if (provider[field] !== undefined && (typeof provider[field] !== 'string' || !provider[field].trim() || provider[field].length > 240))
                errors.push(fail(`${field} must be concise non-empty text.`, context));
        if (provider.id) {
            if (ids.has(provider.id))
                errors.push(fail('Duplicate provider id.', provider.id));
            ids.add(provider.id);
        }
        if (provider.url) {
            try {
                const url = new URL(provider.url);
                if (!['http:', 'https:'].includes(url.protocol))
                    errors.push(fail('Provider url must be HTTP or HTTPS.', context));
            }
            catch {
                errors.push(fail('Provider url is invalid.', context));
            }
            urls.add(provider.url);
            sharedUrls.set(provider.url, [...(sharedUrls.get(provider.url) || []), context]);
        }
        if (provider.sourceType && !allowedSourceTypes.has(provider.sourceType))
            errors.push(fail('Unknown sourceType.', `${context}: ${provider.sourceType}`));
        if (limitedSourceTypes.has(provider.sourceType) && (typeof provider.message !== 'string' || !provider.message.trim()))
            errors.push(fail('Limited source types require a limitation message.', context));
        if (provider.category)
            categories.add(provider.category);
    }
}
const excludedProviderIds = consolidation?.excludedProviderIds;
const providerOverrides = consolidation?.providerOverrides;
if (!Array.isArray(excludedProviderIds) || excludedProviderIds.some(id => typeof id !== 'string' || !id.trim())) {
    errors.push('provider-consolidation excludedProviderIds must be an array of provider ids.');
}
if (!providerOverrides || typeof providerOverrides !== 'object' || Array.isArray(providerOverrides)) {
    errors.push('provider-consolidation providerOverrides must be an object.');
}
const excluded = new Set(Array.isArray(excludedProviderIds) ? excludedProviderIds : []);
for (const id of excluded) {
    if (!ids.has(id)) errors.push(fail('Excluded provider id is not in the raw catalog.', id));
}
for (const id of Object.keys(providerOverrides || {})) {
    if (!ids.has(id)) errors.push(fail('Provider override id is not in the raw catalog.', id));
    if (excluded.has(id)) errors.push(fail('Provider cannot be both excluded and overridden.', id));
}
const activeCatalog = Array.isArray(catalog)
    ? catalog.filter(provider => !excluded.has(provider.id)).map(provider => ({ ...provider, ...(providerOverrides?.[provider.id] || {}) }))
    : [];
if (activeCatalog.length !== expectedActiveProviderCount) {
    errors.push(`Expected ${expectedActiveProviderCount} active providers, found ${activeCatalog.length}.`);
}
const activeIds = new Set(activeCatalog.map(provider => provider.id));
if (activeIds.has('datto')) errors.push('Datto must be absorbed into Kaseya, not emitted as a separate active provider.');
const kaseya = activeCatalog.find(provider => provider.id === 'kaseya');
if (!kaseya || !Array.isArray(kaseya.services) || !kaseya.services.includes('Autotask PSA')) {
    errors.push('Kaseya must include Autotask PSA in its consolidated services.');
}
const github = activeCatalog.find(provider => provider.id === 'github');
if (!github) {
    errors.push('GitHub must be present in the active provider catalog.');
}
else {
    if (github.url !== 'https://www.githubstatus.com/api/v2/summary.json')
        errors.push('GitHub must use the official GitHub Status summary API.');
    if (github.sourceType !== 'statuspage')
        errors.push('GitHub must use the structured Statuspage adapter.');
    if (github.criticality !== 'high' || (github.priority || 0) < 85)
        errors.push('GitHub must remain a high-criticality provider.');
    if (!Array.isArray(github.services) || !github.services.includes('Actions') || !github.services.includes('GitHub Pages'))
        errors.push('GitHub must explicitly monitor Actions and GitHub Pages.');
}
for (const [url, providers] of sharedUrls)
    if (providers.length > 1)
        console.warn(`Shared official source: ${providers.join(', ')} -> ${url}`);
if (errors.length) {
    console.error('Provider catalog validation failed.');
    for (const error of errors)
        console.error(`- ${error}`);
    process.exit(1);
}
console.log(`Validated ${activeCatalog.length} active providers from ${catalog.length} raw entries across ${categories.size} categories and ${urls.size} unique URLs.`);
