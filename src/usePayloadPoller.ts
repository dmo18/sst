import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { dataLifecycleReducer, initialDataLifecycle } from './dataLifecycle';
import { applyBrowserLiveTruth } from './liveStatusTruth';
import { ACTIVE_PROVIDER_CATALOG_HASH, ACTIVE_PROVIDER_IDS } from './providerCatalog';
import { RequestOwnership } from './requestOwnership';
import type { StatusPayload } from './types';
import { wirePayloadValidationErrors } from './wirePayloadValidation';

type StatusFetchResult = {
  data: StatusPayload;
  freshnessWarning: string | null;
};

const MAX_PAYLOAD_AGE_MS = 20 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_BROWSER_PAYLOAD_BYTES = 5 * 1024 * 1024;
const EMERGENCY_MAINTENANCE = /\b(?:emergency|unplanned|critical|urgent)\b/i;
const PRODUCTION_IMPACT = /\b(?:production|outage|service interruption|service disruption|customer impact|customers? (?:are|may be) affected|degraded service)\b/i;

export function operationalPayload(payload: StatusPayload): StatusPayload {
  const emergencyMaintenance = (payload.maintenance || []).filter(item => {
    const text = `${item.title || ''} ${item.note || ''} ${item.status || ''}`;
    return item.status === 'in_progress' && EMERGENCY_MAINTENANCE.test(text) && PRODUCTION_IMPACT.test(text);
  });
  const maintenanceCount = new Map<string, number>();
  for (const item of emergencyMaintenance)
    maintenanceCount.set(item.providerId, (maintenanceCount.get(item.providerId) || 0) + 1);
  const isMaintenanceChange = (type: string) => /maintenance/i.test(type);

  return {
    ...payload,
    summary: {
      ...payload.summary,
      maintenance_count: emergencyMaintenance.length,
      ongoing_maintenance_count: emergencyMaintenance.filter(item => item.status === 'in_progress').length
    },
    maintenance: emergencyMaintenance,
    providers: payload.providers.map(provider => ({
      ...provider,
      maintenance_count: maintenanceCount.get(provider.id) || 0
    })),
    changes: payload.changes.filter(change => !isMaintenanceChange(change.type)),
    history: payload.history.filter(change => !isMaintenanceChange(change.type))
  };
}

async function fetchStatus(signal: AbortSignal): Promise<StatusFetchResult> {
  const response = await fetch(`${import.meta.env.BASE_URL}status.json?ts=${Date.now()}`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`status.json returned HTTP ${response.status}`);
  const declaredBytes = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredBytes) && declaredBytes > MAX_BROWSER_PAYLOAD_BYTES)
    throw new Error(`status.json exceeds the ${MAX_BROWSER_PAYLOAD_BYTES} byte browser payload limit`);
  const body = await response.text();
  const actualBytes = new TextEncoder().encode(body).byteLength;
  if (actualBytes > MAX_BROWSER_PAYLOAD_BYTES)
    throw new Error(`status.json exceeds the ${MAX_BROWSER_PAYLOAD_BYTES} byte browser payload limit`);
  const data: unknown = JSON.parse(body);
  const errors = wirePayloadValidationErrors(data, ACTIVE_PROVIDER_IDS, ACTIVE_PROVIDER_CATALOG_HASH);
  if (errors.length) {
    console.error('status.json validation failed:', errors);
    throw new Error(`status.json has an invalid or unsupported payload (${errors.join('; ')})`);
  }
  const payload = operationalPayload(data as StatusPayload);
  const generatedAt = Date.parse(payload.generated_at || '');
  const payloadAgeMs = Date.now() - generatedAt;
  if (!Number.isFinite(generatedAt)) throw new Error('status.json generated_at is invalid');
  if (payloadAgeMs < -MAX_FUTURE_SKEW_MS) throw new Error('status.json was generated too far in the future');
  const freshnessWarning = payloadAgeMs > MAX_PAYLOAD_AGE_MS
    ? `status.json is stale (${Math.round(payloadAgeMs / 60000)} minutes old; maximum 20 minutes)`
    : null;
  return { data: payload, freshnessWarning };
}

export function usePayloadPoller(browserRefreshMs: number) {
  const [state, dispatch] = useReducer(dataLifecycleReducer, initialDataLifecycle);
  const [lastBrowserCheckAt, setLastBrowserCheckAt] = useState<number | null>(null);
  const lastBrowserCheckAtRef = useRef<number | null>(null);
  const payloadOwnership = useRef(new RequestOwnership());
  const liveTruthOwnership = useRef(new RequestOwnership());
  const mounted = useRef(true);

  const overlayLiveTruth = useCallback((payload: StatusPayload) => {
    liveTruthOwnership.current.cancel();
    const slot = liveTruthOwnership.current.begin();
    if (!slot) return;
    const { controller, sequence } = slot;

    void applyBrowserLiveTruth(payload, controller.signal)
      .then(livePayload => {
        if (mounted.current && liveTruthOwnership.current.owns(controller, sequence))
          dispatch({ type: 'overlay', data: livePayload });
      })
      .catch(error => {
        if (!controller.signal.aborted)
          console.warn('Browser live truth overlay failed; retaining audited static payload.', error);
      })
      .finally(() => liveTruthOwnership.current.finish(controller));
  }, []);

  const refresh = useCallback(async () => {
    const slot = payloadOwnership.current.begin();
    if (!slot) return;
    const { controller: request, sequence } = slot;
    dispatch({ type: 'request' });
    try {
      const result = await fetchStatus(request.signal);
      if (mounted.current && payloadOwnership.current.owns(request, sequence)) {
        const checkedAt = Date.now();
        // Render the validated audited payload immediately. Live first-party checks run independently and
        // may replace only providers they successfully observe, so a slow CORS origin never blocks the UI.
        dispatch({ type: 'success', data: result.data });
        lastBrowserCheckAtRef.current = checkedAt;
        setLastBrowserCheckAt(checkedAt);
        if (result.freshnessWarning) dispatch({ type: 'failure', message: result.freshnessWarning });
        overlayLiveTruth(result.data);
      }
    } catch (error) {
      if (mounted.current && payloadOwnership.current.owns(request, sequence))
        dispatch({ type: 'failure', message: error instanceof Error ? error.message : String(error) });
    } finally {
      payloadOwnership.current.finish(request);
    }
  }, [overlayLiveTruth]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const id = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, browserRefreshMs);
    const refreshWhenVisible = () => {
      if (document.hidden) return;
      const lastCheckedAt = lastBrowserCheckAtRef.current;
      if (lastCheckedAt === null || Date.now() - lastCheckedAt >= browserRefreshMs) void refresh();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      payloadOwnership.current.cancel();
      liveTruthOwnership.current.cancel();
    };
  }, [browserRefreshMs, refresh]);

  return { state, lastBrowserCheckAt, refresh };
}
