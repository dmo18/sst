import { fallbackIncidentToken } from './incident-identity.mjs';

export const ADAPTER_RESULT_KINDS = Object.freeze(['healthy', 'issue', 'issues', 'component-state', 'limited', 'access-gated']);

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function hasVendorTime(conclusion) {
  return Boolean(conclusion?.latestUpdate || conclusion?.latest_update || conclusion?.firstDetected || conclusion?.first_detected || conclusion?.time || conclusion?.rawTime);
}

export function normalizeCurrentPageConclusion(provider, conclusion, sourceUrl = '') {
  if (!conclusion || typeof conclusion !== 'object') return conclusion;
  if (!ADAPTER_RESULT_KINDS.includes(conclusion.kind)) throw new Error(`Unsupported source adapter result kind: ${conclusion.kind || 'missing'}`);
  if (conclusion.kind !== 'issue') return conclusion;

  const title = clean(conclusion.title || `${provider?.name || 'Provider'} service issue`);
  const note = clean(conclusion.note || 'The official current status page reports a service issue.');
  const source = clean(sourceUrl || provider?.url || '');
  const id = clean(conclusion.id) || fallbackIncidentToken({
    provider: clean(provider?.name || provider?.id || 'provider'),
    title,
    note,
    source,
    affectedService: conclusion.affectedService || conclusion.affected_service || '',
    firstDetected: conclusion.firstDetected || conclusion.first_detected || conclusion.time || ''
  });

  return {
    ...conclusion,
    id,
    title,
    note,
    ...(!hasVendorTime(conclusion) ? { evidenceBasis: conclusion.evidenceBasis || conclusion.evidence_basis || 'current-page' } : {})
  };
}

export function defineSourceAdapter(definition) {
  if (!definition || typeof definition !== 'object') throw new Error('Source adapter definition must be an object.');
  if (!definition.id || typeof definition.id !== 'string') throw new Error('Source adapter id is required.');
  if (typeof definition.conclude !== 'function') throw new Error(`Source adapter ${definition.id} requires conclude().`);
  return Object.freeze({ ...definition });
}

export class SourceAdapterRegistry {
  #adapters = new Map();

  register(definition) {
    const adapter = defineSourceAdapter(definition);
    if (this.#adapters.has(adapter.id)) throw new Error(`Duplicate source adapter id: ${adapter.id}`);
    this.#adapters.set(adapter.id, adapter);
    return this;
  }

  has(id) {
    return this.#adapters.has(id);
  }

  get(id) {
    return this.#adapters.get(id) || null;
  }

  conclude(id, provider, input, context = {}) {
    const adapter = this.get(id);
    if (!adapter) throw new Error(`Unknown source adapter: ${id}`);
    const conclusion = adapter.conclude(provider, input, context);
    return context.currentPage === true
      ? normalizeCurrentPageConclusion(provider, conclusion, context.sourceUrl)
      : conclusion;
  }

  ids() {
    return [...this.#adapters.keys()].sort();
  }
}
