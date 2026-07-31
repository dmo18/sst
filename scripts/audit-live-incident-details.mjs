import fs from 'node:fs';
import { isEditorialIncidentEntry, isGenericIncidentTitle, isIncidentUsRelevant } from './incident-detail-repairs.mjs';

const payload = JSON.parse(fs.readFileSync(new URL('../public/status.json', import.meta.url), 'utf8'));
const incidents = Array.isArray(payload.incidents) ? payload.incidents : [];
const failures = [];

for (const incident of incidents) {
  if (isGenericIncidentTitle(incident.title)) failures.push(`${incident.provider}: generic title: ${incident.title}`);
  if (isEditorialIncidentEntry(incident)) failures.push(`${incident.provider}: editorial item: ${incident.title}`);
  if (/public status(?: page)? reports an active issue/i.test(incident.title || '')) failures.push(`${incident.provider}: fabricated title: ${incident.title}`);

  if (incident.providerId === 'cisco-umbrella' && !isIncidentUsRelevant(incident)) {
    failures.push(`Cisco Umbrella: non-US incident: ${incident.title}`);
  }
  if (incident.providerId === 'n-able') {
    if (/Adlumin Q2 Wrap-Up|Broader Coverage|Faster Investigation|Partner Operations|release notes?|what'?s new/i.test(`${incident.title} ${incident.note}`)) {
      failures.push(`N-able: marketing item: ${incident.title}`);
    }
    if (/\bCove Data Protection\b/i.test(`${incident.title} ${incident.affected_service || ''}`)) failures.push(`N-able: Cove incident mixed into N-able: ${incident.title}`);
  }
  if (incident.providerId === 'cove-data-protection') {
    if (/\bN-central\b/i.test(`${incident.title} ${incident.note} ${incident.affected_service || ''}`)) failures.push(`Cove: N-central data mixed in: ${incident.title}`);
    if (/\b(?:EMEA|Europe|London|United Kingdom|UK)\b/i.test(`${incident.title} ${incident.note} ${incident.affected_service || ''}`)) failures.push(`Cove: non-US incident retained: ${incident.title}`);
    if (String(incident.note || '').length > 1000) failures.push(`Cove: unbounded note (${incident.note.length} chars): ${incident.title}`);
  }
}

const selected = incidents
  .filter(item => ['cloudflare', 'docker', 'cisco-umbrella', 'n-able', 'cove-data-protection'].includes(item.providerId))
  .map(item => ({
    provider: item.provider,
    title: item.title,
    status: item.status,
    affected_service: item.affected_service,
    first_detected: item.first_detected,
    latest_update: item.latest_update,
    note: String(item.note || '').slice(0, 240)
  }));

console.log(JSON.stringify({
  generated_at: payload.generated_at,
  provider_count: payload.providers?.length,
  incident_count: incidents.length,
  selected
}, null, 2));

if (failures.length) throw new Error(`Live incident audit failed:\n${failures.join('\n')}`);
console.log('Live incident detail audit passed.');
