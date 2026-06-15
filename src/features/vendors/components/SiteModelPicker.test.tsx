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
  it("marks fetched Qwen VL models as vision-capable", () => {
    render(
      <SiteModelPicker
        models={[
          { id: "deepseek-v4-pro", owned_by: "site" },
          { id: "qwen3-vl-flash", owned_by: "site" },
        ]}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: /qwen3-vl-flash.*Vision/i }),
    ).toBeTruthy();
    expect(screen.queryByText("Vision", { selector: "span" })).toBeTruthy();
  });

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

describe("SiteModelPicker initialSlotMapping prefill", () => {
  it("prefills saved slots when the saved model ids still exist", () => {
    render(
      <SiteModelPicker
        models={models}
        initialSlotMapping={{ haiku: "gamma", sonnet: "alpha", opus: "beta" }}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      (screen.getByRole("combobox", { name: "haiku" }) as HTMLSelectElement)
        .value,
    ).toBe("gamma");
    expect(
      (screen.getByRole("combobox", { name: "sonnet" }) as HTMLSelectElement)
        .value,
    ).toBe("alpha");
    expect(
      (screen.getByRole("combobox", { name: "opus" }) as HTMLSelectElement)
        .value,
    ).toBe("beta");
  });

  it("drops saved slots whose model id no longer exists and falls back to auto-suggest", () => {
    const fetched: SiteModel[] = [
      { id: "qwen-flash", owned_by: "site" },
      { id: "qwen-pro", owned_by: "site" },
      { id: "qwen-max", owned_by: "site" },
    ];

    render(
      <SiteModelPicker
        models={fetched}
        initialSlotMapping={{
          haiku: "removed-haiku",
          sonnet: "removed-sonnet",
          opus: "removed-opus",
        }}
        onConfirm={vi.fn()}
      />,
    );

    // Saved ids absent from the fetched list must not leak into the slot value;
    // they fall back to keyword auto-suggest (flash/pro/max).
    expect(
      (screen.getByRole("combobox", { name: "haiku" }) as HTMLSelectElement)
        .value,
    ).toBe("qwen-flash");
    expect(
      (screen.getByRole("combobox", { name: "sonnet" }) as HTMLSelectElement)
        .value,
    ).toBe("qwen-pro");
    expect(
      (screen.getByRole("combobox", { name: "opus" }) as HTMLSelectElement)
        .value,
    ).toBe("qwen-max");
  });

  it("keeps valid saved slots and auto-suggests only the missing ones", () => {
    const mixed: SiteModel[] = [
      { id: "alpha", owned_by: "x" },
      { id: "qwen-max", owned_by: "x" },
    ];

    render(
      <SiteModelPicker
        models={mixed}
        initialSlotMapping={{
          haiku: "alpha",
          sonnet: "ghost",
          opus: "qwen-max",
        }}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      (screen.getByRole("combobox", { name: "haiku" }) as HTMLSelectElement)
        .value,
    ).toBe("alpha");
    expect(
      (screen.getByRole("combobox", { name: "opus" }) as HTMLSelectElement)
        .value,
    ).toBe("qwen-max");
    // "ghost" is absent and no sonnet/pro keyword matches -> empty placeholder.
    expect(
      (screen.getByRole("combobox", { name: "sonnet" }) as HTMLSelectElement)
        .value,
    ).toBe("");
  });
});
