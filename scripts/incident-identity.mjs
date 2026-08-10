function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function stableIncidentHash(value) {
  const text = String(value || '');
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function fallbackIncidentToken({ provider = '', title = '', note = '', source = '', affectedService = '', firstDetected = '' } = {}) {
  const normalizedTitle = clean(title) || 'incident';
  const normalizedProvider = clean(provider) || 'provider';
  const signature = [
    normalizedProvider,
    normalizedTitle,
    clean(source),
    clean(affectedService),
    clean(firstDetected),
    clean(note).slice(0, 180)
  ].join('|');
  const slug = normalizedTitle.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'incident';
  return `${slug}-${stableIncidentHash(signature)}`;
}

export function uniqueIncidentIds(items) {
  const counts = new Map();
  return (Array.isArray(items) ? items : []).map(item => {
    const baseId = String(item?.id || '');
    const count = Number(counts.get(baseId) || 0);
    counts.set(baseId, count + 1);
    if (!baseId || count === 0) return item;
    const suffix = fallbackIncidentToken({
      provider: item?.providerId || item?.provider,
      title: item?.title,
      note: item?.note,
      source: item?.url || item?.source,
      affectedService: item?.affected_service,
      firstDetected: item?.first_detected || item?.rawTime
    });
    return { ...item, id: `${baseId}:${suffix}` };
  });
}
