import type { ModelInfo, ProviderId, ProviderModelCatalogs } from './types';
import { AVAILABLE_PROVIDERS, CODEX_MODELS } from './types';
import { STORAGE_KEYS, validateCodexCustomModels } from '../../types/provider';
import { readClaudeCustomModelsFromStorage } from '../../../models/claudeCustomModels';

export const RELEVANT_MODEL_STORAGE_KEYS = new Set<string>([
  STORAGE_KEYS.CODEX_CUSTOM_MODELS,
  STORAGE_KEYS.CLAUDE_CUSTOM_MODELS,
  STORAGE_KEYS.GEMINI_CUSTOM_MODELS,
]);

export const MODEL_CONFIG_PROVIDERS = new Set(['claude', 'codex', 'gemini']);

export type ModelStorageSnapshot = {
  claudeCustomModels: ModelInfo[];
  codexCustomModels: ModelInfo[];
  geminiCustomModels: ModelInfo[];
};

export type ProviderModelGroup = {
  providerId: ProviderId;
  providerLabel: string;
  models: ModelInfo[];
  enabled: boolean;
};

const GEMINI_GROUP_MODELS: ModelInfo[] = [
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
];

export const resolveModelConfigProvider = (provider: string) =>
  provider === 'codex' ? 'codex' : provider === 'gemini' ? 'gemini' : 'claude';

export const normalizeModelIdentity = (model: ModelInfo): string => {
  return getModelIdentities(model)[0] ?? '';
};

const normalizeIdentityValue = (kind: 'model' | 'id' | 'label', value?: string): string | null => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return `${kind}:${normalized}`;
};

const getModelIdentities = (model: ModelInfo): string[] => {
  const structuralIdentities = [
    normalizeIdentityValue('model', model.model),
    normalizeIdentityValue('id', model.id),
  ].filter((identity): identity is string => Boolean(identity));
  if (structuralIdentities.length > 0) {
    return Array.from(new Set(structuralIdentities));
  }
  const labelIdentity = normalizeIdentityValue('label', model.label);
  return labelIdentity ? [labelIdentity] : [];
};

const upsertModel = (
  mergedModels: ModelInfo[],
  seenIdentities: Map<string, number>,
  model: ModelInfo | null | undefined,
  replaceExisting = false,
) => {
  if (!model) {
    return;
  }
  const identities = getModelIdentities(model);
  if (identities.length === 0) {
    return;
  }
  const existingIndex = identities
    .map((identity) => seenIdentities.get(identity))
    .find((index): index is number => index !== undefined);
  if (existingIndex === undefined) {
    const nextIndex = mergedModels.length;
    identities.forEach((identity) => seenIdentities.set(identity, nextIndex));
    mergedModels.push(model);
    return;
  }
  identities.forEach((identity) => seenIdentities.set(identity, existingIndex));
  if (replaceExisting) {
    mergedModels[existingIndex] = {
      ...mergedModels[existingIndex],
      ...model,
    };
  }
};

export function mergeCodexModels(
  dynamicModels: ModelInfo[],
  customModels: ModelInfo[],
  selectedModel: string,
  options: { includeBuiltInModels?: boolean } = {},
): ModelInfo[] {
  const mergedModels: ModelInfo[] = [];
  const seenIdentities = new Map<string, number>();
  const includeBuiltInModels = options.includeBuiltInModels ?? true;

  dynamicModels.forEach((model) => upsertModel(mergedModels, seenIdentities, model));
  customModels.forEach((model) => upsertModel(mergedModels, seenIdentities, model, true));
  if (selectedModel.trim().length > 0) {
    upsertModel(mergedModels, seenIdentities, {
      id: selectedModel,
      label: selectedModel,
    });
  }
  if (includeBuiltInModels) {
    CODEX_MODELS.forEach((model) => upsertModel(mergedModels, seenIdentities, model));
  }

  return mergedModels;
}

function getCustomCodexModels(): ModelInfo[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEYS.CODEX_CUSTOM_MODELS);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    const validModels = validateCodexCustomModels(parsed);
    return validModels.map(m => ({
      id: m.id,
      label: m.label || m.id,
      description: m.description,
      providerProfileId: m.providerProfileId?.trim() || undefined,
    }));
  } catch {
    return [];
  }
}

function getCustomClaudeModels(): ModelInfo[] {
  return readClaudeCustomModelsFromStorage(STORAGE_KEYS.CLAUDE_CUSTOM_MODELS).map((model) => ({
    id: model.id,
    model: model.model,
    label: model.label,
    description: model.description,
    source: model.source,
    capabilities: model.capabilities,
  }));
}

function getCustomGeminiModels(): ModelInfo[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEYS.GEMINI_CUSTOM_MODELS);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    const validModels = validateCodexCustomModels(parsed);
    return validModels.map(m => ({
      id: m.id,
      label: m.label || m.id,
      description: m.description,
    }));
  } catch {
    return [];
  }
}

export function readModelStorageSnapshot(): ModelStorageSnapshot {
  return {
    claudeCustomModels: getCustomClaudeModels(),
    codexCustomModels: getCustomCodexModels(),
    geminiCustomModels: getCustomGeminiModels(),
  };
}

export function isRelevantModelStorageKey(key: string | null | undefined): boolean {
  return key == null || RELEVANT_MODEL_STORAGE_KEYS.has(key);
}

export function resolveAvailableModels({
  currentProvider,
  models,
  selectedModel,
  modelStorageSnapshot,
}: {
  currentProvider: string;
  models?: ModelInfo[];
  selectedModel: string;
  modelStorageSnapshot: ModelStorageSnapshot;
}): ModelInfo[] {
  if (currentProvider === 'gemini') {
    const dynamicModels = Array.isArray(models) ? models : [];
    const customModels = modelStorageSnapshot.geminiCustomModels;
    if (customModels.length > 0) {
      const customIds = new Set(customModels.map(m => m.id));
      const filteredDynamicModels = dynamicModels.filter(m => !customIds.has(m.id));
      const merged = [...customModels, ...filteredDynamicModels];
      if (merged.length > 0) {
        return merged;
      }
    }
    if (dynamicModels.length > 0) {
      return dynamicModels;
    }
    if (selectedModel.trim().length > 0) {
      return [{ id: selectedModel, label: selectedModel }];
    }
    return [];
  }
  if (currentProvider !== 'claude' && currentProvider !== 'codex') {
    if (Array.isArray(models) && models.length > 0) {
      return models;
    }
    if (selectedModel.trim().length > 0) {
      return [{ id: selectedModel, label: selectedModel }];
    }
    return [];
  }
  if (currentProvider === 'codex') {
    const dynamicModels = Array.isArray(models) ? models : [];
    return mergeCodexModels(
      dynamicModels,
      modelStorageSnapshot.codexCustomModels,
      selectedModel,
      { includeBuiltInModels: dynamicModels.length === 0 },
    );
  }

  const builtInModels = Array.isArray(models) ? models : [];
  const customModels = modelStorageSnapshot.claudeCustomModels;
  if (customModels.length === 0) {
    return builtInModels;
  }
  const customIdentities = new Set(customModels.map(normalizeModelIdentity));
  const filteredBuiltIn = builtInModels.filter(m => !customIdentities.has(normalizeModelIdentity(m)));
  return [...customModels, ...filteredBuiltIn];
}

function resolveProviderModels({
  providerId,
  currentProvider,
  models,
  selectedModel,
  modelStorageSnapshot,
  providerModelCatalogs,
}: {
  providerId: ProviderId;
  currentProvider: string;
  models?: ModelInfo[];
  selectedModel: string;
  modelStorageSnapshot: ModelStorageSnapshot;
  providerModelCatalogs?: ProviderModelCatalogs;
}): ModelInfo[] {
  if (providerId === 'opencode') {
    return [];
  }

  const providerSelectedModel = providerId === currentProvider ? selectedModel : '';
  const providerDynamicModels =
    providerModelCatalogs?.[providerId] ??
    (providerId === currentProvider ? models : undefined);
  const resolvedModels = resolveAvailableModels({
    currentProvider: providerId,
    models: providerDynamicModels,
    selectedModel: providerSelectedModel,
    modelStorageSnapshot,
  });

  if (providerId !== 'claude') {
    if (providerId === 'gemini' && resolvedModels.length === 0) {
      return GEMINI_GROUP_MODELS;
    }
    return resolvedModels;
  }
  if (resolvedModels.length > 0) {
    return resolvedModels;
  }
  return [];
}

export function resolveProviderModelGroups({
  currentProvider,
  models,
  selectedModel,
  modelStorageSnapshot,
  providerModelCatalogs,
  providerAvailability,
  resolveProviderLabel,
}: {
  currentProvider: string;
  models?: ModelInfo[];
  selectedModel: string;
  modelStorageSnapshot: ModelStorageSnapshot;
  providerModelCatalogs?: ProviderModelCatalogs;
  providerAvailability?: Partial<Record<ProviderId, boolean>>;
  resolveProviderLabel?: (providerId: ProviderId, fallbackLabel: string) => string;
}): ProviderModelGroup[] {
  return AVAILABLE_PROVIDERS.map((provider) => {
    const enabled = providerAvailability?.[provider.id] ?? provider.enabled;
    const groupModels = resolveProviderModels({
      providerId: provider.id,
      currentProvider,
      models,
      selectedModel,
      modelStorageSnapshot,
      providerModelCatalogs,
    });

    return {
      providerId: provider.id,
      providerLabel: resolveProviderLabel?.(provider.id, provider.label) ?? provider.label,
      models: groupModels,
      enabled,
    };
  }).filter((group) => group.models.length > 0 && (group.enabled || group.providerId === currentProvider));
}
