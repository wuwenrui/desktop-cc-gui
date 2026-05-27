// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomModelDialog } from "./CustomModelDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("CustomModelDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps Claude custom model ids as user-entered facts in shape-only mode", () => {
    const onModelsChange = vi.fn();

    render(
      <CustomModelDialog
        isOpen
        initialAddMode
        modelValidation="shape-only"
        models={[]}
        onModelsChange={onModelsChange}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("settings.vendor.modelManager.modelIdPlaceholder"),
      { target: { value: "  Haiku  4.5  " } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("settings.vendor.modelManager.modelLabelPlaceholder"),
      { target: { value: "  Haiku  4.5  " } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.vendor.modelManager.addModel",
      }),
    );

    expect(onModelsChange).toHaveBeenCalledWith([
      {
        id: "Haiku  4.5",
        label: "Haiku  4.5",
        description: undefined,
      },
    ]);
  });

  it("keeps model-id validation for non-Claude custom model dialogs", () => {
    const onModelsChange = vi.fn();

    render(
      <CustomModelDialog
        isOpen
        initialAddMode
        modelValidation="model-id"
        models={[]}
        onModelsChange={onModelsChange}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("settings.vendor.modelManager.modelIdPlaceholder"),
      { target: { value: "x".repeat(257) } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.vendor.modelManager.addModel",
      }),
    );

    expect(onModelsChange).not.toHaveBeenCalled();
    expect(screen.getByText("settings.vendor.modelManager.modelIdInvalid")).toBeTruthy();
  });
});
