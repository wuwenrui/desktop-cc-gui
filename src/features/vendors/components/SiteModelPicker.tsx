import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { SiteModel } from "../../../services/tauri/vendors";
import { modelSupportsVision } from "../../vision/visionRouting";
import { initialSelectedIds } from "../syncModelMerge";

export interface SlotMapping {
  haiku: string;
  sonnet: string;
  opus: string;
}

interface SiteModelPickerProps {
  models: SiteModel[];
  /** ids of models already in the current engine's managed list, used to preselect */
  ownedModelIds?: string[];
  onConfirm: (claudeSlots: SlotMapping, selectedModelIds: string[]) => void;
  onBack?: () => void;
  loading?: boolean;
}

export function SiteModelPicker({
  models,
  ownedModelIds,
  onConfirm,
  onBack,
  loading,
}: SiteModelPickerProps) {
  const [search, setSearch] = useState("");
  const [slots, setSlots] = useState<SlotMapping>(() => autoSuggestSlots(models));
  const [selected, setSelected] = useState<Set<string>>(() =>
    initialSelectedIds(models, new Set(ownedModelIds ?? [])),
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return models;
    const q = search.toLowerCase();
    return models.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.owned_by.toLowerCase().includes(q),
    );
  }, [models, search]);

  const toggleModel = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSlotChange = useCallback(
    (slot: keyof SlotMapping, value: string) => {
      setSlots((prev) => ({ ...prev, [slot]: value }));
    },
    [],
  );

  const canConfirm = slots.haiku && slots.sonnet && slots.opus;

  return (
    <div style={container}>
      <div style={header}>
        <h3 style={title}>Select Models</h3>
        <p style={subtitle}>
          Found {models.length} models from site. Map to Claude slots and select
          Codex models.
        </p>
      </div>

      <input
        style={searchInput}
        placeholder="Search models..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div style={sectionHeader}>Claude Slot Mapping</div>
      <div style={slotGrid}>
        {(["haiku", "sonnet", "opus"] as const).map((slot) => (
          <label key={slot} style={slotLabel}>
            <span style={slotName}>{slot}</span>
            <select
              style={selectStyle}
              value={slots[slot]}
              onChange={(e) => handleSlotChange(slot, e.target.value)}
            >
              <option value="">-- select --</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div style={sectionHeader}>
        Models ({selected.size} selected)
      </div>
      <div style={modelList}>
        {filtered.map((m) => (
          <label key={m.id} style={modelRow}>
            <input
              type="checkbox"
              checked={selected.has(m.id)}
              onChange={() => toggleModel(m.id)}
              style={checkbox}
            />
            <span style={modelId}>{m.id}</span>
            {modelSupportsVision(m) && <span style={visionBadge}>Vision</span>}
            {m.owned_by && <span style={ownerBadge}>{m.owned_by}</span>}
          </label>
        ))}
        {filtered.length === 0 && (
          <div style={emptyText}>No models match search</div>
        )}
      </div>

      <div style={footer}>
        {onBack && (
          <button type="button" style={backBtn} onClick={onBack}>
            Back
          </button>
        )}
        <button
          type="button"
          style={{
            ...confirmBtn,
            ...(!canConfirm || loading ? disabledBtn : undefined),
          }}
          disabled={!canConfirm || loading}
          onClick={() => onConfirm(slots, [...selected])}
        >
          {loading ? "Saving..." : "Confirm"}
        </button>
      </div>
    </div>
  );
}

function autoSuggestSlots(models: SiteModel[]): SlotMapping {
  const find = (patterns: string[]) =>
    models.find((m) =>
      patterns.some((p) => m.id.toLowerCase().includes(p)),
    )?.id ?? "";

  return {
    haiku: find(["haiku", "flash", "mini", "air", "lite", "spark"]),
    sonnet: find(["sonnet", "pro", "plus", "4.7", "v3", "standard"]),
    opus: find(["opus", "max", "ultra", "preview"]),
  };
}

const container: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  width: "100%",
};

const header: CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };

const title: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 600,
  color: "#f5f5f7",
};

const subtitle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#9aa0a6",
  lineHeight: 1.4,
};

const searchInput: CSSProperties = {
  padding: "8px 12px",
  background: "#0e0e10",
  border: "1px solid #34343a",
  borderRadius: 8,
  color: "#f5f5f7",
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const sectionHeader: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#9ab4ff",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginTop: 4,
};

const slotGrid: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const slotLabel: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const slotName: CSSProperties = {
  width: 56,
  fontSize: 13,
  color: "#d1d5db",
  textTransform: "capitalize",
};

const selectStyle: CSSProperties = {
  flex: 1,
  padding: "6px 8px",
  background: "#0e0e10",
  border: "1px solid #34343a",
  borderRadius: 6,
  color: "#f5f5f7",
  fontSize: 13,
  outline: "none",
};

const modelList: CSSProperties = {
  maxHeight: 200,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "4px 0",
};

const modelRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 8px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  color: "#d1d5db",
};

const checkbox: CSSProperties = {
  accentColor: "#3b82f6",
};

const modelId: CSSProperties = {
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const ownerBadge: CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
  background: "#1a1a1e",
  padding: "2px 6px",
  borderRadius: 4,
  flexShrink: 0,
};

const visionBadge: CSSProperties = {
  fontSize: 11,
  color: "#d9f99d",
  background: "rgba(77, 124, 15, 0.35)",
  border: "1px solid rgba(163, 230, 53, 0.3)",
  padding: "2px 6px",
  borderRadius: 4,
  flexShrink: 0,
};

const emptyText: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  textAlign: "center",
  padding: 16,
};

const footer: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 4,
};

const backBtn: CSSProperties = {
  padding: "9px 16px",
  background: "transparent",
  border: "1px solid #34343a",
  borderRadius: 8,
  color: "#d1d5db",
  fontSize: 13,
  cursor: "pointer",
};

const confirmBtn: CSSProperties = {
  padding: "9px 20px",
  background: "#3b82f6",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const disabledBtn: CSSProperties = {
  opacity: 0.45,
  cursor: "not-allowed",
};
