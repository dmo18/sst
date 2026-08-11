export function ProductTruthBoundary({ visible }: { visible: boolean }): JSX.Element | null {
  if (!visible) return null;

  return (
    <aside className="depth-truth-boundary" aria-label="Signal replay evidence boundary">
      <span>Signal replay evidence</span>
      <strong>Recorded changes only.</strong>
      <small>No unobserved service state is reconstructed.</small>
    </aside>
  );
}
