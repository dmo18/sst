function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

const ADVISORY = /\b(?:security vulnerability|security advisory|hotfix|patch release|product defect|query-correctness defect|software defect|known issue|upgrade advisory|upgrade recommendation|defer upgrading|recommended to defer|immediate action required|proactively expanding protections|threat actors?|cve-\d{4}-\d+|release advisory)\b/i;
const EXPLICIT_NO_IMPACT = /\b(?:no (?:current )?(?:service )?impact|no impact to (?:service|services|availability|connectivity|cluster availability|data ingestion|customer traffic)|without (?:service|availability) impact|does not affect (?:service|services|availability|connectivity)|not affecting (?:service|services|availability|connectivity))\b/i;
const CURRENT_SERVICE_IMPACT = /\b(?:customers?|users?)\b[^.]{0,90}\b(?:are|were|remain|may be)\b[^.]{0,50}\b(?:experiencing|unable|affected|impacted)\b|\b(?:service|services|api|apis|availability|connectivity|authentication|login|payments?|calls?|traffic)\b[^.]{0,55}\b(?:outage|degraded|unavailable|down|disrupted|impaired|failing|intermittent)\b|\b(?:elevated|increased)\s+(?:errors?|latency|failure rates?)\b|\bfailed requests?\b|\bintermittent\s+(?:errors?|failures?|connectivity|availability)\b/i;

export function hasCurrentServiceImpact(value) {
  return CURRENT_SERVICE_IMPACT.test(clean(value));
}

export function isNonServiceAdvisory(title, note = '', status = '') {
  const text = clean(`${title} ${note} ${status}`);
  if (!text) return false;
  const currentImpact = hasCurrentServiceImpact(text);
  if (EXPLICIT_NO_IMPACT.test(text) && !currentImpact) return true;
  return ADVISORY.test(text) && !currentImpact;
}
