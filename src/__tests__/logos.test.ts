import test from 'node:test';
import assert from 'node:assert/strict';
import { generatedProviderIcon, hasBrandedProviderIcon, providerIconSrc } from '../logos.ts';

test('known providers use bundled branded assets', () => {
  assert.equal(hasBrandedProviderIcon('microsoft365'), true);
  assert.match(providerIconSrc('microsoft365', 'Microsoft 365'), /assets\/logos\/microsoft365\.svg$/);
});

test('all other providers receive deterministic generated icons', () => {
  const first = generatedProviderIcon('sentinelone', 'SentinelOne');
  const second = generatedProviderIcon('sentinelone', 'SentinelOne');
  assert.equal(first, second);
  assert.match(first, /^data:image\/svg\+xml,/);
  assert.match(decodeURIComponent(first), />SE<\/text>/);
});

test('generated icons differ between providers', () => {
  assert.notEqual(
    generatedProviderIcon('ninjaone', 'NinjaOne'),
    generatedProviderIcon('halopsa', 'HaloPSA')
  );
});

test('multi-word provider names use readable initials', () => {
  const icon = decodeURIComponent(generatedProviderIcon('google-workspace', 'Google Workspace'));
  assert.match(icon, />GW<\/text>/);
});
