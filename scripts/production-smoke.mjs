import { payloadValidationErrors } from '../src/payloadValidation.ts';

const requestedBase = process.argv[2] || 'https://dmo18.github.io/sst/';
const base = new URL(requestedBase.endsWith('/') ? requestedBase : `${requestedBase}/`).href;
const cacheBust = Date.now();
const htmlResponse = await fetch(`${base}?smoke=${cacheBust}`, { redirect: 'follow', cache: 'no-store' });
console.log(`INDEX ${htmlResponse.status} ${htmlResponse.url} ${htmlResponse.headers.get('content-type') || ''}`);
const html = await htmlResponse.text();
console.log(`INDEX_BYTES ${Buffer.byteLength(html)}`);
if (!htmlResponse.ok) throw new Error(`index failed with HTTP ${htmlResponse.status}`);

const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(match => new URL(match[1], base).href);
const styles = [...html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi)].map(match => new URL(match[1], base).href).filter(url => /\.css(?:\?|$)/.test(url));
console.log(`SCRIPTS ${scripts.join(' ') || 'none'}`);
console.log(`STYLES ${styles.join(' ') || 'none'}`);
if (!scripts.length) throw new Error('no JavaScript bundle found in index');

for (const url of [...scripts, ...styles]) {
  const response = await fetch(url, { redirect: 'follow', cache: 'no-store' });
  const body = await response.arrayBuffer();
  console.log(`ASSET ${response.status} ${body.byteLength} ${response.headers.get('content-type') || ''} ${url}`);
  if (!response.ok || body.byteLength === 0) throw new Error(`asset failed: ${url}`);
}

const statusUrl = new URL('status.json', base);
statusUrl.searchParams.set('smoke', String(cacheBust));
const statusResponse = await fetch(statusUrl, { redirect: 'follow', cache: 'no-store' });
console.log(`STATUS ${statusResponse.status} ${statusResponse.headers.get('content-type') || ''}`);
const statusText = await statusResponse.text();
console.log(`STATUS_BYTES ${Buffer.byteLength(statusText)}`);
if (!statusResponse.ok) throw new Error(`status failed with HTTP ${statusResponse.status}`);
const payload = JSON.parse(statusText);
const errors = payloadValidationErrors(payload);
console.log(`PAYLOAD_VERSION ${payload?.schema_version}`);
console.log(`GENERATED_AT ${payload?.generated_at}`);
console.log(`PROVIDERS ${payload?.providers?.length}`);
console.log(`INCIDENTS ${payload?.incidents?.length}`);
console.log(`MAINTENANCE ${payload?.maintenance?.length}`);
console.log(`VALIDATION_ERRORS ${errors.length}`);
for (const error of errors) console.log(`VALIDATION_ERROR ${error}`);
if (errors.length) throw new Error(`deployed payload rejected by browser validator: ${errors.join('; ')}`);
