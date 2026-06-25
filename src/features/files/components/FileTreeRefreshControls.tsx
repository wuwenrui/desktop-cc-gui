type FileTreeRefreshControlsProps = {
  loadError: string;
  canRefresh: boolean;
  loadFailedLabel: string;
  retryLabel: string;
  onRefresh: () => void;
};

export function FileTreeRefreshControls({
  loadError,
  canRefresh,
  loadFailedLabel,
  retryLabel,
  onRefresh,
}: FileTreeRefreshControlsProps) {
  return (
    <div className="file-tree-empty" title={loadError}>
      <div>{loadFailedLabel}</div>
      {canRefresh ? (
        <button
          type="button"
          className="file-tree-lazy-retry"
          onClick={() => void onRefresh()}
          title={loadError}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
