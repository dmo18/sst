import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { canonicalizeProviderCatalog } from './update-public-status.mjs';
import { faviconCandidates, faviconWrapperSvg, normalizeFavicon, providerPageUrl } from './provider-favicon-utils.mjs';

const configUrl = new URL('../config/provider-favicon-sources.json', import.meta.url);
const providersUrl = new URL('../config/providers.json', import.meta.url);
const consolidationUrl = new URL('../config/provider-consolidation.json', import.meta.url);
const generatedModuleUrl = new URL('../src/generated/providerFavicons.ts', import.meta.url);
const generatedArtworkDirUrl = new URL('../public/assets/logos/provider-favicons/', import.meta.url);
const manifestUrl = new URL('../public/assets/logos/provider-favicon-sources.json', import.meta.url);
const MAX_ICON_BYTES = 64 * 1024;
const MAX_OFFICIAL_ASSET_BYTES = 512 * 1024;
const CONCURRENCY = 6;
const FETCH_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([408, 425, 429]);

async function readJson(url) {
  return JSON.parse(await fs.readFile(url, 'utf8'));
}

function retryableResponse(response) {
  return RETRYABLE_STATUS.has(response.status) || response.status >= 500;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8_000) {
  let lastError = null;

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          accept: options.accept || '*/*',
          'user-agent': 'ServiceOps provider identity build/3.3',
          ...(options.headers || {})
        }
      });

      if (!retryableResponse(response) || attempt === FETCH_ATTEMPTS) return response;
      lastError = new Error(`HTTP ${response.status}`);
      try { await response.body?.cancel(); } catch { }
    }
    catch (error) {
      lastError = error;
      if (attempt === FETCH_ATTEMPTS) throw error;
    }

    await new Promise(resolve => setTimeout(resolve, 150 * attempt));
  }

  throw lastError || new Error(`Unable to fetch ${url}`);
}

async function fetchIconCandidate(candidate, maxBytes = MAX_ICON_BYTES) {
  const response = await fetchWithTimeout(candidate.url, {
    accept: 'image/avif,image/webp,image/svg+xml,image/png,image/*,*/*;q=0.8'
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) throw new Error(`asset exceeds ${maxBytes} bytes`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > maxBytes) throw new Error(`asset size ${bytes.length} is invalid`);
  const normalized = normalizeFavicon(bytes, response.headers.get('content-type') || '');
  if (!normalized) throw new Error('unsupported favicon format');
  if (normalized.bytes.length > maxBytes) throw new Error(`normalized asset exceeds ${maxBytes} bytes`);
  return {
    bytes: normalized.bytes,
    mime: normalized.mime,
    finalUrl: response.url || candidate.url
  };
}

function recordForIcon(provider, pageUrl, sourceKind, icon, background) {
  const sha256 = crypto.createHash('sha256').update(icon.bytes).digest('hex');
  const fileName = `${provider.id}-${sha256.slice(0, 12)}.svg`;
  return {
    providerId: provider.id,
    providerName: provider.name,
    pageUrl,
    sourceKind,
    iconUrl: icon.finalUrl,
    mime: icon.mime,
    bytes: icon.bytes.length,
    sha256,
    fileName,
    svg: faviconWrapperSvg(icon.bytes, icon.mime, { background })
  };
}

async function resolvePageFavicon(provider, pageUrl, sourceKind, attempts) {
  let html = '';
  try {
    const response = await fetchWithTimeout(pageUrl, { accept: 'text/html,application/xhtml+xml' });
    if (response.ok && (response.headers.get('content-type') || '').toLowerCase().includes('text/html')) {
      html = await response.text();
    }
  }
  catch (error) {
    attempts.push(`${pageUrl}: ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const candidate of faviconCandidates(html, pageUrl).slice(0, 8)) {
    try {
      const icon = await fetchIconCandidate(candidate);
      return recordForIcon(provider, pageUrl, sourceKind, icon);
    }
    catch (error) {
      attempts.push(`${candidate.url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return null;
}

async function resolveProviderFavicon(provider, websiteOverride, assetOverride) {
  const statusPageUrl = providerPageUrl(provider.url);
  const attempts = [];

  if (assetOverride?.url) {
    try {
      const icon = await fetchIconCandidate({ url: assetOverride.url }, MAX_OFFICIAL_ASSET_BYTES);
      return recordForIcon(
        provider,
        websiteOverride || statusPageUrl,
        'official-asset',
        icon,
        assetOverride.background
      );
    }
    catch (error) {
      attempts.push(`official asset ${assetOverride.url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const pages = [];
  if (websiteOverride) pages.push({ pageUrl: websiteOverride, sourceKind: 'vendor-website' });
  pages.push({ pageUrl: statusPageUrl, sourceKind: 'status-site' });

  const uniquePages = [];
  const seen = new Set();
  for (const page of pages) {
    const href = new URL(page.pageUrl).href;
    if (seen.has(href)) continue;
    seen.add(href);
    uniquePages.push({ ...page, pageUrl: href });
  }

  for (const page of uniquePages) {
    const resolved = await resolvePageFavicon(provider, page.pageUrl, page.sourceKind, attempts);
    if (resolved) return resolved;
  }

  const firstAttempt = attempts[0];
  const tail = attempts.slice(-4);
  const detail = [firstAttempt, ...tail].filter((value, index, values) => value && values.indexOf(value) === index);
  throw new Error(detail.join(' | ') || 'no favicon candidates');
}

async function mapConcurrent(items, worker, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

function generatedModule(records) {
  const entries = records
    .sort((a, b) => a.providerId.localeCompare(b.providerId))
    .map(record => `  ${JSON.stringify(record.providerId)}: base + ${JSON.stringify(`assets/logos/provider-favicons/${record.fileName}`)}`)
    .join(',\n');
  return `/* Auto-generated by scripts/sync-provider-favicons.mjs during verified application builds.\n   Release builds resolve official artwork to local static files and keep only local paths in JavaScript. */\nconst base = import.meta.env.BASE_URL ?? '/';\n\nexport const providerFavicons: Readonly<Record<string, string>> = {\n${entries}\n};\n`;
}

const settings = await readJson(configUrl);
const rawProviders = await readJson(providersUrl);
const consolidation = await readJson(consolidationUrl);
const canonical = canonicalizeProviderCatalog(rawProviders, consolidation);
const byId = new Map(canonical.map(provider => [provider.id, provider]));
const websiteOverrides = settings.websiteOverrides || {};
const assetOverrides = settings.assetOverrides || {};
const selected = settings.providers.map(id => {
  const provider = byId.get(id);
  if (!provider) throw new Error(`Configured favicon provider is not canonical: ${id}`);
  if (!provider.url) throw new Error(`Configured favicon provider has no official source URL: ${id}`);
  const websiteOverride = websiteOverrides[id] || '';
  const assetOverride = assetOverrides[id] || null;
  if (websiteOverride) new URL(websiteOverride);
  if (assetOverride?.url) new URL(assetOverride.url);
  return { provider, websiteOverride, assetOverride };
});

const resolved = [];
const failures = [];
await mapConcurrent(selected, async ({ provider, websiteOverride, assetOverride }) => {
  try {
    const record = await resolveProviderFavicon(provider, websiteOverride, assetOverride);
    resolved.push(record);
    console.log(`FAVICON_OK ${provider.id} ${record.sourceKind} ${record.mime} ${record.bytes} ${record.iconUrl}`);
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ providerId: provider.id, providerName: provider.name, message });
    console.warn(`FAVICON_MISS ${provider.id} ${message}`);
  }
}, CONCURRENCY);

const minimumResolved = Number(settings.minimumResolved || 0);
if (resolved.length < minimumResolved) {
  throw new Error(`Provider favicon coverage ${resolved.length}/${selected.length} is below required minimum ${minimumResolved}.`);
}

await fs.mkdir(new URL('../src/generated/', import.meta.url), { recursive: true });
await fs.rm(generatedArtworkDirUrl, { recursive: true, force: true });
await fs.mkdir(generatedArtworkDirUrl, { recursive: true });
for (const record of resolved) {
  await fs.writeFile(new URL(record.fileName, generatedArtworkDirUrl), record.svg);
}
await fs.writeFile(generatedModuleUrl, generatedModule(resolved));
await fs.writeFile(manifestUrl, `${JSON.stringify({
  providerCount: selected.length,
  minimumResolved,
  resolved: resolved.map(({ svg, ...record }) => record).sort((a, b) => a.providerId.localeCompare(b.providerId)),
  failures
}, null, 2)}\n`);

console.log(`FAVICON_SYNC resolved=${resolved.length} configured=${selected.length} minimum=${minimumResolved} failures=${failures.length}`);
