import { payloadValidationErrors } from '../src/payloadValidation.ts';

const requestedBase = process.argv[2] || 'https://dmo18.github.io/sst/';
const base = new URL(requestedBase.endsWith('/') ? requestedBase : `${requestedBase}/`).href;
const cacheBust = Date.now();
const htmlResponse = await fetch(`${base}?smoke=${cacheBust}`, { redirect: 'follow', cache: 'no-store' });
console.log(`INDEX ${htmlResponse.status} ${htmlResponse.url} ${htmlResponse.headers.get('content-type') || ''}`);
const html = await htmlResponse.text();
console.log(`INDEX_BYTES ${Buffer.byteLength(html)}`);
if (!htmlResponse.ok) throw new Error(`index failed with HTTP ${htmlResponse.status}`);
if (!/<title>ServiceOps \| MSP Service Intelligence<\/title>/i.test(html)) throw new Error('deployed index does not identify the v3.1 ServiceOps enterprise workspace');

const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(match => new URL(match[1], base).href);
const styles = [...html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi)].map(match => new URL(match[1], base).href).filter(url => /\.css(?:\?|$)/.test(url));
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

const deployVersionUrl = new URL('deploy-version.txt', base);
deployVersionUrl.searchParams.set('smoke', String(cacheBust));
const deployVersionResponse = await fetch(deployVersionUrl, { redirect: 'follow', cache: 'no-store' });
const deployVersionText = await deployVersionResponse.text();
console.log(`DEPLOY_VERSION ${deployVersionResponse.status} ${deployVersionText.trim().replaceAll('\n', ' | ')}`);
if (!deployVersionResponse.ok) throw new Error(`deploy-version.txt failed with HTTP ${deployVersionResponse.status}`);

const deployMetadata = Object.fromEntries(deployVersionText
  .trim()
  .split(/\r?\n/)
  .map(line => {
    const separator = line.indexOf(':');
    return separator > 0 ? [line.slice(0, separator).trim(), line.slice(separator + 1).trim()] : [line.trim(), ''];
  }));

if (process.env.GITHUB_SHA && deployMetadata.commit !== process.env.GITHUB_SHA)
  throw new Error(`deployed commit ${deployMetadata.commit || 'missing'} does not match workflow commit ${process.env.GITHUB_SHA}`);
if (process.env.GITHUB_RUN_ID && deployMetadata.run_id !== process.env.GITHUB_RUN_ID)
  throw new Error(`deployed run ${deployMetadata.run_id || 'missing'} does not match workflow run ${process.env.GITHUB_RUN_ID}`);
if (!Number.isFinite(Date.parse(deployMetadata.generated_at || '')))
  throw new Error('deployed generated_at marker is invalid');

const statusUrl = new URL('status.json', base);
statusUrl.searchParams.set('smoke', String(cacheBust));
const statusResponse = await fetch(statusUrl, { redirect: 'follow', cache: 'no-store' });
console.log(`STATUS ${statusResponse.status} ${statusResponse.headers.get('content-type') || ''}`);
const statusText = await statusResponse.text();
console.log(`STATUS_BYTES ${Buffer.byteLength(statusText)}`);
if (!statusResponse.ok) throw new Error(`status failed with HTTP ${statusResponse.status}`);
const payload = JSON.parse(statusText);
const errors = payloadValidationErrors(payload);
const collection = payload.collection;
console.log(`PAYLOAD_VERSION ${payload?.schema_version}`);
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
if (!collection || collection.pipeline_version !== '3.0.0') throw new Error('deployed payload is missing the v3 collection contract');
if (collection.provider_count !== payload.providers.length) throw new Error('deployed collection provider count mismatch');
if (collection.request_count !== collection.successful_request_count + collection.failed_request_count) throw new Error('deployed collection request count mismatch');
if (collection.healthy_source_count + collection.watch_source_count + collection.blind_spot_count !== payload.providers.length) throw new Error('deployed collection source-health count mismatch');
if (!Number.isFinite(collection.quality_score) || collection.quality_score < 0 || collection.quality_score > 100) throw new Error('deployed collection quality score is invalid');
