import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  compactProjectCanvasFiles,
  readProjectCanvasFile,
  trashProjectCanvasFile,
  writeProjectCanvasFile,
} from "../../../services/tauri";
import { deleteIntentCanvasDocuments } from "./intentCanvasStorage";

vi.mock("../../../services/tauri", () => ({
  compactProjectCanvasFiles: vi.fn(),
  readProjectCanvasFile: vi.fn(),
  trashProjectCanvasFile: vi.fn(),
  writeProjectCanvasFile: vi.fn(),
}));

function createIndexEntry(id: string) {
  return {
    id,
    title: id,
    mode: "architect",
    summary: "",
    updatedAt: `2026-06-06T00:00:0${id.slice(-1)}.000Z`,
    createdAt: "2026-06-06T00:00:00.000Z",
    path: `${id}.intent-canvas.json`,
    linkedFileCount: 0,
    linkedProjectMapNodeCount: 0,
    linkedThreadCount: 0,
    elementCount: 0,
  };
}

describe("deleteIntentCanvasDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(compactProjectCanvasFiles).mockResolvedValue({
      deletedDocuments: 0,
      deletedTempFiles: 0,
    });
  });

  it("trashes unique canvas files and writes the index once", async () => {
    vi.mocked(readProjectCanvasFile).mockResolvedValueOnce({
      content: JSON.stringify({
        version: 1,
        canvases: [
          createIndexEntry("canvas-a"),
          createIndexEntry("canvas-b"),
          createIndexEntry("canvas-c"),
        ],
      }),
      truncated: false,
    });

    await deleteIntentCanvasDocuments("workspace-1", ["canvas-a", "canvas-b", "canvas-a"]);

    expect(readProjectCanvasFile).toHaveBeenCalledTimes(1);
    expect(trashProjectCanvasFile).toHaveBeenCalledTimes(2);
    expect(trashProjectCanvasFile).toHaveBeenNthCalledWith(
      1,
      "workspace-1",
      "canvas-a.intent-canvas.json",
    );
    expect(trashProjectCanvasFile).toHaveBeenNthCalledWith(
      2,
      "workspace-1",
      "canvas-b.intent-canvas.json",
    );
    expect(writeProjectCanvasFile).toHaveBeenCalledTimes(1);
    expect(compactProjectCanvasFiles).toHaveBeenCalledWith("workspace-1");
    const [, path, content] = vi.mocked(writeProjectCanvasFile).mock.calls[0] ?? [];
    expect(path).toBe("index.json");
    expect(JSON.parse(String(content)).canvases.map((entry: { id: string }) => entry.id)).toEqual(["canvas-c"]);
  });
});
