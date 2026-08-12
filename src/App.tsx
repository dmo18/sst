import { useEffect, useMemo, useState } from 'react';
import packageMetadata from '../package.json';
import { ExperienceLayer } from './ExperienceLayer';
import { IssueConsole } from './IssueConsole';
import { Microsoft365CriticalSuite } from './Microsoft365CriticalSuite';
import { OperationsIntelligencePanel } from './OperationsIntelligencePanel';
import { ProductDepthLauncher } from './ProductDepthLauncher';
import { ProductDepthLayer } from './ProductDepthLayer';
import { ProductTruthBoundary } from './ProductTruthBoundary';
import { ACTIVE_PROVIDER_CATALOG } from './providerCatalog';
import { buildIssueConsoleModel } from './statusViewModel';
import { usePayloadPoller } from './usePayloadPoller';
import { WallboardV2 } from './WallboardV2';
import { readWallboardRoute } from './wallboardRoute';

const OPERATOR_BROWSER_REFRESH_MS = 60 * 1000;

export function App(): JSX.Element {
  const [route, setRoute] = useState(() => readWallboardRoute(location.search));
  const [now, setNow] = useState(() => Date.now());
  const browserRefreshMs = route.wallboardMode ? route.refreshIntervalMs : OPERATOR_BROWSER_REFRESH_MS;
  const { state, lastBrowserCheckAt, refresh } = usePayloadPoller(browserRefreshMs);

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

  const model = useMemo(
    () => state.data ? buildIssueConsoleModel(state.data, `v${packageMetadata.version}`, ACTIVE_PROVIDER_CATALOG) : null,
    [state.data]
  );

  const productFocus = new URLSearchParams(location.search).get('focus') || '';
  const replayBoundaryVisible = productFocus === 'universe' || productFocus.startsWith('category:') || productFocus.startsWith('correlation:');

  const exitWallboard = () => {
    const search = new URLSearchParams(location.search);
    search.delete('view');
    history.replaceState(null, '', `${location.pathname}${search.size ? `?${search}` : ''}${location.hash}`);
  };

  const requestRefresh = () => void refresh();

  return (
    <main className="app-frame">
      {route.wallboardMode
        ? <WallboardV2 model={model} lifecycle={state} now={now} browserCheckedAt={lastBrowserCheckAt} browserRefreshMs={browserRefreshMs} alertWindowMs={route.alertWindowMs} onExit={exitWallboard} />
        : <>
            <IssueConsole model={model} lifecycle={state} onRefresh={requestRefresh} browserCheckedAt={lastBrowserCheckAt} browserRefreshMs={browserRefreshMs} />
            <OperationsIntelligencePanel model={model} />
            <ExperienceLayer model={model} lifecyclePhase={state.phase} onRefresh={requestRefresh} />
            <ProductDepthLauncher model={model} />
            <Microsoft365CriticalSuite model={model} />
            <ProductDepthLayer model={model} />
            <ProductTruthBoundary visible={replayBoundaryVisible} />
          </>}
    </main>
  );
}
