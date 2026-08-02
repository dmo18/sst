export const INCIDENT_MAX_AGE_DAYS = 45;

const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const monthDate = new RegExp('\\b' + MONTH + '\\s+\\d{1,2}\\s*,\\s*\\d{4}(?:\\s*(?:-|at)?\\s*\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:UTC|GMT|EDT|EST)?)?', 'gi');
const isoDate = /\b20\d{2}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/gi;

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizedDateText(value) {
  return clean(value)
    .replace(/\s+,/g, ',')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\bEDT\b/gi, 'GMT-0400')
    .replace(/\bEST\b/gi, 'GMT-0500')
    .replace(/\bUTC\b/gi, 'GMT+0000');
}

function parseDate(value) {
  const parsed = Date.parse(normalizedDateText(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function dateLikeIncidentTitle(value) {
  const title = clean(value);
  if (!title) return false;
  const monthOnly = new RegExp('^' + MONTH + '\\s+\\d{1,2}\\s*,\\s*\\d{4}(?:\\s*(?:-|at)?\\s*\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:UTC|GMT|EDT|EST)?)?$', 'i');
  return monthOnly.test(title) || /^20\d{2}-\d{2}-\d{2}(?:[ T].*)?$/.test(title);
}

export function incidentTimestampMs(item) {
  for (const key of ['latestUpdate', 'latest_update', 'rawTime', 'time', 'updated_at', 'firstDetected', 'first_detected', 'created_at']) {
    const parsed = parseDate(item?.[key]);
    if (parsed) return parsed;
  }
  return 0;
}

export function embeddedIncidentDateMs(value) {
  const text = clean(value);
  const matches = [...text.matchAll(monthDate), ...text.matchAll(isoDate)];
  return matches.map(match => parseDate(match[0])).filter(Boolean).sort((a, b) => b - a)[0] || 0;
}

export function incidentEvidenceIsCurrent(item, now = Date.now(), maxAgeDays = INCIDENT_MAX_AGE_DAYS, options = {}) {
  if (!item || dateLikeIncidentTitle(item.title)) return false;
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const timestamp = incidentTimestampMs(item);
  if (timestamp) {
    const age = now - timestamp;
    return age >= -5 * 60 * 1000 && age <= maxAgeMs;
  }
  const embedded = embeddedIncidentDateMs([item.title, item.note, item.status].filter(Boolean).join(' '));
  if (embedded) {
    const age = now - embedded;
    return age >= -5 * 60 * 1000 && age <= maxAgeMs;
  }
  return options.requireTimestamp !== true;
}
