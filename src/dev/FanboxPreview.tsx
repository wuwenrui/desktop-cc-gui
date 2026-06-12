/**
 * FanBox 改版组件视觉验收页（dev-only，验收后可删）。
 * 用真实组件 + 真实样式 token 渲染：casebar 三视图 / AI 摘要块 / 右栏四 tab + 面板。
 * 启动：vite dev 下访问 /fanbox-preview.html
 */
import ReactDOM from "react-dom/client";
import { useState } from "react";
import "../styles/themes.light.css";
import "../styles/themes.dark.css";
import "../i18n";
import { SessionStage } from "../features/session-evidence/SessionStage";
import { TurnSourceSummary } from "../features/session-evidence/TurnSourceSummary";
import { FanBoxPanelTabs } from "../features/layout/components/FanBoxPanelTabs";
import { EvidencePanel } from "../features/layout/components/EvidencePanel";
import { LogsPanel } from "../features/layout/components/LogsPanel";
import type { PanelToolbarTabId } from "../features/layout/components/PanelTabs";

document.documentElement.dataset.theme = "light";

function inv(tool: string, params: Record<string, string>): string {
  const body = Object.entries(params)
    .map(([k, v]) => `<parameter name="${k}">${v}</parameter>`)
    .join("");
  return `<invoke name="${tool}">${body}</invoke>`;
}

const AI_TEXT =
  "已完成第一轮审查。最需要先处理的是付款顺序和工商变更条件不一致。\n" +
  inv("Read", { file_path: "/案件/股权转让协议.docx" }) +
  inv("Read", { file_path: "/案件/客户沟通纪要.md" }) +
  inv("Edit", { file_path: "/案件/风险清单.md", old_string: "a", new_string: "b" }) +
  inv("Edit", { file_path: "/案件/风险清单.md", old_string: "c", new_string: "d" }) +
  inv("Write", { file_path: "/案件/客户说明.md", content: "x" });

const ITEMS = [
  { id: "1", role: "user", text: "帮我审查这份股权转让协议。" },
  { id: "2", role: "assistant", text: AI_TEXT },
];

function Preview() {
  const [tab, setTab] = useState<PanelToolbarTabId>("evidence");
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        padding: 20,
        background: "#eeeff3",
        minHeight: "100vh",
        fontFamily: "-apple-system, 'PingFang SC', sans-serif",
        fontSize: 13,
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: "#fff",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          height: 760,
          boxShadow: "0 0 0 1px rgba(15,23,36,.06)",
          overflow: "hidden",
        }}
      >
        <SessionStage sessionKey="t1" title="股权转让协议审查" items={ITEMS}>
          <div style={{ padding: 20, overflowY: "auto" }}>
            <div
              style={{
                maxWidth: 560,
                marginLeft: "auto",
                background: "#0078d4",
                color: "#fff",
                borderRadius: "14px 14px 4px 14px",
                padding: "9px 14px",
                marginBottom: 16,
              }}
            >
              帮我审查这份股权转让协议，重点看付款、交割、违约责任和工商变更风险。
            </div>
            <div style={{ maxWidth: 680, lineHeight: 1.65 }}>
              <p>
                已完成第一轮审查。最需要先处理的是<b>付款顺序和工商变更条件不一致</b>
                ，可能导致买方付款后无法完成股权登记。
              </p>
              <TurnSourceSummary text={AI_TEXT} />
            </div>
          </div>
        </SessionStage>
      </div>

      <div
        style={{
          width: 344,
          flexShrink: 0,
          background: "#fff",
          borderRadius: 16,
          height: 760,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 0 0 1px rgba(15,23,36,.06)",
          overflow: "hidden",
        }}
      >
        <div style={{ borderBottom: "1px solid rgba(15,23,36,.08)", padding: "6px 8px 0" }}>
          <FanBoxPanelTabs active={tab} onSelect={setTab} visibleTabs={{}} />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {tab === "evidence" && <EvidencePanel items={ITEMS} />}
          {tab === "activity" && (
            <LogsPanel onToggleTerminal={() => {}}>
              <div style={{ padding: 12, color: "rgba(17,20,28,.5)", fontSize: 12 }}>
                （activity 面板内容嵌入处）
              </div>
            </LogsPanel>
          )}
          {tab !== "evidence" && tab !== "activity" && (
            <div style={{ padding: 16, color: "rgba(17,20,28,.5)", fontSize: 12 }}>
              （{tab} 面板：复用现有组件，此处省略）
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Preview />);
