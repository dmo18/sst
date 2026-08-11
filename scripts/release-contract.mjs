function average(values) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

export function verifyReleaseContract(payload, now = Date.now(), expectedCatalogHash = '') {
  const summary = payload?.summary || {};
  const collection = payload?.collection || {};
  const providers = Array.isArray(payload?.providers) ? payload.providers : [];
  const total = Number(summary.provider_total);
  const valid = Number(summary.valid_status_count);
  const invalid = Number(summary.invalid_status_count);
  const validPercent = Number(summary.valid_status_percent);
  const coverage = Number(summary.coverage_percent);
  const liveSourceCoverage = Number(summary.live_source_coverage_percent);
  const liveSourceCount = Number(summary.live_source_count);
  const fallbackCount = Number(summary.fallback_source_count);
  const generatedAt = Date.parse(payload?.generated_at || '');
  const generatedAgeMs = now - generatedAt;
  const calculatedLiveCount = providers.filter(provider => provider.source_state === 'available' && provider.ok === true).length;
  const calculatedCoverage = total > 0 ? Math.round(calculatedLiveCount / total * 100) : 0;
  const calculatedHealthy = providers.filter(provider => provider.source_health === 'healthy').length;
  const calculatedWatch = providers.filter(provider => provider.source_health === 'watch').length;
  const calculatedBlind = providers.filter(provider => provider.source_health === 'blind').length;
  const calculatedRequests = providers.reduce((sum, provider) => sum + Number(provider.collection_attempt_count || 0), 0);
  const calculatedSuccesses = providers.reduce((sum, provider) => sum + Number(provider.collection_success_count || 0), 0);
  const calculatedFailures = providers.reduce((sum, provider) => sum + Number(provider.collection_failure_count || 0), 0);
  const qualityValues = providers.map(provider => Number(provider.data_quality_score)).filter(Number.isFinite);
  const calculatedQuality = average(qualityValues);
  const invalidProviders = providers.filter(provider =>
    ['unavailable', 'pending', 'disabled'].includes(provider.source_state)
    || provider.status_data_valid !== true
  );
  const dishonestFallbacks = providers.filter(provider =>
    provider.status_data_basis === 'limited-fallback' && provider.ok === true
  );

  if (payload?.schema_version !== 3 || payload?.contract_version !== 3) throw new Error(`unexpected Status Contract envelope schema=${payload?.schema_version || 'missing'} contract=${payload?.contract_version || 'missing'}`);
  if (expectedCatalogHash && payload?.catalog_hash !== expectedCatalogHash) throw new Error(`provider catalog hash mismatch: ${payload?.catalog_hash || 'missing'}`);
  if (!Number.isFinite(generatedAt)) throw new Error('generated_at is invalid');
  if (generatedAgeMs < -300000 || generatedAgeMs > 300000) throw new Error(`generated_at is not fresh: age ${Math.round(generatedAgeMs / 1000)} seconds`);
  if (!Number.isFinite(total) || total <= 0) throw new Error('provider_total is invalid');
  if (valid !== total) throw new Error(`valid_status_count ${valid} does not equal provider_total ${total}`);
  if (invalid !== 0) throw new Error(`invalid_status_count must be zero, received ${invalid}`);
  if (validPercent !== 100) throw new Error(`valid_status_percent must be 100, received ${validPercent}`);
  if (liveSourceCount !== calculatedLiveCount) throw new Error(`live_source_count ${liveSourceCount} does not equal calculated ${calculatedLiveCount}`);
  if (coverage !== calculatedCoverage || liveSourceCoverage !== calculatedCoverage) throw new Error(`live coverage does not reconcile to ${calculatedCoverage}%`);
  if (!Number.isFinite(fallbackCount) || fallbackCount < 0) throw new Error(`fallback_source_count is invalid: ${fallbackCount}`);
  if (invalidProviders.length) throw new Error(`Invalid provider status records: ${invalidProviders.map(provider => provider.id).join(', ')}`);
  if (dishonestFallbacks.length) throw new Error(`Fallback records marked successful: ${dishonestFallbacks.map(provider => provider.id).join(', ')}`);
  if (collection.pipeline_version !== '3.0.0') throw new Error(`unexpected collection pipeline ${collection.pipeline_version || 'missing'}`);
  if (collection.provider_count !== total) throw new Error('collection provider count mismatch');
  if (collection.healthy_source_count !== calculatedHealthy || collection.watch_source_count !== calculatedWatch || collection.blind_spot_count !== calculatedBlind) throw new Error('collection source-health counts do not reconcile');
  if (calculatedHealthy + calculatedWatch + calculatedBlind !== total) throw new Error('provider source-health distribution does not cover the catalog');
  if (collection.request_count !== calculatedRequests || collection.successful_request_count !== calculatedSuccesses || collection.failed_request_count !== calculatedFailures) throw new Error('collection request counts do not reconcile');
  if (collection.request_count !== collection.successful_request_count + collection.failed_request_count) throw new Error('collection request total is inconsistent');
  if (collection.quality_score !== calculatedQuality || calculatedQuality < 0 || calculatedQuality > 100) throw new Error(`collection quality does not reconcile to ${calculatedQuality}`);
  if (!Number.isFinite(collection.origin_count) || collection.origin_count <= 0) throw new Error('collection origin_count is invalid');
  if (!Number.isFinite(collection.duration_ms) || collection.duration_ms < 0) throw new Error('collection duration_ms is invalid');

  const description = `${liveSourceCount}/${total} live (${coverage}%); quality ${collection.quality_score}; ${collection.blind_spot_count} blind`;
  const state = liveSourceCount === total && calculatedBlind === 0 && fallbackCount === 0 ? 'success' : 'failure';
  return { description, state, calculatedLiveCount, calculatedCoverage, calculatedQuality };
}