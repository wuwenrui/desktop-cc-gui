import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import FileText from "lucide-react/dist/esm/icons/file-text";
import GripVertical from "lucide-react/dist/esm/icons/grip-vertical";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import type { ProviderConfig } from "../types";
import { LOCAL_SETTINGS_PROVIDER_ID } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProviderListProps {
  providers: ProviderConfig[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (provider: ProviderConfig) => void;
  onDelete: (provider: ProviderConfig) => void;
  onSwitch: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

export function buildClaudeProviderReorderIds(
  regularProviders: ProviderConfig[],
  sourceIndex: number,
  destinationIndex: number,
): string[] {
  const activeProvider =
    regularProviders.find((provider) => provider.isActive) ?? null;
  const others = regularProviders.filter((provider) => !provider.isActive);
  const newOthers = Array.from(others);
  const [moved] = newOthers.splice(sourceIndex, 1);
  if (!moved) {
    return regularProviders.map((provider) => provider.id);
  }
  const safeDestinationIndex = Math.min(
    Math.max(destinationIndex, 0),
    newOthers.length,
  );
  newOthers.splice(safeDestinationIndex, 0, moved);

  if (!activeProvider) {
    return newOthers.map((provider) => provider.id);
  }

  const homeIndex = regularProviders.findIndex(
    (provider) => provider.id === activeProvider.id,
  );
  const safeHomeIndex = Math.min(Math.max(homeIndex, 0), newOthers.length);
  const newFull = Array.from(newOthers);
  newFull.splice(safeHomeIndex, 0, activeProvider);
  return newFull.map((provider) => provider.id);
}

export function ProviderList({
  providers,
  loading,
  onAdd,
  onEdit,
  onDelete,
  onSwitch,
  onReorder,
}: ProviderListProps) {
  const { t } = useTranslation();
  const providerList = Array.isArray(providers) ? providers : [];
  const localProvider =
    providerList.find(
      (provider) =>
        provider.id === LOCAL_SETTINGS_PROVIDER_ID || provider.isLocalProvider,
    ) ?? null;
  const regularProviders = providerList.filter(
    (provider) =>
      provider.id !== LOCAL_SETTINGS_PROVIDER_ID && !provider.isLocalProvider,
  );
  const activeProvider =
    regularProviders.find((provider) => provider.isActive) ?? null;
  const otherProviders = regularProviders.filter((provider) => !provider.isActive);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    if (sourceIndex === destinationIndex) {
      return;
    }

    onReorder(
      buildClaudeProviderReorderIds(
        regularProviders,
        sourceIndex,
        destinationIndex,
      ),
    );
  };

  const renderProviderCard = (
    provider: ProviderConfig,
    options: { dragHandle?: ReactNode; isDragging?: boolean } = {},
  ) => (
    <div
      key={provider.id}
      className={cn(
        "vendor-card",
        provider.isActive && "active",
        options.isDragging && "is-dragging",
      )}
    >
      {options.dragHandle}
      <div className="vendor-card-info">
        <div className="vendor-card-name">
          {provider.name}
          {provider.source === "cc-switch" && (
            <Badge
              variant="outline"
              size="sm"
              className="text-stone-600 dark:text-stone-300"
            >
              cc-switch
            </Badge>
          )}
        </div>
        {(provider.remark || provider.websiteUrl) && (
          <div
            className="vendor-card-remark"
            title={provider.remark || provider.websiteUrl}
          >
            {provider.remark || provider.websiteUrl}
          </div>
        )}
      </div>
      <div className="vendor-card-actions">
        {provider.isActive ? (
          <Badge variant="outline" className="text-stone-700 dark:text-stone-200">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-emerald-500"
            />
            {t("settings.vendor.inUse")}
          </Badge>
        ) : (
          <Button
            variant="outline"
            size="xs"
            onClick={() => onSwitch(provider.id)}
          >
            {t("settings.vendor.enable")}
          </Button>
        )}
        <span className="vendor-card-divider" />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onEdit(provider)}
          title={t("settings.vendor.edit")}
        >
          <Pencil aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="hover:text-destructive"
          onClick={() => onDelete(provider)}
          title={t("settings.vendor.delete")}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="vendor-provider-list">
      <div className="vendor-list-header">
        <span className="vendor-list-title">
          {t("settings.vendor.allProviders")}
        </span>
        <div className="vendor-list-actions">
          <Button size="sm" onClick={onAdd}>
            + {t("settings.vendor.add")}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="vendor-loading">{t("settings.loading")}</div>
      )}

      <div className="vendor-cards">
        {localProvider && (
          <div
            className={cn(
              "vendor-card vendor-local-provider-card",
              localProvider.isActive && "active",
            )}
          >
            <div className="vendor-card-info">
              <div className="vendor-card-name vendor-local-provider-name">
                <FileText size={14} />
                {t("settings.vendor.localProviderName")}
              </div>
              <div
                className="vendor-card-remark"
                title={t("settings.vendor.localProviderDescription")}
              >
                {t("settings.vendor.localProviderDescription")}
              </div>
            </div>
            <div className="vendor-card-actions">
              {localProvider.isActive ? (
                <Badge variant="outline" className="text-stone-700 dark:text-stone-200">
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-emerald-500"
                  />
                  {t("settings.vendor.inUse")}
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => onSwitch(localProvider.id)}
                >
                  {t("settings.vendor.enable")}
                </Button>
              )}
            </div>
          </div>
        )}

        {activeProvider && renderProviderCard(activeProvider)}

        {otherProviders.length > 0 && (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="vendor-provider-list">
              {(provided) => (
                <div
                  className="vendor-draggable-cards"
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  {otherProviders.map((provider, index) => (
                    <Draggable
                      key={provider.id}
                      draggableId={provider.id}
                      index={index}
                    >
                      {(draggableProvided, snapshot) => (
                        <div
                          ref={draggableProvided.innerRef}
                          {...draggableProvided.draggableProps}
                          style={draggableProvided.draggableProps.style}
                        >
                          {renderProviderCard(provider, {
                            isDragging: snapshot.isDragging,
                            dragHandle: (
                              <span
                                className="vendor-card-drag-handle"
                                title={t("settings.vendor.dragToReorder")}
                                aria-label={t("settings.vendor.dragToReorder")}
                                {...draggableProvided.dragHandleProps}
                              >
                                <GripVertical aria-hidden />
                              </span>
                            ),
                          })}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      {!loading && regularProviders.length === 0 && !localProvider && (
        <div className="vendor-empty">
          {t("settings.vendor.emptyState")}
        </div>
      )}
    </div>
  );
}
