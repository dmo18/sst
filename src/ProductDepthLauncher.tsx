import type { IssueConsoleModel } from './statusViewModel';

export function ProductDepthLauncher({ model }: { model: IssueConsoleModel | null }): JSX.Element {
  const correlationCount = model?.correlations.length || 0;
  const changeCount = model?.changes.length || 0;
  const openUniverse = () => {
    window.dispatchEvent(new CustomEvent('serviceops:product-command', { detail: { command: 'universe' } }));
  };
  return (
    <button className="depth-launcher" type="button" onClick={openUniverse} aria-label="Open Dependency Universe">
      <span className="depth-launcher-mark" />
      <span><b>Dependency Universe</b><small>{correlationCount ? `${correlationCount} live correlation ${correlationCount === 1 ? 'cluster' : 'clusters'}` : changeCount ? `${changeCount} recent recorded ${changeCount === 1 ? 'change' : 'changes'}` : 'Explore live service dependencies'}</small></span>
      <kbd>G</kbd>
    </button>
  );
}
