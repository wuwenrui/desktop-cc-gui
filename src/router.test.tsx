/** @vitest-environment jsdom */
import { act, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let windowLabel = "main";

vi.mock("./features/layout/hooks/useWindowLabel", () => ({
  useWindowLabel: () => windowLabel,
}));

vi.mock("./app-shell", () => ({
  AppShell: () => <div>main-shell</div>,
}));

vi.mock("./features/about/components/AboutView", () => ({
  AboutView: () => <div>about-view</div>,
}));

vi.mock("./features/files/components/DetachedFileExplorerWindow", () => ({
  DetachedFileExplorerWindow: () => <div>detached-file-explorer-view</div>,
}));

vi.mock("./features/spec/components/DetachedSpecHubWindow", () => ({
  DetachedSpecHubWindow: () => <div>detached-spec-hub-view</div>,
}));

vi.mock("./features/client-documentation/components/ClientDocumentationWindow", () => ({
  ClientDocumentationWindow: () => <div>client-documentation-view</div>,
}));

import { AppRouter } from "./router";

async function renderAppRouter() {
  await act(async () => {
    render(<AppRouter />);
    await Promise.resolve();
  });
}

describe("AppRouter", () => {
  beforeAll(async () => {
    await Promise.all([
      import("./features/about/components/AboutView"),
      import("./features/files/components/DetachedFileExplorerWindow"),
      import("./features/spec/components/DetachedSpecHubWindow"),
      import("./features/client-documentation/components/ClientDocumentationWindow"),
    ]);
  });

  beforeEach(() => {
    windowLabel = "main";
  });

  it("renders the main shell for the main window", async () => {
    await renderAppRouter();
    expect(screen.getByText("main-shell")).not.toBeNull();
  });

  it("renders the about view for the about window", async () => {
    windowLabel = "about";
    await renderAppRouter();
    expect(await screen.findByText("about-view")).not.toBeNull();
  });

  it("renders the detached file explorer for the file-explorer window", async () => {
    windowLabel = "file-explorer";
    await renderAppRouter();
    expect(await screen.findByText("detached-file-explorer-view")).not.toBeNull();
  });

  it("renders the detached file explorer for per-tab file-explorer windows", async () => {
    windowLabel = "file-explorer-multiple-1";
    await renderAppRouter();
    expect(await screen.findByText("detached-file-explorer-view")).not.toBeNull();
  });

  it("renders the detached Spec Hub for the spec-hub window", async () => {
    windowLabel = "spec-hub";
    await renderAppRouter();
    expect(await screen.findByText("detached-spec-hub-view")).not.toBeNull();
  });

  it("renders the client documentation window for the client-documentation window", async () => {
    windowLabel = "client-documentation";
    await renderAppRouter();
    expect(await screen.findByText("client-documentation-view")).not.toBeNull();
  });
});
