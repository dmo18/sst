import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAzureEntraAmericasRow, parseAzureEntraStatus } from '../entra-status-adapter.mjs';
import { loadPublicProvider, resolvePublicSource } from '../update-public-status.mjs';

function azureFixture({ nonRegional = 'Good', eastUs = 'Good', westUs = 'Not available', europe = 'Warning' } = {}) {
  return `<!doctype html><html><body>
    <section id="current-impact"><h2>Current Impact</h2><p>There are currently no active events.</p></section>
    <table class="status-table" data-zone-name="americas">
      <thead><tr>
        <th>Products and services</th>
        <th>*Non-Regional</th>
        <th>East US</th>
        <th>West US</th>
        <th>Canada Central</th>
      </tr></thead>
      <tbody>
        <tr><td>Azure Storage</td><td><span data-label="Good"></span></td><td><span data-label="Warning"></span></td><td><span data-label="Good"></span></td><td><span data-label="Good"></span></td></tr>
        <tr><td>Microsoft Entra ID (formerly Azure AD)</td><td><span class="status-icon" data-label="${nonRegional}"></span></td><td><span class="status-icon" data-label="${eastUs}"></span></td><td><span class="status-icon" data-label="${westUs}"></span></td><td><span class="status-icon" data-label="Warning"></span></td></tr>
        <tr><td>Enterprise State Roaming</td><td><span data-label="Good"></span></td><td><span data-label="Warning"></span></td><td><span data-label="Good"></span></td><td><span data-label="Good"></span></td></tr>
      </tbody>
    </table>
    <table class="status-table" data-zone-name="europe">
      <thead><tr><th>Products and services</th><th>*Non-Regional</th><th>North Europe</th></tr></thead>
      <tbody><tr><td>Microsoft Entra ID (formerly Azure AD)</td><td><span data-label="${europe}"></span></td><td><span data-label="${europe}"></span></td></tr></tbody>
    </table>
  </body></html>`;
}

test('Entra resolves to the current Azure public status page with a bounded dedicated fetch', () => {
  const source = resolvePublicSource({ id: 'entra', name: 'Microsoft Entra ID', sourceType: 'limited-microsoft', url: 'https://status.cloud.microsoft/api/' });
  assert.equal(source.mode, 'azure-status-html');
  assert.equal(source.url, 'https://azure.status.microsoft/en-us/status');
  assert.equal(source.discoverFeeds, false);
  assert.equal(source.timeoutMs, 20000);
  assert.equal(source.maxResponseBytes, 10 * 1024 * 1024);
});

test('Entra parser uses only the Americas row and ignores neighboring services and non-US zones', () => {
  const parsed = extractAzureEntraAmericasRow(azureFixture());
  assert.ok(parsed);
  assert.deepEqual(parsed.relevant.map(item => item.region), ['*Non-Regional', 'East US', 'West US']);
  assert.deepEqual(parsed.relevant.map(item => item.status), ['Good', 'Good', 'Not available']);

  const conclusion = parseAzureEntraStatus(azureFixture());
  assert.equal(conclusion.kind, 'healthy');
  assert.match(conclusion.status, /Good across currently reported US scope/);
  assert.equal(conclusion.components.some(item => /Canada/i.test(item.name)), false);
});

test('Entra parser preserves current US degradation from the official row', () => {
  const conclusion = parseAzureEntraStatus(azureFixture({ eastUs: 'Warning', europe: 'Good' }));
  assert.equal(conclusion.kind, 'component-state');
  assert.equal(conclusion.color, 'amber');
  assert.match(conclusion.message, /East US: Warning/);
});

test('Entra parser preserves current US critical state from the official row', () => {
  const conclusion = parseAzureEntraStatus(azureFixture({ nonRegional: 'Critical', eastUs: 'Good' }));
  assert.equal(conclusion.kind, 'component-state');
  assert.equal(conclusion.color, 'red');
  assert.match(conclusion.message, /Non-Regional: Critical/);
});

test('Entra parser fails closed when the Americas Entra row is absent', () => {
  const conclusion = parseAzureEntraStatus('<table data-zone-name="americas"><tr><td>Azure Storage</td><td><span data-label="Good"></span></td></tr></table>');
  assert.equal(conclusion.kind, 'limited');
  assert.match(conclusion.message, /did not expose a readable Microsoft Entra ID row/i);
});

test('Entra provider collection uses one current page request and never probes the slow RSS feed', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    return new Response(azureFixture(), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
  };
  try {
    const result = await loadPublicProvider({
      id: 'entra',
      name: 'Microsoft Entra ID',
      category: 'Identity',
      priority: 125,
      sourceType: 'azure-status-html',
      url: 'https://azure.status.microsoft/en-us/status'
    });
    assert.equal(result.source_state, 'available');
    assert.equal(result.service_state, 'operational');
    assert.equal(result.ok, true);
    assert.equal(result.source_type, 'azure-status-html');
    assert.equal(result.download_log.length, 1);
    assert.deepEqual(urls, ['https://azure.status.microsoft/en-us/status']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Entra dedicated fetch stays bounded and fails closed on an oversized page', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('too large', {
    status: 200,
    headers: {
      'content-type': 'text/html',
      'content-length': String(10 * 1024 * 1024 + 1)
    }
  });
  try {
    const result = await loadPublicProvider({
      id: 'entra',
      name: 'Microsoft Entra ID',
      category: 'Identity',
      priority: 125,
      sourceType: 'azure-status-html',
      url: 'https://azure.status.microsoft/en-us/status'
    });
    assert.equal(result.source_state, 'unavailable');
    assert.equal(result.service_state, 'unknown');
    assert.equal(result.ok, false);
    assert.match(result.message, /exceeded/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
