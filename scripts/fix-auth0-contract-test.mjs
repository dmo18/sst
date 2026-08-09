import fs from 'node:fs';

const path = 'scripts/__tests__/source-parity-structured.test.js';
let source = fs.readFileSync(path, 'utf8');
const before = `test('Auth0 uses its current official public cloud status page instead of a retired Statuspage API path', () => {\n  const source = resolvePublicSource(provider('auth0', 'Auth0'));\n  assert.equal(source.mode, 'status-html');\n  assert.equal(source.url, 'https://status.auth0.com/?environment=Production&region=US');\n  assert.equal(source.pageUrl, 'https://status.auth0.com/');\n  assert.equal(source.render, true);\n  assert.equal(source.regionScope, 'us');\n});`;
const after = `test('Auth0 uses its current official server-rendered Public Cloud status snapshot instead of browser fallback or a retired Statuspage API path', () => {\n  const source = resolvePublicSource(provider('auth0', 'Auth0'));\n  assert.equal(source.mode, 'auth0-next-data');\n  assert.equal(source.url, 'https://status.auth0.com/?environment=Production&region=US');\n  assert.equal(source.pageUrl, 'https://status.auth0.com/');\n  assert.equal(source.render, false);\n  assert.equal(source.discoverFeeds, false);\n  assert.equal(source.regionScope, 'us');\n});`;
if (!source.includes(before)) throw new Error('Missing old Auth0 source parity contract');
source = source.replace(before, after);
fs.writeFileSync(path, source);
console.log('Updated Auth0 source parity contract.');
