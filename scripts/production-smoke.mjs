import { ACTIVE_PROVIDER_CATALOG_HASH, ACTIVE_PROVIDER_IDS } from '../src/providerCatalog.ts';
import { wirePayloadValidationErrors } from '../src/wirePayloadValidation.ts';
import { verifyReleaseContract } from './release-contract.mjs';
import { resolveDeployedStatus } from './deployed-status.mjs';

const requestedBase = process.argv[2] || 'https://dmo18.github.io/sst/';
const base = new URL(requestedBase.endsWith('/') ? requestedBase : `${requestedBase}/`).href;
const cacheBust = Date.now();
const htmlResponse = await fetch(`${base}?smoke=${cacheBust}`, { redirect: 'follow', cache: 'no-store' });
console.log(`INDEX ${htmlResponse.status} ${htmlResponse.url} ${htmlResponse.headers.get('content-type') || ''}`);
const html = await htmlResponse.text();
console.log(`INDEX_BYTES ${Buffer.byteLength(html)}`);
if (!htmlResponse.ok) throw new Error(`index failed with HTTP ${htmlResponse.status}`);
const deployedBase = new URL('.', htmlResponse.url).href;
if (!/<title>ServiceOps \| MSP Service Intelligence<\/title>/i.test(html)) throw new Error('deployed index does not identify the v3.1 ServiceOps enterprise workspace');
if (!/http-equiv=["']Content-Security-Policy["']/i.test(html)) throw new Error('deployed index is missing the Content Security Policy');

const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(match => new URL(match[1], deployedBase).href);
const styles = [...html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi)].map(match => new URL(match[1], deployedBase).href).filter(url => /\.css(?:\?|$)/.test(url));
console.log(`SCRIPTS ${scripts.join(' ') || 'none'}`);
console.log(`STYLES ${styles.join(' ') || 'none'}`);
if (!scripts.length) throw new Error('no JavaScript bundle found in index');
if (!styles.length) throw new Error('no stylesheet bundle found in index');

for (const url of [...scripts, ...styles]) {
  const response = await fetch(url, { redirect: 'follow', cache: 'no-store' });
  const body = await response.arrayBuffer();
  console.log(`ASSET ${response.status} ${body.byteLength} ${response.headers.get('content-type') || ''} ${url}`);
  if (!response.ok || body.byteLength === 0) throw new Error(`asset failed: ${url}`);
}

const deployed = await resolveDeployedStatus(deployedBase, { token: cacheBust });
const deployMetadata = deployed.metadata;
console.log(`DEPLOY_VERSION 200 ${Object.entries(deployMetadata).map(([key, value]) => `${key}: ${value}`).join(' | ')}`);

if (process.env.GITHUB_SHA && deployMetadata.commit !== process.env.GITHUB_SHA)
  throw new Error(`deployed commit ${deployMetadata.commit || 'missing'} does not match workflow commit ${process.env.GITHUB_SHA}`);
if (process.env.GITHUB_RUN_ID && deployMetadata.run_id !== process.env.GITHUB_RUN_ID)
  throw new Error(`deployed run ${deployMetadata.run_id || 'missing'} does not match workflow run ${process.env.GITHUB_RUN_ID}`);
if (!Number.isFinite(Date.parse(deployMetadata.generated_at || '')))
  throw new Error('deployed generated_at marker is invalid');

console.log(`STATUS_PATH ${deployed.statusPath}`);
const statusResponse = await fetch(deployed.statusUrl, { redirect: 'follow', cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
console.log(`STATUS ${statusResponse.status} ${statusResponse.headers.get('content-type') || ''}`);
const statusText = await statusResponse.text();
console.log(`STATUS_BYTES ${Buffer.byteLength(statusText)}`);
if (!statusResponse.ok) throw new Error(`status failed with HTTP ${statusResponse.status}`);
const payload = JSON.parse(statusText);
const errors = wirePayloadValidationErrors(payload, ACTIVE_PROVIDER_IDS, ACTIVE_PROVIDER_CATALOG_HASH);
const collection = payload.collection;
console.log(`PAYLOAD_VERSION ${payload?.schema_version}`);
console.log(`CONTRACT_VERSION ${payload?.contract_version}`);
console.log(`CATALOG_HASH ${payload?.catalog_hash}`);
console.log(`GENERATED_AT ${payload?.generated_at}`);
console.log(`PROVIDERS ${payload?.providers?.length}`);
console.log(`INCIDENTS ${payload?.incidents?.length}`);
console.log(`MAINTENANCE ${payload?.maintenance?.length}`);
console.log(`PIPELINE_VERSION ${collection?.pipeline_version || 'missing'}`);
console.log(`COLLECTION_RUN ${collection?.run_id || 'missing'}`);
console.log(`COLLECTION_QUALITY ${collection?.quality_score ?? 'missing'}`);
console.log(`COLLECTION_ORIGINS ${collection?.origin_count ?? 'missing'}`);
console.log(`COLLECTION_REQUESTS ${collection?.request_count ?? 'missing'}`);
console.log(`COLLECTION_HEALTH healthy=${collection?.healthy_source_count ?? 'missing'} watch=${collection?.watch_source_count ?? 'missing'} blind=${collection?.blind_spot_count ?? 'missing'}`);
console.log(`VALIDATION_ERRORS ${errors.length}`);
for (const error of errors) console.log(`VALIDATION_ERROR ${error}`);
if (errors.length) throw new Error(`deployed payload rejected by browser validator: ${errors.join('; ')}`);
const release = verifyReleaseContract(payload, Date.now(), ACTIVE_PROVIDER_CATALOG_HASH);
console.log(`RELEASE_CONTRACT ${release.state} ${release.description}`);
