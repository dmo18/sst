import { loadPublicProvider } from './update-public-status.mjs';
import { isEditorialIncidentEntry, isGenericIncidentTitle, isIncidentUsRelevant } from './incident-detail-repairs.mjs';

const targets = [
  { id: 'cloudflare', name: 'Cloudflare', category: 'Cloud Services', priority: 95, sourceType: 'statuspage', url: 'https://www.cloudflarestatus.com/api/v2/summary.json' },
  { id: 'docker', name: 'Docker', category: 'DevOps', priority: 60, sourceType: 'statuspage', url: 'https://status.docker.com/api/v2/summary.json' },
  { id: 'cisco-umbrella', name: 'Cisco Umbrella', category: 'Security / DNS', priority: 78, sourceType: 'statuspage', url: 'https://status.umbrella.com/api/v2/summary.json' },
  { id: 'n-able', name: 'N-able', category: 'MSP Platforms', priority: 86, sourceType: 'statuspage', url: 'https://status.n-able.com/api/v2/summary.json' },
  { id: 'cove-data-protection', name: 'Cove Data Protection', category: 'Backup', priority: 78, sourceType: 'statuspage', url: 'https://status.covedataprotection.com/api/v2/summary.json' }
];

function withTimeout(promise, provider, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${provider} live source timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

const settled = await Promise.allSettled(targets.map(provider => withTimeout(loadPublicProvider(provider), provider.name)));
const results = settled.filter(item => item.status === 'fulfilled').map(item => item.value);
const transportFailures = settled
  .map((item, index) => item.status === 'rejected' ? `${targets[index].name}: ${item.reason?.message || item.reason}` : '')
  .filter(Boolean);
const incidents = results.flatMap(result => result.incidents || []);
const failures = [];

if (results.length < 3) failures.push(`Only ${results.length} of ${targets.length} targeted sources returned a fail-closed record.`);

for (const result of results) {
  if (result.source_state !== 'available' && (result.incidents || []).length) {
    failures.push(`${result.name}: non-live source published ${result.incidents.length} incidents.`);
  }
  if (['n-able', 'cove-data-protection'].includes(result.id) && !/^https:\/\/uptime\.n-able\.com\//i.test(result.source || '')) {
    failures.push(`${result.name}: wrong operational source: ${result.source}`);
  }
}

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

console.log(JSON.stringify({
  transport_failures: transportFailures,
  providers: results.map(result => ({
    id: result.id,
    service_state: result.service_state,
    source_state: result.source_state,
    source: result.source,
    status: result.status,
    incidents: (result.incidents || []).map(item => ({
      title: item.title,
      status: item.status,
      affected_service: item.affected_service,
      first_detected: item.first_detected,
      latest_update: item.latest_update,
      note: String(item.note || '').slice(0, 240)
    }))
  }))
}, null, 2));

if (failures.length) throw new Error(`Live incident audit failed:\n${failures.join('\n')}`);
console.log('Targeted live incident detail audit passed with transport failures treated as unknown.');
