export const PARSER_VERSION = '2.5.1';

const structuredModes = new Set(['statuspage-json', 'betterstack-json', 'provider-json']);
const feedModes = new Set(['feed', 'rss', 'atom']);

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function hashString(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function jsonShape(value, depth = 0) {
  if (depth > 5) return typeof value;
  if (Array.isArray(value)) {
    const shapes = [...new Set(value.slice(0, 12).map(item => jsonShape(item, depth + 1)))].sort();
    return `[${shapes.join('|')}]`;
  }
  if (!value || typeof value !== 'object') return value === null ? 'null' : typeof value;
  return `{${Object.keys(value).sort().map(key => `${key}:${jsonShape(value[key], depth + 1)}`).join(',')}}`;
}

export function schemaFingerprint(value, mode = '') {
  const text = String(value || '');
  if (!text) return '';
  if (structuredModes.has(mode) || /json/i.test(mode)) {
    try {
      return `json-${hashString(jsonShape(JSON.parse(text)))}`;
    } catch {
      return '';
    }
  }
  if (feedModes.has(mode) || /(?:rss|atom|feed|xml)/i.test(mode)) {
    const tags = [...text.matchAll(/<\/?([a-z][a-z0-9:_-]*)\b/gi)]
      .map(match => match[1].toLowerCase())
      .filter(tag => !['br', 'p', 'div', 'span'].includes(tag));
    const shape = [...new Set(tags)].sort().join('|');
    return shape ? `xml-${hashString(shape)}` : '';
  }
  if (/statusio-html|rendered/i.test(mode)) {
    const markers = [
      'active incident', 'scheduled maintenance', 'past incidents', 'components', 'locations',
      'investigating', 'identified', 'monitoring', 'major outage', 'partial outage', 'degraded performance'
    ].filter(marker => text.toLowerCase().includes(marker));
    return markers.length ? `page-${hashString(markers.join('|'))}` : '';
  }
  return '';
}

export function sourceEvidence(mode = '', sourceState = 'unavailable', ok = false) {
  let evidenceTier = 'public-page';
  if (structuredModes.has(mode) || /json/i.test(mode)) evidenceTier = 'structured';
  else if (feedModes.has(mode) || /(?:rss|atom|feed)/i.test(mode)) evidenceTier = 'feed';
  else if (/statusio-html|rendered/i.test(mode)) evidenceTier = 'rendered-page';
  else if (/limited|fallback|unknown/i.test(mode)) evidenceTier = 'limited';

  let confidence = 'low';
  if (sourceState === 'unavailable' || sourceState === 'pending' || !ok) confidence = 'none';
  else if (sourceState === 'limited' || evidenceTier === 'limited') confidence = 'low';
  else if (evidenceTier === 'structured') confidence = 'high';
  else if (evidenceTier === 'feed' || evidenceTier === 'rendered-page') confidence = 'medium';

  return {
    evidence_tier: evidenceTier,
    source_confidence: confidence,
    parser_version: PARSER_VERSION
  };
}

function incidentSignature(items) {
  return (items || [])
    .map(item => `${item.id}|${item.status || ''}|${item.service_state || ''}|${item.latest_update || item.rawTime || ''}`)
    .sort()
    .join('~');
}

function componentSignature(items) {
  return (items || [])
    .map(item => `${clean(item.name)}:${clean(item.status)}`)
    .sort()
    .join('~');
}

function semanticSignature(provider, incidents) {
  return [
    provider.service_state,
    provider.source_state,
    clean(provider.status),
    incidentSignature(incidents),
    componentSignature(provider.component_status)
  ].join('||');
}

export function enrichProviderHistory(results, previous, currentIncidents, generatedAt) {
  const oldProviders = new Map((previous?.providers || []).map(provider => [provider.id, provider]));
  const oldIncidents = previous?.incidents || [];

  return results.map(result => {
    const old = oldProviders.get(result.id);
    const evidence = sourceEvidence(result.source_type || '', result.source_state, result.ok);
    const failed = result.source_state === 'unavailable';
    const consecutiveFailures = failed ? Number(old?.consecutive_failures || 0) + 1 : 0;
    const success = result.source_state === 'available' && result.ok === true;
    const schemaChanged = Boolean(
      success
      && old?.schema_fingerprint
      && result.schema_fingerprint
      && old.schema_fingerprint !== result.schema_fingerprint
    );
    const currentForProvider = currentIncidents.filter(item => item.providerId === result.id);
    const oldForProvider = oldIncidents.filter(item => item.providerId === result.id);
    const changed = !old || semanticSignature(result, currentForProvider) !== semanticSignature(old, oldForProvider);
    const lastSemanticChange = changed
      ? generatedAt
      : old?.last_semantic_change_at || previous?.generated_at || generatedAt;
    const critical = result.criticality === 'high' || Number(result.priority || 0) >= 85;
    let attention = result.attention;
    if (consecutiveFailures >= 2 && critical) attention = 'action';
    else if (schemaChanged && attention === 'informational') attention = 'watch';

    return {
      ...result,
      ...evidence,
      attention,
      last_success_at: success ? generatedAt : old?.last_success_at || '',
      consecutive_failures: consecutiveFailures,
      last_semantic_change_at: lastSemanticChange,
      schema_changed: schemaChanged
    };
  });
}

function maintenanceState(value) {
  const status = clean(value).toLowerCase();
  if (/in[_ -]?progress|ongoing|underway|started/.test(status)) return 'in_progress';
  if (/completed|resolved|cancelled|canceled|finished/.test(status)) return 'completed';
  if (/scheduled|planned|upcoming|not[_ -]?started/.test(status)) return 'scheduled';
  return 'unknown';
}

export function normalizeMaintenanceState(value) {
  return maintenanceState(value);
}

export function maintenanceIsRelevant(item, now = Date.now(), horizonDays = 45) {
  if (!item || maintenanceState(item.status) === 'completed') return false;
  const end = Date.parse(item.ends_at || '');
  if (Number.isFinite(end) && end < now - 15 * 60 * 1000) return false;
  const start = Date.parse(item.starts_at || '');
  if (Number.isFinite(start) && start > now + horizonDays * 24 * 60 * 60 * 1000) return false;
  const announced = Date.parse(item.announced_at || item.latest_update || '');
  if (!Number.isFinite(start) && Number.isFinite(announced) && announced < now - horizonDays * 24 * 60 * 60 * 1000) return false;
  return true;
}

function maintenanceSignature(item) {
  return [item.status || '', item.starts_at || '', item.ends_at || '', item.latest_update || '', item.affected_service || ''].join('|');
}

export function sourceIntelligenceSummary(providers, maintenance = []) {
  const available = providers.filter(provider => provider.source_state === 'available' && provider.ok === true);
  const components = providers.flatMap(provider => Array.isArray(provider.component_status) ? provider.component_status : []);
  return {
    maintenance_count: maintenance.length,
    ongoing_maintenance_count: maintenance.filter(item => maintenanceState(item.status) === 'in_progress').length,
    structured_source_count: available.filter(provider => provider.evidence_tier === 'structured').length,
    feed_source_count: available.filter(provider => provider.evidence_tier === 'feed').length,
    page_source_count: available.filter(provider => ['rendered-page', 'public-page'].includes(provider.evidence_tier)).length,
    high_confidence_source_count: providers.filter(provider => provider.source_confidence === 'high').length,
    schema_change_count: providers.filter(provider => provider.schema_changed === true).length,
    failure_streak_count: providers.filter(provider => Number(provider.consecutive_failures || 0) >= 2).length,
    component_issue_count: components.filter(component => !/^(?:operational|available|up|ok|none|good)$/i.test(String(component.status || ''))).length
  };
}

export function sourceIntelligenceChanges(previous, current, now = new Date().toISOString()) {
  if (!previous?.providers?.length) return [];
  const changes = [];
  const oldProviders = new Map(previous.providers.map(provider => [provider.id, provider]));
  const oldMaintenance = new Map((previous.maintenance || []).map(item => [item.id, item]));
  const currentMaintenance = new Map((current.maintenance || []).map(item => [item.id, item]));

  for (const provider of current.providers || []) {
    const old = oldProviders.get(provider.id);
    if (!old) continue;
    if (provider.schema_changed === true) {
      changes.push({
        id: `${now}:${provider.id}:source_schema_changed`,
        type: 'source_schema_changed',
        provider_id: provider.id,
        provider: provider.name,
        detected_at: now,
        title: `Official source schema changed for ${provider.name}`,
        attention: 'watch'
      });
    }
    if (Number(provider.consecutive_failures || 0) >= 2 && Number(old.consecutive_failures || 0) < 2) {
      changes.push({
        id: `${now}:${provider.id}:source_failure_streak`,
        type: 'source_failure_streak',
        provider_id: provider.id,
        provider: provider.name,
        detected_at: now,
        title: `${provider.consecutive_failures} consecutive source retrieval failures`,
        attention: provider.attention === 'action' ? 'action' : 'watch'
      });
    }
  }

  for (const item of currentMaintenance.values()) {
    const old = oldMaintenance.get(item.id);
    if (!old) {
      changes.push({ id: `${now}:${item.id}:maintenance_new`, type: 'maintenance_new', provider_id: item.providerId, provider: item.provider, detected_at: now, title: item.title, attention: item.status === 'in_progress' ? 'action' : 'watch' });
      continue;
    }
    if (maintenanceState(old.status) !== 'in_progress' && maintenanceState(item.status) === 'in_progress') {
      changes.push({ id: `${now}:${item.id}:maintenance_started`, type: 'maintenance_started', provider_id: item.providerId, provider: item.provider, detected_at: now, title: item.title, attention: 'action' });
    } else if (maintenanceSignature(old) !== maintenanceSignature(item)) {
      changes.push({ id: `${now}:${item.id}:maintenance_updated`, type: 'maintenance_updated', provider_id: item.providerId, provider: item.provider, detected_at: now, title: item.title, attention: 'watch' });
    }
  }

  for (const old of oldMaintenance.values()) {
    if (!currentMaintenance.has(old.id)) {
      changes.push({ id: `${now}:${old.id}:maintenance_ended`, type: 'maintenance_ended', provider_id: old.providerId, provider: old.provider, detected_at: now, title: old.title, attention: 'informational' });
    }
  }

  return changes;
}
