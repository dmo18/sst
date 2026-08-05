import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import providerCatalog from '../config/providers.json';
import providerConsolidation from '../config/provider-consolidation.json';
import packageMetadata from '../package.json';
import { dataLifecycleReducer, initialDataLifecycle } from './dataLifecycle';
import { IssueConsole } from './IssueConsole';
import { WallboardV2 } from './WallboardV2';
import { buildIssueConsoleModel } from './statusViewModel';
import { payloadValidationErrors } from './payloadValidation';
import { RequestOwnership } from './requestOwnership';
import type { ProviderConfig, StatusPayload } from './types';

type ProviderConsolidation = {
    excludedProviderIds: string[];
    providerOverrides: Record<string, Partial<ProviderConfig>>;
};

type StatusFetchResult = {
    data: StatusPayload;
    freshnessWarning: string | null;
};

const CONSOLIDATION = providerConsolidation as ProviderConsolidation;
const EXCLUDED_PROVIDER_IDS = new Set(CONSOLIDATION.excludedProviderIds);
const CATALOG = (providerCatalog as ProviderConfig[])
    .filter(provider => !EXCLUDED_PROVIDER_IDS.has(provider.id))
    .map(provider => ({ ...provider, ...(CONSOLIDATION.providerOverrides[provider.id] || {}) }));
const REFRESH_MS = 60000;
const MAX_PAYLOAD_AGE_MS = 20 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const EMERGENCY_MAINTENANCE = /\b(?:emergency|unplanned|critical|urgent)\b/i;
const PRODUCTION_IMPACT = /\b(?:production|outage|service interruption|service disruption|customer impact|customers? (?:are|may be) affected|degraded service)\b/i;

function operationalPayload(payload: StatusPayload): StatusPayload {
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
    if (!response.ok)
        throw new Error(`status.json returned HTTP ${response.status}`);
    const data: unknown = await response.json();
    const errors = payloadValidationErrors(data);
    if (errors.length) {
        console.error('status.json validation failed:', errors);
        throw new Error(`status.json has an invalid or unsupported payload (${errors.join('; ')})`);
    }
    const payload = operationalPayload(data as StatusPayload);
    const generatedAt = Date.parse(payload.generated_at || '');
    const payloadAgeMs = Date.now() - generatedAt;
    if (!Number.isFinite(generatedAt))
        throw new Error('status.json generated_at is invalid');
    if (payloadAgeMs < -MAX_FUTURE_SKEW_MS)
        throw new Error('status.json was generated too far in the future');
    const freshnessWarning = payloadAgeMs > MAX_PAYLOAD_AGE_MS
        ? `status.json is stale (${Math.round(payloadAgeMs / 60000)} minutes old; maximum 20 minutes)`
        : null;
    return { data: payload, freshnessWarning };
}

function isWallboardRoute(): boolean {
    return new URLSearchParams(location.search).get('view') === 'wallboard';
}

export function App(): JSX.Element {
    const [state, dispatch] = useReducer(dataLifecycleReducer, initialDataLifecycle);
    const [wallboardMode, setWallboardMode] = useState(isWallboardRoute);
    const [now, setNow] = useState(() => Date.now());
    const ownership = useRef(new RequestOwnership());
    const mounted = useRef(true);

    const refresh = useCallback(async () => {
        const slot = ownership.current.begin();
        if (!slot)
            return;
        const { controller: request, sequence } = slot;
        dispatch({ type: 'request' });
        try {
            const result = await fetchStatus(request.signal);
            if (mounted.current && ownership.current.owns(request, sequence)) {
                dispatch({ type: 'success', data: result.data });
                window.dispatchEvent(new CustomEvent('sst:browser-check', {
                    detail: { checkedAt: Date.now(), generatedAt: result.data.generated_at }
                }));
                if (result.freshnessWarning)
                    dispatch({ type: 'failure', message: result.freshnessWarning });
            }
        }
        catch (error) {
            if (mounted.current && ownership.current.owns(request, sequence))
                dispatch({ type: 'failure', message: error instanceof Error ? error.message : String(error) });
        }
        finally {
            ownership.current.finish(request);
        }
    }, []);

    useEffect(() => {
        mounted.current = true;
        void refresh();
        const id = window.setInterval(() => { if (!document.hidden)
            void refresh(); }, REFRESH_MS);
        return () => { mounted.current = false; window.clearInterval(id); ownership.current.cancel(); };
    }, [refresh]);

    useEffect(() => {
        const tick = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(tick);
    }, []);

    useEffect(() => {
        const syncRoute = () => setWallboardMode(isWallboardRoute());
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function (...args: Parameters<History['pushState']>) {
            originalPushState.apply(this, args);
            syncRoute();
        };
        history.replaceState = function (...args: Parameters<History['replaceState']>) {
            originalReplaceState.apply(this, args);
            syncRoute();
        };
        window.addEventListener('popstate', syncRoute);

        return () => {
            history.pushState = originalPushState;
            history.replaceState = originalReplaceState;
            window.removeEventListener('popstate', syncRoute);
        };
    }, []);

    const model = useMemo(() => state.data ? buildIssueConsoleModel(state.data, `v${packageMetadata.version}`, CATALOG) : null, [state.data]);

    const exitWallboard = () => {
        const search = new URLSearchParams(location.search);
        search.delete('view');
        history.replaceState(null, '', `${location.pathname}${search.size ? `?${search}` : ''}${location.hash}`);
        setWallboardMode(false);
    };

    return (
        <main className="app-frame">
            {wallboardMode
                ? <WallboardV2 model={model} lifecycle={state} now={now} onExit={exitWallboard} />
                : <IssueConsole model={model} lifecycle={state} onRefresh={() => void refresh()} />}
        </main>
    );
}
