type SidebarSearchBoxProps = {
  isOpen: boolean;
  query: string;
  t: (key: string) => string;
  onQueryChange: (query: string) => void;
  onClear: () => void;
};

export function SidebarSearchBox({
  isOpen,
  query,
  t,
  onQueryChange,
  onClear,
}: SidebarSearchBoxProps) {
  return (
    <div className={`sidebar-search${isOpen ? " is-open" : ""}`}>
      {isOpen && (
        <input
          className="sidebar-search-input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("sidebar.searchProjects")}
          aria-label={t("sidebar.searchProjects")}
          data-tauri-drag-region="false"
          autoFocus
        />
      )}
      {isOpen && query.length > 0 && (
        <button
          type="button"
          className="sidebar-search-clear"
          onClick={onClear}
          aria-label={t("sidebar.clearSearch")}
          data-tauri-drag-region="false"
        >
          <span className="codicon codicon-close" style={{ fontSize: "12px" }} aria-hidden />
        </button>
      )}
    </div>
  );
}
