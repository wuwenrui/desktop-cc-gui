// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MessageForkConfirmDialog } from "./MessageForkConfirmDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params?.reason ? `${key}: ${params.reason}` : key,
  }),
}));

describe("MessageForkConfirmDialog", () => {
  it("resets provider selection when a new fork target opens", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const profiles = [
      { id: "provider-a", name: "Provider A", source: "managed" as const },
      { id: "provider-b", name: "Provider B", source: "managed" as const },
    ];
    const { rerender } = render(
      <MessageForkConfirmDialog
        userMessageId="message-1"
        onCancel={onCancel}
        onConfirm={onConfirm}
        providerProfiles={profiles}
        defaultProviderProfileId="provider-a"
        showProviderSelector
      />,
    );

    fireEvent.change(screen.getByLabelText("messages.forkProviderLabel"), {
      target: { value: "provider-b" },
    });

    rerender(
      <MessageForkConfirmDialog
        userMessageId="message-2"
        onCancel={onCancel}
        onConfirm={onConfirm}
        providerProfiles={profiles}
        defaultProviderProfileId="provider-a"
        showProviderSelector
      />,
    );
    fireEvent.click(screen.getByText("messages.forkConfirmAction"));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("message-2", {
        providerProfileId: "provider-a",
        providerProfile: profiles[0],
      });
    });
  });

  it("falls back to disk provider when default provider is unavailable", async () => {
    const onConfirm = vi.fn();
    render(
      <MessageForkConfirmDialog
        userMessageId="message-1"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        providerProfiles={[]}
        defaultProviderProfileId="deleted-provider"
        showProviderSelector
      />,
    );

    fireEvent.click(screen.getByText("messages.forkConfirmAction"));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("message-1", {
        providerProfileId: "__disk__",
        providerProfile: {
          id: "__disk__",
          name: "codex-tui/default-config",
          source: "disk",
        },
      });
    });
  });
});
