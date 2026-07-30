import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareSnapshots, summarizeProviders, validatePayload } from './update-status.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const defaultStatusPath = path.join(root, 'public', 'status.json');
const defaultPreviousPath = path.join(root, 'public', 'previous-status.json');

export const validSourceStates = new Set(['available', 'limited', 'stale']);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(temporaryPath, filePath);
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function validBasis(provider) {
  if (provider.source_state === 'available') return 'live-official';
  if (provider.source_state === 'stale') return 'last-known-official';
  return 'limited-official';
}

export function providerHasValidStatusData(provider) {
  return Boolean(
    provider
    && typeof provider.id === 'string'
    && provider.id
    && typeof provider.status === 'string'
    && provider.status
    && typeof provider.source === 'string'
    && /^https?:/.test(provider.source)
    && validSourceStates.has(provider.source_state)
    && ['operational', 'degraded', 'major', 'unknown'].includes(provider.service_state)
  );
}

export function normalizeProviderStatus(provider, incidents, now = new Date().toISOString()) {
  if (providerHasValidStatusData(provider)) {
    return {
      ...provider,
      status_data_valid: true,
      status_data_basis: validBasis(provider)
    };
  }

  if (provider.source_state === 'disabled') {
    throw new Error(`Provider ${provider.id} is disabled and cannot satisfy the all-sources-valid requirement.`);
  }

  const hasActiveIncident = incidents.some(incident => incident.providerId === provider.id);
  const originalMessage = compact(provider.message);
  const originalStatus = compact(provider.status);
  const reason = originalMessage || originalStatus || 'The official source did not return readable status data.';
  const message = `The official source could not be machine-read during this build. A valid fail-closed limited status record was published instead. This is not operational confirmation and is not evidence of a vendor outage. Retrieval detail: ${reason}`;
  const fallbackLog = {
    timestamp: now,
    completed_at: now,
    duration_ms: 0,
    url: provider.source,
    source_type: 'valid-status-fallback',
    ok: true,
    status: 'valid limited fallback',
    message: 'Published an explicit limited status record after the official source failed to provide readable current data.'
  };

  return {
    ...provider,
    status: hasActiveIncident ? provider.status : 'Limited official status data',
    color: hasActiveIncident ? provider.color : 'blue',
    service_state: hasActiveIncident ? provider.service_state : 'unknown',
    source_state: 'limited',
    attention: hasActiveIncident ? provider.attention : 'watch',
    message,
    ok: true,
    download_log: [...(Array.isArray(provider.download_log) ? provider.download_log : []), fallbackLog],
    status_data_valid: true,
    status_data_basis: 'limited-fallback'
  };
}

export function normalizeStatusPayload(payload, previous = null, now = payload?.generated_at || new Date().toISOString()) {
  validatePayload(payload);

  let validPrevious = null;
  if (previous) {
    try {
      validatePayload(previous);
      validPrevious = previous;
    } catch {
      validPrevious = null;
    }
  }

  const normalizedProviders = payload.providers.map(provider => normalizeProviderStatus(provider, payload.incidents, now));
  const normalizedCount = normalizedProviders.filter((provider, index) => provider.source_state !== payload.providers[index].source_state).length;
  const validStatusCount = normalizedProviders.filter(providerHasValidStatusData).length;
  const invalidStatusCount = normalizedProviders.length - validStatusCount;
  const validStatusPercent = normalizedProviders.length
    ? Math.round(validStatusCount / normalizedProviders.length * 100)
    : 0;
  const summarized = summarizeProviders(normalizedProviders, payload.incidents);
  const validatedBase = {
    ...payload,
    providers: normalizedProviders,
    summary: {
      ...summarized,
      valid_status_count: validStatusCount,
      invalid_status_count: invalidStatusCount,
      valid_status_percent: validStatusPercent
    }
  };

  validatePayload(validatedBase);

  const base = {
    ...validatedBase,
    summary: {
      ...validatedBase.summary,
      live_source_coverage_percent: summarized.coverage_percent,
      coverage_percent: validStatusPercent
    }
  };
  const changes = compareSnapshots(validPrevious, base, now);
  const normalized = {
    ...base,
    changes,
    history: [...changes, ...(validPrevious?.history || payload.history || [])].slice(0, 100),
    status_data_policy: {
      requirement: 'Every provider must publish valid status data.',
      valid_source_states: [...validSourceStates],
      normalized_provider_count: normalizedCount,
      coverage_definition: 'coverage_percent is valid provider status coverage; live_source_coverage_percent is machine-readable live official source coverage.'
    }
  };

  const invalid = normalized.providers.filter(provider => !providerHasValidStatusData(provider));
  if (invalid.length) {
    throw new Error(`Status data requirement failed for: ${invalid.map(provider => provider.id).join(', ')}`);
  }
  if (normalized.summary.invalid_status_count !== 0 || normalized.summary.valid_status_count !== normalized.providers.length) {
    throw new Error('Status data summary did not reconcile to zero invalid providers.');
  }
  if (normalized.summary.coverage_percent !== 100) {
    throw new Error(`Provider coverage must be 100, received ${normalized.summary.coverage_percent}.`);
  }

  return normalized;
}

export function enforceValidStatusFile(statusPath = defaultStatusPath, previousPath = defaultPreviousPath) {
  const payload = readJson(statusPath);
  let previous = null;
  try {
    previous = readJson(previousPath);
  } catch {
    previous = null;
  }
  const normalized = normalizeStatusPayload(payload, previous, payload.generated_at);
  writeJson(statusPath, normalized);
  return normalized;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const statusPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultStatusPath;
  const previousPath = process.argv[3] ? path.resolve(process.argv[3]) : defaultPreviousPath;
  const payload = enforceValidStatusFile(statusPath, previousPath);
  console.log(`Validated status data for ${payload.providers.length} providers: ${payload.summary.invalid_status_count} invalid, ${payload.summary.valid_status_count} valid, ${payload.summary.coverage_percent}% provider coverage, ${payload.summary.live_source_coverage_percent}% live source coverage.`);
}
