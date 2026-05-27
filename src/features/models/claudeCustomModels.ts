export type ClaudeCustomModelFact = {
  id: string;
  model: string;
  label: string;
  description?: string;
  source: "custom";
};

export function normalizeClaudeCustomModels(input: unknown): ClaudeCustomModelFact[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const seenIds = new Set<string>();
  const models: ClaudeCustomModelFact[] = [];

  for (const entry of input) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const idValue = (entry as { id?: unknown }).id;
    if (typeof idValue !== "string") {
      continue;
    }
    const id = idValue.trim();
    if (!id || seenIds.has(id)) {
      continue;
    }

    const labelValue = (entry as { label?: unknown }).label;
    const descriptionValue = (entry as { description?: unknown }).description;
    const label =
      typeof labelValue === "string" && labelValue.trim().length > 0
        ? labelValue.trim()
        : id;
    const description =
      typeof descriptionValue === "string" && descriptionValue.trim().length > 0
        ? descriptionValue.trim()
        : undefined;

    models.push({
      id,
      model: id,
      label,
      description,
      source: "custom",
    });
    seenIds.add(id);
  }

  return models;
}

export function readClaudeCustomModelsFromStorage(storageKey: string): ClaudeCustomModelFact[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return [];
    }
    return normalizeClaudeCustomModels(JSON.parse(stored));
  } catch {
    return [];
  }
}
