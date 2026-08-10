import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import packageMetadata from '../package.json';
import { dataLifecycleReducer, initialDataLifecycle } from './dataLifecycle';
import { IssueConsole } from './IssueConsole';
import { OperationsIntelligencePanel } from './OperationsIntelligencePanel';
import { payloadValidationErrors } from './payloadValidation';
import { ACTIVE_PROVIDER_CATALOG, ACTIVE_PROVIDER_IDS } from './providerCatalog';
import { RequestOwnership } from './requestOwnership';
import { buildIssueConsoleModel } from './statusViewModel';
import { WallboardV2 } from './WallboardV2';
import { readWallboardRoute } from './wallboardRoute';
import type { StatusPayload } from './types';

type StatusFetchResult = {
    data: StatusPayload;
    freshnessWarning: string | null;
};

const MAX_PAYLOAD_AGE_MS = 20 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_BROWSER_PAYLOAD_BYTES = 5 * 1024 * 1024;
const OPERATOR_BROWSER_REFRESH_MS = 60 * 1000;
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
    if (!response.ok)
        throw new Error(`status.json returned HTTP ${response.status}`);
    const declaredBytes = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_BROWSER_PAYLOAD_BYTES)
        throw new Error(`status.json exceeds the ${MAX_BROWSER_PAYLOAD_BYTES} byte browser payload limit`);
    const body = await response.text();
    const actualBytes = new TextEncoder().encode(body).byteLength;
    if (actualBytes > MAX_BROWSER_PAYLOAD_BYTES)
        throw new Error(`status.json exceeds the ${MAX_BROWSER_PAYLOAD_BYTES} byte browser payload limit`);
    const data: unknown = JSON.parse(body);
    const errors = payloadValidationErrors(data, ACTIVE_PROVIDER_IDS);
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

export function App(): JSX.Element {
    const [state, dispatch] = useReducer(dataLifecycleReducer, initialDataLifecycle);
    const [route, setRoute] = useState(() => readWallboardRoute(location.search));
    const [now, setNow] = useState(() => Date.now());
    const [lastBrowserCheckAt, setLastBrowserCheckAt] = useState<number | null>(null);
    const lastBrowserCheckAtRef = useRef<number | null>(null);
    const ownership = useRef(new RequestOwnership());
    const mounted = useRef(true);
    const browserRefreshMs = route.wallboardMode ? route.refreshIntervalMs : OPERATOR_BROWSER_REFRESH_MS;

    const refresh = useCallback(async () => {
        const slot = ownership.current.begin();
        if (!slot)
            return;
        const { controller: request, sequence } = slot;
        dispatch({ type: 'request' });
        try {
            const result = await fetchStatus(request.signal);
            if (mounted.current && ownership.current.owns(request, sequence)) {
                const checkedAt = Date.now();
                dispatch({ type: 'success', data: result.data });
                lastBrowserCheckAtRef.current = checkedAt;
                setLastBrowserCheckAt(checkedAt);
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
            ownership.current.cancel();
        };
    }, [browserRefreshMs, refresh]);

    useEffect(() => {
        const tick = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(tick);
    }, []);

    useEffect(() => {
        const syncRoute = () => setRoute(readWallboardRoute(location.search));
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

    const model = useMemo(() => state.data ? buildIssueConsoleModel(state.data, `v${packageMetadata.version}`, ACTIVE_PROVIDER_CATALOG) : null, [state.data]);

    const exitWallboard = () => {
        const search = new URLSearchParams(location.search);
        search.delete('view');
        history.replaceState(null, '', `${location.pathname}${search.size ? `?${search}` : ''}${location.hash}`);
    };

    return (
        <main className="app-frame">
            {route.wallboardMode
                ? <WallboardV2 model={model} lifecycle={state} now={now} browserCheckedAt={lastBrowserCheckAt} alertWindowMs={route.alertWindowMs} onExit={exitWallboard} />
                : <><IssueConsole model={model} lifecycle={state} onRefresh={() => void refresh()} browserCheckedAt={lastBrowserCheckAt} browserRefreshMs={browserRefreshMs} /><OperationsIntelligencePanel model={model} /></>}
        </main>
    );
}
