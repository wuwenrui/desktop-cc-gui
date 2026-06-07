// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SiteModel } from "../../../services/tauri/vendors";
import { SiteModelPicker } from "./SiteModelPicker";

const models: SiteModel[] = [
  { id: "alpha", owned_by: "x" },
  { id: "beta", owned_by: "x" },
  { id: "gamma", owned_by: "x" },
];

afterEach(() => {
  cleanup();
});

describe("SiteModelPicker managed-model selection", () => {
  it("preselects owned models that exist in the fetched list", () => {
    render(
      <SiteModelPicker
        models={models}
        ownedModelIds={["beta"]}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      (screen.getByRole("checkbox", { name: /beta/ }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (screen.getByRole("checkbox", { name: /alpha/ }) as HTMLInputElement)
        .checked,
    ).toBe(false);
  });

  it("returns the union of preselected and newly checked model ids on confirm", () => {
    const onConfirm = vi.fn();
    render(
      <SiteModelPicker
        models={models}
        ownedModelIds={["beta"]}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "haiku" }), {
      target: { value: "alpha" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "sonnet" }), {
      target: { value: "beta" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "opus" }), {
      target: { value: "gamma" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /gamma/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [slots, ids] = onConfirm.mock.calls[0];
    expect(slots).toEqual({ haiku: "alpha", sonnet: "beta", opus: "gamma" });
    expect([...ids].sort()).toEqual(["beta", "gamma"]);
  });
});
