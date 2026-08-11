import fs from 'node:fs';
import path from 'node:path';

export const LEGACY_CHROMIUM_MAX_REVISION = 950365;
export const LEGACY_CHROMIUM_PLATFORM = 'Linux_x64';
const SNAPSHOT_BUCKET = 'https://commondatastorage.googleapis.com/chromium-browser-snapshots';

export function publishedSnapshotRevisions(xml, platform = LEGACY_CHROMIUM_PLATFORM) {
  const escaped = platform.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<Prefix>${escaped}/(\\d+)/<\\/Prefix>`, 'g');
  return [...xml.matchAll(pattern)]
    .map(match => Number(match[1]))
    .filter(Number.isInteger)
    .sort((left, right) => right - left);
}

export function selectLegacySnapshotRevision(revisions, maxRevision = LEGACY_CHROMIUM_MAX_REVISION) {
  return [...new Set(revisions)]
    .filter(revision => Number.isInteger(revision) && revision <= maxRevision)
    .sort((left, right) => right - left)[0] || 0;
}

export async function resolveLegacyChromiumSnapshot(maxRevision = LEGACY_CHROMIUM_MAX_REVISION, fetchImpl = fetch) {
  if (!Number.isInteger(maxRevision) || maxRevision <= 0) throw new Error('Legacy Chromium maximum revision must be a positive integer.');
  const prefix = String(maxRevision).slice(0, 3);
  const listingUrl = `${SNAPSHOT_BUCKET}/?delimiter=/&prefix=${encodeURIComponent(`${LEGACY_CHROMIUM_PLATFORM}/${prefix}`)}`;
  const listing = await fetchImpl(listingUrl, { redirect: 'follow' });
  if (!listing.ok) throw new Error(`Unable to list Chromium snapshots: HTTP ${listing.status}`);
  const revisions = publishedSnapshotRevisions(await listing.text());
  const candidates = [...new Set(revisions.filter(revision => revision <= maxRevision))].sort((left, right) => right - left);
  if (!candidates.length) throw new Error(`No published ${LEGACY_CHROMIUM_PLATFORM} snapshot exists at or below ${maxRevision} in prefix ${prefix}.`);

  for (const revision of candidates) {
    const url = `${SNAPSHOT_BUCKET}/${LEGACY_CHROMIUM_PLATFORM}/${revision}/chrome-linux.zip`;
    const response = await fetchImpl(url, { method: 'HEAD', redirect: 'follow' });
    if (response.ok) return { revision, url, maxRevision };
  }
  throw new Error(`Published snapshot directories were listed below ${maxRevision}, but no chrome-linux.zip artifact was available.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const maxRevision = Number(process.argv[2] || process.env.LEGACY_CHROMIUM_MAX_REVISION || LEGACY_CHROMIUM_MAX_REVISION);
  const result = await resolveLegacyChromiumSnapshot(maxRevision);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `revision=${result.revision}\nurl=${result.url}\nmax_revision=${result.maxRevision}\n`);
  }
  console.log(`Resolved published legacy Chromium snapshot ${result.revision} at or below Chrome 98 branch-base ceiling ${result.maxRevision}.`);
  console.log(result.url);
}
