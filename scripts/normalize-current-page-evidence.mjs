import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const defaultStatusPath = path.join(root, 'public', 'status.json');

const RINGCENTRAL_SOURCE = 'RingCentral public status dashboard';
const RINGCENTRAL_URL = 'https://status.ringcentral.com/';

function validObservedAt(value) {
  return Number.isFinite(Date.parse(value || '')) ? value : '';
}

export function normalizeCurrentPageEvidence(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  const provider = Array.isArray(payload.providers)
    ? payload.providers.find(item => item?.id === 'ringcentral')
    : null;
  const observedAt = validObservedAt(provider?.checked_at) || validObservedAt(payload.generated_at);
  if (!observedAt || provider?.source_state !== 'available') return payload;

  const incidents = Array.isArray(payload.incidents)
    ? payload.incidents.map(incident => {
        const untimed = !incident?.latest_update && !incident?.first_detected && !incident?.rawTime;
        const exactCurrentSource = incident?.providerId === 'ringcentral'
          && incident?.source === RINGCENTRAL_SOURCE
          && incident?.url === RINGCENTRAL_URL;
        if (!untimed || !exactCurrentSource || incident?.evidence_basis) return incident;
        return { ...incident, evidence_basis: 'current-page', observed_at: observedAt };
      })
    : payload.incidents;

  return { ...payload, incidents };
}

export function normalizeCurrentPageEvidenceFile(statusPath = defaultStatusPath) {
  const payload = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  const normalized = normalizeCurrentPageEvidence(payload);
  fs.writeFileSync(statusPath, `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) normalizeCurrentPageEvidenceFile();
