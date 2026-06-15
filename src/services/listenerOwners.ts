export type ListenerOwnerKind = "bootstrap" | "shell" | "workspace" | "panel" | "modal";

export type ListenerOwnerRegistration = {
  id: string;
  owner: ListenerOwnerKind;
  surfaceId: string;
  active: boolean;
  registeredAtMs: number;
};

const registrations = new Map<string, ListenerOwnerRegistration>();

export function registerListenerOwner(
  input: Omit<ListenerOwnerRegistration, "active" | "registeredAtMs">,
) {
  registrations.set(input.id, {
    ...input,
    active: true,
    registeredAtMs: Date.now(),
  });
  return () => {
    const current = registrations.get(input.id);
    if (current) {
      registrations.set(input.id, { ...current, active: false });
    }
  };
}

export function getListenerOwnerDiagnostics() {
  const entries = Array.from(registrations.values());
  return {
    activeCount: entries.filter((entry) => entry.active).length,
    inactiveCount: entries.filter((entry) => !entry.active).length,
    entries: entries.map((entry) => ({
      id: entry.id,
      owner: entry.owner,
      surfaceId: entry.surfaceId,
      active: entry.active,
    })),
    evidenceClass: "proxy" as const,
  };
}

export function resetListenerOwnerRegistryForTests() {
  registrations.clear();
}
