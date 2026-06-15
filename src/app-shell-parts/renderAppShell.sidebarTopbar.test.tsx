import { Profiler } from "react";
import { describe, expect, it, vi } from "vitest";
import { injectSidebarTopbarNode } from "./renderAppShell";

function SidebarProbe({ topbarNode }: { topbarNode?: React.ReactNode }) {
  return <aside>{topbarNode}</aside>;
}

describe("injectSidebarTopbarNode", () => {
  it("injects the sidebar topbar node through a Profiler wrapper", () => {
    const sidebarNode = (
      <Profiler id="sidebar" onRender={vi.fn()}>
        <SidebarProbe />
      </Profiler>
    );
    const topbarNode = <button type="button">toggle</button>;

    const injectedNode = injectSidebarTopbarNode(sidebarNode, topbarNode);
    expect(injectedNode).toMatchObject({
      props: {
        children: {
          props: {
            topbarNode,
          },
        },
      },
    });
  });
});
