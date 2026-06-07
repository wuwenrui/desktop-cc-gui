import { describe, expect, it } from "vitest";
import type { SiteModel } from "../../services/tauri/vendors";
import { initialSelectedIds, mergeSyncedModels } from "./syncModelMerge";
import type { CodexCustomModel } from "./types";

const model = (
  id: string,
  extra: Partial<CodexCustomModel> = {},
): CodexCustomModel => ({ id, label: id, ...extra });

const site = (id: string): SiteModel => ({ id, owned_by: "" });

describe("mergeSyncedModels", () => {
  it("adds a newly checked site model using its id as the default label", () => {
    const result = mergeSyncedModels([], new Set(["a", "b"]), new Set(["a"]));
    expect(result).toEqual([{ id: "a", label: "a" }]);
  });

  it("removes a managed model that is in this fetch but unchecked", () => {
    const current = [model("a"), model("b")];
    const result = mergeSyncedModels(
      current,
      new Set(["a", "b"]),
      new Set(["a"]),
    );
    expect(result).toEqual([model("a")]);
  });

  it("keeps managed models that are absent from this fetch untouched", () => {
    const current = [model("manual"), model("a")];
    const result = mergeSyncedModels(current, new Set(["a"]), new Set());
    expect(result).toEqual([model("manual")]);
  });

  it("preserves an existing label and description for a kept model", () => {
    const current = [model("a", { label: "Custom A", description: "desc" })];
    const result = mergeSyncedModels(current, new Set(["a"]), new Set(["a"]));
    expect(result).toEqual([{ id: "a", label: "Custom A", description: "desc" }]);
  });

  it("does not duplicate a model that is already managed and still checked", () => {
    const current = [model("a", { label: "A" })];
    const result = mergeSyncedModels(current, new Set(["a"]), new Set(["a"]));
    expect(result).toEqual([{ id: "a", label: "A" }]);
  });

  it("removes every fetched model when nothing is checked but keeps non-fetched ones", () => {
    const current = [model("a"), model("b"), model("keep")];
    const result = mergeSyncedModels(current, new Set(["a", "b"]), new Set());
    expect(result).toEqual([model("keep")]);
  });

  it("returns the current list unchanged when the fetch is empty", () => {
    const current = [model("a")];
    const result = mergeSyncedModels(current, new Set(), new Set());
    expect(result).toEqual([model("a")]);
  });
});

describe("initialSelectedIds", () => {
  it("preselects only owned models that exist in the fetched list", () => {
    const fetched = [site("a"), site("b"), site("c")];
    const result = initialSelectedIds(fetched, new Set(["b", "z"]));
    expect([...result].sort()).toEqual(["b"]);
  });

  it("returns an empty set when nothing is owned", () => {
    const result = initialSelectedIds([site("a")], new Set());
    expect(result.size).toBe(0);
  });
});
