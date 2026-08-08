import fs from 'node:fs';

function replaceExact(path, before, after, label) {
  const current = fs.readFileSync(path, 'utf8');
  if (!current.includes(before)) throw new Error(`Missing ${label} in ${path}`);
  const next = current.replace(before, after);
  if (next === current) throw new Error(`No change for ${label} in ${path}`);
  fs.writeFileSync(path, next);
}

function appendBefore(path, marker, insertion, label) {
  replaceExact(path, marker, `${insertion}${marker}`, label);
}

replaceExact(
  'scripts/full-review-source-adapters.mjs',
  "  backblaze: {\n    mode: 'firehydrant-json',\n    url: 'https://status.backblaze.com/data/payload.json',\n    pageUrl: 'https://status.backblaze.com/',\n    feedCandidates: ['https://status.backblaze.com/data/rss.xml'],\n    sourceName: 'Backblaze official FireHydrant payload',\n    regionScope: 'us'\n  }\n};",
  "  backblaze: {\n    mode: 'firehydrant-json',\n    url: 'https://status.backblaze.com/data/payload.json',\n    pageUrl: 'https://status.backblaze.com/',\n    feedCandidates: ['https://status.backblaze.com/data/rss.xml'],\n    sourceName: 'Backblaze official FireHydrant payload',\n    regionScope: 'us'\n  },\n  crowdstrike: {\n    mode: 'status-access-reference',\n    url: 'https://www.crowdstrike.com/en-us/contact-us/',\n    pageUrl: 'https://supportportal.crowdstrike.com/',\n    sourceName: 'CrowdStrike official support access page',\n    healthAccess: 'authenticated',\n    regionScope: 'us'\n  },\n  intermedia: {\n    mode: 'status-access-reference',\n    url: 'https://support.intermedia.com/',\n    pageUrl: 'https://cp.intermedia.net/ControlPanel/Login?ClientType=ControlPanel',\n    sourceName: 'Intermedia official system-status access page',\n    healthAccess: 'authenticated',\n    regionScope: 'us'\n  }\n};",
  'auth-gated source overrides'
);

appendBefore(
  'scripts/full-review-source-adapters.mjs',
  'export function fullReviewConclusion(provider, value) {',
  `export function parseAuthenticatedStatusReference(value, provider = {}) {\n  const text = clean(value);\n  if (provider.id === 'crowdstrike') {\n    const confirmsPortal = /Log in to the CrowdStrike Support portal/i.test(text);\n    const confirmsAlerts = /subscribe to Tech Alerts/i.test(text);\n    if (!confirmsPortal || !confirmsAlerts) return null;\n    return {\n      kind: 'access-gated',\n      status: 'Current CrowdStrike service notices require authenticated Support Portal access',\n      message: 'CrowdStrike confirms that technical support and Tech Alerts are delivered through its authenticated Support Portal. The public source confirms the current official access path; no Falcon operational conclusion is inferred from the public page.'\n    };\n  }\n  if (provider.id === 'intermedia') {\n    const confirmsStatus = /System Status/i.test(text);\n    const confirmsLogin = /status dashboard can be seen on the homepage of your control panel when you log in/i.test(text);\n    if (!confirmsStatus || !confirmsLogin) return null;\n    return {\n      kind: 'access-gated',\n      status: 'Current Intermedia system status requires authenticated HostPilot access',\n      message: 'Intermedia confirms that its system-status dashboard is displayed after logging in to HostPilot. The public support page confirms the current official access path; no Intermedia operational conclusion is inferred from the public page.'\n    };\n  }\n  return null;\n}\n\n`,
  'auth-gated source parser'
);

replaceExact(
  'scripts/full-review-source-adapters.mjs',
  "  if (provider.id === 'proofpoint') return parseProofpointCurrentIncidents(value, provider);\n  if (provider.id === 'backblaze') return parseFireHydrantPayload(value, provider, source);\n  return null;",
  "  if (provider.id === 'proofpoint') return parseProofpointCurrentIncidents(value, provider);\n  if (provider.id === 'backblaze') return parseFireHydrantPayload(value, provider, source);\n  if (provider.id === 'crowdstrike' || provider.id === 'intermedia') return parseAuthenticatedStatusReference(value, provider);\n  return null;",
  'auth-gated conclusion dispatch'
);

replaceExact(
  'scripts/update-public-status.mjs',
  'async function parsePublicFeed(provider, source) {',
  'export async function parsePublicFeed(provider, source) {',
  'public feed test export'
);

replaceExact(
  'scripts/update-public-status.mjs',
  "    component_status: extras.components || [],\n    schema_fingerprint: extras.schemaFingerprint || '',\n    ...sourceEvidence(source.mode, resolvedSourceState, ok)",
  "    component_status: extras.components || [],\n    schema_fingerprint: extras.schemaFingerprint || '',\n    ...(extras.healthAccess ? { health_access: extras.healthAccess } : {}),\n    ...(typeof extras.healthObservable === 'boolean' ? { health_observable: extras.healthObservable } : {}),\n    ...sourceEvidence(source.mode, resolvedSourceState, ok)",
  'provider access metadata'
);

replaceExact(
  'scripts/update-public-status.mjs',
  "  if (conclusion.kind === 'healthy') return providerStatus(provider, source, conclusion.status || `${provider.name} reports normal service`, 'green', true, '', logs, [], maintenance, undefined, extras);\n",
  "  if (conclusion.kind === 'access-gated') return providerStatus(provider, source, conclusion.status || `${provider.name} current health requires authenticated vendor access`, 'blue', true, conclusion.message || 'The public source confirms the official authenticated status channel. No operational conclusion was inferred.', logs, [], maintenance, 'available', { ...extras, healthAccess: 'authenticated', healthObservable: false });\n  if (conclusion.kind === 'healthy') return providerStatus(provider, source, conclusion.status || `${provider.name} reports normal service`, 'green', true, '', logs, [], maintenance, undefined, extras);\n",
  'access-gated result mapping'
);

replaceExact(
  'scripts/collection-intelligence.mjs',
  "  const blind = enrichedProviders.filter(provider => provider.source_health === 'blind').length;\n  const requestCount = allLogs.length;",
  "  const blind = enrichedProviders.filter(provider => provider.source_health === 'blind').length;\n  const authGated = enrichedProviders.filter(provider => provider.health_access === 'authenticated').length;\n  const publiclyObservable = enrichedProviders.length - authGated;\n  const requestCount = allLogs.length;",
  'collection access counts'
);

replaceExact(
  'scripts/collection-intelligence.mjs',
  "      blind_spot_count: blind,\n      average_data_quality_score: qualityScore,",
  "      blind_spot_count: blind,\n      auth_gated_provider_count: authGated,\n      public_health_source_count: publiclyObservable,\n      average_data_quality_score: qualityScore,",
  'summary access counts'
);

replaceExact(
  'scripts/collection-intelligence.mjs',
  "      blind_spot_count: blind\n    }\n  };",
  "      blind_spot_count: blind,\n      auth_gated_provider_count: authGated,\n      public_health_source_count: publiclyObservable\n    }\n  };",
  'collection run access counts'
);

replaceExact(
  'scripts/ensure-valid-status.mjs',
  "  const quality = providers.map(provider => Number(provider.data_quality_score)).filter(Number.isFinite);\n  return {",
  "  const quality = providers.map(provider => Number(provider.data_quality_score)).filter(Number.isFinite);\n  const authGated = providers.filter(provider => provider.health_access === 'authenticated').length;\n  return {",
  'normalizer auth count'
);

replaceExact(
  'scripts/ensure-valid-status.mjs',
  "    blind_spot_count: providers.filter(provider => provider.source_health === 'blind').length,\n    average_data_quality_score: average(quality),",
  "    blind_spot_count: providers.filter(provider => provider.source_health === 'blind').length,\n    auth_gated_provider_count: authGated,\n    public_health_source_count: providers.length - authGated,\n    average_data_quality_score: average(quality),",
  'normalized summary access counts'
);

replaceExact(
  'scripts/ensure-valid-status.mjs',
  "      coverage_definition: 'coverage_percent and live_source_coverage_percent are the percentage of providers with a successfully captured current official source. Limited, stale, and fallback records do not count as coverage.',",
  "      coverage_definition: 'coverage_percent and live_source_coverage_percent are the percentage of providers with a successfully captured current official source or current official status-access channel. Limited, stale, and fallback records do not count as coverage. Providers whose current health is vendor-authenticated remain service_state unknown and are counted separately by auth_gated_provider_count; they are never operational confirmation.',",
  'coverage policy access semantics'
);

replaceExact(
  'src/types.ts',
  "  problem_component_count?: number;\n}",
  "  problem_component_count?: number;\n  health_access?: 'public' | 'authenticated';\n  health_observable?: boolean;\n}",
  'provider access types'
);

replaceExact(
  'src/types.ts',
  "  blind_spot_count?: number;\n  average_data_quality_score?: number;",
  "  blind_spot_count?: number;\n  auth_gated_provider_count?: number;\n  public_health_source_count?: number;\n  average_data_quality_score?: number;",
  'summary access types'
);

replaceExact(
  'src/types.ts',
  "  blind_spot_count: number;\n}\n\nexport interface StatusPayload",
  "  blind_spot_count: number;\n  auth_gated_provider_count?: number;\n  public_health_source_count?: number;\n}\n\nexport interface StatusPayload",
  'collection access types'
);

replaceExact(
  'scripts/__tests__/provider-source-parity.test.js',
  "      ['backblaze', 'status-html', 'https://status.backblaze.com/', true],",
  "      ['backblaze', 'firehydrant-json', 'https://status.backblaze.com/data/payload.json', false],",
  'Backblaze source policy expectation'
);

replaceExact(
  'scripts/__tests__/update-public-status.test.js',
  "  loadPublicProvider,\n  parseFeedEntries,",
  "  loadPublicProvider,\n  parseFeedEntries,\n  parsePublicFeed,",
  'feed parser import'
);

replaceExact(
  'scripts/__tests__/update-public-status.test.js',
  "test('verified public source overrides use free first-party pages', () => {\n  for (const id of ['ringcentral', 'sophos', 'bitdefender-gravityzone', 'bitwarden', 'cove-data-protection', 'crashplan', 'fortinet', 'keeper', 'malwarebytes', 'superops', 'syncro', 'kaseya', 'okta', 'salesforce', 'zendesk', 'backblaze']) {\n    const source = additionalPublicOverrides[id];\n    assert.ok(source);\n    assert.equal(source.mode, id === 'superops' ? 'betterstack-json' : 'status-html');\n    assert.match(source.url, /^https:\\/\\//);\n  }\n  assert.equal(additionalPublicOverrides.kaseya.regionScope, 'us');\n  assert.equal(additionalPublicOverrides.okta.regionScope, 'us');\n});",
  "test('verified public source overrides use current first-party sources', () => {\n  const expectedModes = {\n    ringcentral: 'status-html',\n    sophos: 'status-html',\n    'bitdefender-gravityzone': 'status-html',\n    bitwarden: 'status-html',\n    'cove-data-protection': 'status-html',\n    crashplan: 'status-html',\n    fortinet: 'status-html',\n    keeper: 'status-html',\n    malwarebytes: 'status-html',\n    superops: 'betterstack-json',\n    syncro: 'status-html',\n    kaseya: 'statuspage-json',\n    okta: 'status-html',\n    salesforce: 'status-html',\n    zendesk: 'status-html',\n    backblaze: 'firehydrant-json',\n    proofpoint: 'status-html',\n    '8x8': 'statuscast-json',\n    lastpass: 'statuspage-json',\n    crowdstrike: 'status-access-reference',\n    intermedia: 'status-access-reference'\n  };\n  for (const [id, expectedMode] of Object.entries(expectedModes)) {\n    const source = additionalPublicOverrides[id];\n    assert.ok(source);\n    assert.equal(source.mode, expectedMode);\n    assert.match(source.url, /^https:\\/\\//);\n  }\n  assert.equal(additionalPublicOverrides.kaseya.regionScope, 'us');\n  assert.equal(additionalPublicOverrides.okta.regionScope, 'us');\n  assert.equal(additionalPublicOverrides.crowdstrike.healthAccess, 'authenticated');\n  assert.equal(additionalPublicOverrides.intermedia.healthAccess, 'authenticated');\n});",
  'public source override expectations'
);

replaceExact(
  'scripts/__tests__/update-public-status.test.js',
  "  const result = await loadPublicProvider({\n    id: 'kaseya',\n    name: 'Kaseya',\n    category: 'MSP Platforms',\n    priority: 86,\n    services: ['Autotask PSA', 'Datto RMM'],\n    sourceType: 'statuspage',\n    url: 'https://status.kaseya.com/api/v2/summary.json'\n  });",
  "  const provider = {\n    id: 'kaseya',\n    name: 'Kaseya',\n    category: 'MSP Platforms',\n    priority: 86,\n    services: ['Autotask PSA', 'Datto RMM'],\n    sourceType: 'statuspage',\n    url: 'https://status.kaseya.com/api/v2/summary.json'\n  };\n  const result = await parsePublicFeed(provider, {\n    mode: 'feed',\n    url: 'https://status.kaseya.com/history.rss',\n    pageUrl: 'https://status.kaseya.com/',\n    sourceName: 'Kaseya public status RSS regression fixture',\n    maxAgeHours: 168,\n    regionScope: 'us'\n  });",
  'Kaseya feed regression test isolation'
);

replaceExact(
  'scripts/__tests__/full-review-source-adapters.test.js',
  "  assert.equal(result.kind, 'issues');\n  assert.equal(result.incidents.length, 1);\n  assert.match(result.incidents[0].title, /Datto SaaS Protection/);",
  "  assert.equal(result.kind, 'component-state');\n  assert.match(result.status, /Partially Degraded Service/);\n  assert.match(result.message, /Datto SaaS Protection Backups/);",
  'Kaseya structured degradation expectation'
);

appendBefore(
  'scripts/__tests__/full-review-source-adapters.test.js',
  "test('Proofpoint rendered current-incidents page accepts explicit no-current state'",
  `test('authenticated vendor health channels are live official references without false operational conclusions', () => {\n  const crowdstrike = fullReviewConclusion({ id: 'crowdstrike', name: 'CrowdStrike' }, '<main>Log in to the CrowdStrike Support portal to create and manage your support cases, subscribe to Tech Alerts and Release notes, and access our knowledge base.</main>');\n  assert.equal(crowdstrike.kind, 'access-gated');\n  assert.match(crowdstrike.status, /authenticated Support Portal access/i);\n\n  const intermedia = fullReviewConclusion({ id: 'intermedia', name: 'Intermedia' }, '<main><h2>System Status</h2><p>Intermedia\\'s status dashboard can be seen on the homepage of your control panel when you log in.</p></main>');\n  assert.equal(intermedia.kind, 'access-gated');\n  assert.match(intermedia.status, /authenticated HostPilot access/i);\n});\n\n`,
  'auth-gated adapter tests'
);

console.log('Applied full-review compatibility and access-channel patch.');
