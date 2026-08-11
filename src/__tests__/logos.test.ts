import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ACTIVE_PROVIDER_CATALOG } from '../providerCatalog.ts';
import {
  curatedProviderIdentity,
  generatedProviderIcon,
  hasBrandedProviderIcon,
  providerIconFallback,
  providerIconPresentation,
  providerIconSrc
} from '../logos.ts';

const exactAssets = [
  ['microsoft365', 'microsoft365.svg'],
  ['github', 'github.svg'],
  ['digitalocean', 'digitalocean.svg'],
  ['okta', 'okta.svg'],
  ['dropbox', 'dropbox.svg'],
  ['1password', '1password.svg'],
  ['auth0', 'auth0.svg'],
  ['bitwarden', 'bitwarden.svg'],
  ['docker', 'docker.svg'],
  ['stripe', 'stripe.svg'],
  ['paypal', 'paypal.svg'],
  ['shopify', 'shopify.svg'],
  ['fortinet', 'fortinet.svg'],
  ['quickbooks-online', 'quickbooks.svg'],
  ['ubiquiti', 'ubiquiti.svg'],
  ['lumen', 'lumen.svg'],
  ['wasabi', 'wasabi.svg'],
  ['bitdefender-gravityzone', 'bitdefender.svg'],
  ['elastic-cloud', 'elastic.svg']
] as const;

test('known providers use bundled local branded assets', () => {
  for (const [providerId, file] of exactAssets) {
    assert.equal(hasBrandedProviderIcon(providerId), true, `${providerId} must use a bundled branded asset`);
    assert.match(providerIconSrc(providerId, providerId), new RegExp(`assets/logos/${file.replace('.', '\\.')}$`));
    assert.equal(existsSync(new URL(`../../public/assets/logos/${file}`, import.meta.url)), true, `${file} must exist`);
    assert.equal(providerIconPresentation(providerId).generated, false, `${providerId} must not regress to a generated tile`);
  }
});

test('Cisco-family providers intentionally share the recognizable Cisco mark', () => {
  for (const id of ['meraki', 'duo', 'cisco-umbrella']) {
    assert.match(providerIconSrc(id, id), /assets\/logos\/cisco\.svg$/);
    const presentation = providerIconPresentation(id);
    assert.equal(presentation.monochrome, true);
    assert.equal(presentation.accent, '#1ba0d7');
  }
});

test('curated niche provider marks are deterministic and provider-specific', () => {
  const sentinel = decodeURIComponent(generatedProviderIcon('sentinelone', 'SentinelOne'));
  const kaseya = decodeURIComponent(generatedProviderIcon('kaseya', 'Kaseya'));
  const nuso = decodeURIComponent(generatedProviderIcon('nuso', 'NUSO'));
  assert.match(sentinel, />S1<\/text>/);
  assert.match(kaseya, />K<\/text>/);
  assert.match(nuso, />NUSO<\/text>/);
  assert.notEqual(sentinel, kaseya);
  assert.equal(generatedProviderIcon('nuso', 'NUSO'), generatedProviderIcon('nuso', 'NUSO'));
});

test('every active provider has a curated recognition identity', () => {
  const missing = ACTIVE_PROVIDER_CATALOG.filter(provider => !curatedProviderIdentity(provider.id)).map(provider => provider.id);
  assert.deepEqual(missing, []);
  assert.equal(ACTIVE_PROVIDER_CATALOG.length, 80);
});

test('true unknown-provider fallback remains local and deterministic', () => {
  const first = generatedProviderIcon('unknown-vendor', 'Unknown Vendor');
  const second = providerIconFallback('unknown-vendor', 'Unknown Vendor');
  assert.equal(first, second);
  assert.match(first, /^data:image\/svg\+xml,/);
  assert.match(decodeURIComponent(first), />UV<\/text>/);
});
