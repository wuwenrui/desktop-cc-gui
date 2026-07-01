import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import CheckIcon from "lucide-react/dist/esm/icons/check";
import PlusIcon from "lucide-react/dist/esm/icons/plus";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { BranchInfo } from "../../../types";

export type ComposerBranchControl = {
  branchName: string;
  branches: BranchInfo[];
  onCheckout: (name: string) => Promise<void> | void;
  onCreate: (name: string) => Promise<void> | void;
  /** worktree 工作区下禁用切换，仅展示当前分支 */
  disabled?: boolean;
};

/**
 * ComposerBranchBadge - 输入框下方的 git 分支胶囊
 * 使用 shadcn Popover + Command 组合框，逻辑精简：仅分支切换 / 新建。
 * worktree 工作区（disabled）下只读展示。
 */
export function ComposerBranchBadge({
  branchName,
  branches,
  onCheckout,
  onCreate,
  disabled = false,
}: ComposerBranchControl) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const trimmedQuery = query.trim();

  const exactMatch = useMemo(
    () =>
      trimmedQuery
        ? branches.find((branch) => branch.name === trimmedQuery) ?? null
        : null,
    [branches, trimmedQuery],
  );

  const canCreate = trimmedQuery.length > 0 && !exactMatch;

  const branchValidationMessage = useMemo(() => {
    if (trimmedQuery.length === 0) {
      return null;
    }
    if (trimmedQuery === "." || trimmedQuery === "..") {
      return t("workspace.branchCannotBeDot");
    }
    if (/\s/.test(trimmedQuery)) {
      return t("workspace.branchCannotContainSpaces");
    }
    if (trimmedQuery.startsWith("/") || trimmedQuery.endsWith("/")) {
      return t("workspace.branchCannotStartEndSlash");
    }
    if (trimmedQuery.endsWith(".lock")) {
      return t("workspace.branchCannotEndLock");
    }
    if (trimmedQuery.includes("..")) {
      return t("workspace.branchCannotContainDotDot");
    }
    if (trimmedQuery.includes("@{")) {
      return t("workspace.branchCannotContainAtBrace");
    }
    const invalidChars = ["~", "^", ":", "?", "*", "[", "\\"];
    if (invalidChars.some((char) => trimmedQuery.includes(char))) {
      return t("workspace.branchContainsInvalidChars");
    }
    if (trimmedQuery.endsWith(".")) {
      return t("workspace.branchCannotEndDot");
    }
    return null;
  }, [trimmedQuery, t]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setQuery("");
    setError(null);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (disabled) {
        return;
      }
      if (next) {
        setMenuOpen(true);
      } else {
        closeMenu();
      }
    },
    [closeMenu, disabled],
  );

  const handleCheckout = useCallback(
    async (name: string) => {
      if (name === branchName) {
        closeMenu();
        return;
      }
      try {
        await onCheckout(name);
        closeMenu();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [branchName, closeMenu, onCheckout],
  );

  const handleCreate = useCallback(async () => {
    if (branchValidationMessage) {
      setError(branchValidationMessage);
      return;
    }
    if (!canCreate) {
      return;
    }
    try {
      await onCreate(trimmedQuery);
      closeMenu();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [branchValidationMessage, canCreate, closeMenu, onCreate, trimmedQuery]);

  // worktree 工作区：只读展示当前分支，无下拉。
  if (disabled) {
    return (
      <div className="composer-branch-badge">
        <button
          type="button"
          className="composer-branch-badge-trigger"
          disabled
          title={branchName}
        >
          <GitBranch size={13} aria-hidden className="composer-branch-badge-icon" />
          <span className="composer-branch-badge-name">{branchName}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="composer-branch-badge">
      <Popover open={menuOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="composer-branch-badge-trigger"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={branchName}
          >
            <GitBranch size={13} aria-hidden className="composer-branch-badge-icon" />
            <span className="composer-branch-badge-name">{branchName}</span>
            <ChevronDown size={12} aria-hidden className="composer-branch-badge-caret" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top" sideOffset={6} className="w-72 p-0">
          <Command>
            <CommandInput
              value={query}
              onValueChange={(next) => {
                setQuery(next);
                setError(null);
              }}
              placeholder={t("workspace.searchOrCreateBranch")}
              autoFocus
              aria-label={t("workspace.searchBranches")}
            />
            {branchValidationMessage ? (
              <div className="px-3 py-2 text-xs text-destructive">
                {branchValidationMessage}
              </div>
            ) : null}
            <CommandList>
              <CommandEmpty>{t("workspace.noBranchesFound")}</CommandEmpty>
              <CommandGroup>
                {branches.map((branch) => (
                  <CommandItem
                    key={branch.name}
                    value={branch.name}
                    onSelect={() => handleCheckout(branch.name)}
                  >
                    <GitBranch className="size-4 shrink-0 opacity-60" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{branch.name}</span>
                    {branch.name === branchName ? (
                      <CheckIcon className="size-4 shrink-0" aria-hidden />
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
              {canCreate && !branchValidationMessage ? (
                <CommandGroup>
                  <CommandItem
                    value={trimmedQuery}
                    onSelect={() => {
                      void handleCreate();
                    }}
                  >
                    <PlusIcon className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">
                      {t("workspace.createBranchNamed", { name: trimmedQuery })}
                    </span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
            </CommandList>
            {error ? (
              <div className="px-3 py-2 text-xs text-destructive">{error}</div>
            ) : null}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default ComposerBranchBadge;
