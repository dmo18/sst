import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import providerCatalog from '../config/providers.json';
import providerConsolidation from '../config/provider-consolidation.json';
import packageMetadata from '../package.json';
import { dataLifecycleReducer, initialDataLifecycle } from './dataLifecycle';
import { IssueConsole } from './IssueConsole';
import { buildIssueConsoleModel } from './statusViewModel';
import { payloadValidationErrors } from './payloadValidation';
import { RequestOwnership } from './requestOwnership';
import type { ProviderConfig, StatusPayload } from './types';

type ProviderConsolidation = {
    excludedProviderIds: string[];
    providerOverrides: Record<string, Partial<ProviderConfig>>;
};

const CONSOLIDATION = providerConsolidation as ProviderConsolidation;
const EXCLUDED_PROVIDER_IDS = new Set(CONSOLIDATION.excludedProviderIds);
const CATALOG = (providerCatalog as ProviderConfig[])
    .filter(provider => !EXCLUDED_PROVIDER_IDS.has(provider.id))
    .map(provider => ({ ...provider, ...(CONSOLIDATION.providerOverrides[provider.id] || {}) }));
const REFRESH_MS = 60000;

async function fetchStatus(signal: AbortSignal): Promise<StatusPayload> {
    const response = await fetch(`${import.meta.env.BASE_URL}status.json?ts=${Date.now()}`, { cache: 'no-store', signal });
    if (!response.ok)
        throw new Error(`status.json returned HTTP ${response.status}`);
    const data: unknown = await response.json();
    const errors = payloadValidationErrors(data);
    if (errors.length) {
        console.error('status.json validation failed:', errors);
        throw new Error(`status.json has an invalid or unsupported payload (${errors.join('; ')})`);
    }
    return data as StatusPayload;
}

export function App(): JSX.Element {
    const [state, dispatch] = useReducer(dataLifecycleReducer, initialDataLifecycle);
    const ownership = useRef(new RequestOwnership());
    const mounted = useRef(true);
    const refresh = useCallback(async () => {
        const slot = ownership.current.begin();
        if (!slot)
            return;
        const { controller: request, sequence } = slot;
        dispatch({ type: 'request' });
        try {
            const data = await fetchStatus(request.signal);
            if (mounted.current && ownership.current.owns(request, sequence))
                dispatch({ type: 'success', data });
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
    const model = useMemo(() => state.data ? buildIssueConsoleModel(state.data, `v${packageMetadata.version}`, CATALOG) : null, [state.data]);
    return <main className="app-frame"><IssueConsole model={model} lifecycle={state} onRefresh={() => void refresh()}/></main>;
}
