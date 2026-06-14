/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectVisionFilePaths,
  collectVisionImageInputs,
  isVisionFilePath,
} from "./visionFileInputs";

const pdfRuntimeMocks = vi.hoisted(() => ({
  ensurePdfPreviewWorker: vi.fn(),
  getDocument: vi.fn(),
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: pdfRuntimeMocks.getDocument,
}));

vi.mock("../files/utils/pdfPreviewRuntime", () => ({
  ensurePdfPreviewWorker: pdfRuntimeMocks.ensurePdfPreviewWorker,
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `tauri://${path}`,
}));

describe("visionFileInputs", () => {
  let dataUrlIndex = 0;

  beforeEach(() => {
    dataUrlIndex = 0;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(
      () => `data:image/png;base64,page-${(dataUrlIndex += 1)}`,
    );
    pdfRuntimeMocks.ensurePdfPreviewWorker.mockClear();
    pdfRuntimeMocks.getDocument.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("recognizes image and PDF files as visual inputs", () => {
    expect(isVisionFilePath("/tmp/evidence.JPG")).toBe(true);
    expect(isVisionFilePath("/tmp/report.pdf#L1-L2")).toBe(true);
    expect(isVisionFilePath("/tmp/notes.docx")).toBe(false);
  });

  it("collects visual file references from text and explicit paths", () => {
    expect(
      collectVisionFilePaths({
        text: "@file `/tmp/report.pdf#L1-L2`\n分析 `/tmp/photo.webp`",
        explicitPaths: ["scans/page.png", "/tmp/notes.docx"],
        workspacePath: "/Users/demo/case",
      }),
    ).toEqual([
      "/tmp/report.pdf",
      "/tmp/photo.webp",
      "/Users/demo/case/scans/page.png",
    ]);
  });

  it("renders PDF pages and preserves image file inputs", async () => {
    const destroy = vi.fn(async () => undefined);
    const cleanup = vi.fn();
    const getPage = vi.fn(async (pageNumber: number) => ({
      cleanup,
      getViewport: vi.fn(() => ({ width: 100 + pageNumber, height: 200 })),
      render: vi.fn(() => ({ promise: Promise.resolve() })),
    }));
    pdfRuntimeMocks.getDocument.mockReturnValue({
      promise: Promise.resolve({
        destroy,
        getPage,
        numPages: 2,
      }),
    });

    await expect(
      collectVisionImageInputs({
        text: "@file `/tmp/report.pdf`",
        explicitPaths: ["/tmp/photo.png"],
        workspacePath: "/Users/demo/case",
      }),
    ).resolves.toEqual([
      "data:image/png;base64,page-1",
      "data:image/png;base64,page-2",
      "/tmp/photo.png",
    ]);
    expect(pdfRuntimeMocks.ensurePdfPreviewWorker).toHaveBeenCalledTimes(1);
    expect(pdfRuntimeMocks.getDocument).toHaveBeenCalledWith("tauri:///tmp/report.pdf");
    expect(getPage).toHaveBeenNthCalledWith(1, 1);
    expect(getPage).toHaveBeenNthCalledWith(2, 2);
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
