import { useTranslation } from "react-i18next";
import type { BrowserEvidenceViewModel } from "../evidence";
import type { TaskRunBrowserEvidenceRef } from "../../tasks/types";
import {
  buildBrowserEvidenceViewModel,
  buildBrowserEvidenceViewModelFromTaskRunEvidence,
} from "../evidence";
import type { BrowserContextAttachment } from "../types";

export type BrowserEvidencePanelProps = {
  attachment?: BrowserContextAttachment | null;
  taskRunEvidence?: TaskRunBrowserEvidenceRef | null;
};

function resolveViewModel({
  attachment,
  taskRunEvidence,
}: BrowserEvidencePanelProps): BrowserEvidenceViewModel | null {
  if (attachment) {
    return buildBrowserEvidenceViewModel(attachment);
  }
  if (taskRunEvidence) {
    return buildBrowserEvidenceViewModelFromTaskRunEvidence(taskRunEvidence);
  }
  return null;
}

export function BrowserEvidencePanel(props: BrowserEvidencePanelProps) {
  const { t } = useTranslation();
  const viewModel = resolveViewModel(props);
  const title = t("browserAgent.evidencePanel.title", "Browser evidence");
  if (!viewModel) {
    return null;
  }
  return (
    <section className="browser-evidence-panel" data-state={viewModel.observationState}>
      <header className="browser-evidence-panel-header">
        <span>{title === "browserAgent.evidencePanel.title" ? "Browser evidence" : title}</span>
        <span>{viewModel.observationState}</span>
      </header>
      <div className="browser-evidence-panel-section">
        <strong>{viewModel.overview.title}</strong>
        {viewModel.overview.items.map((item, index) => (
          <p key={`overview-${index}`}>{item}</p>
        ))}
      </div>
      {viewModel.codeCandidates.items.length > 0 ? (
        <div className="browser-evidence-panel-section">
          <strong>{viewModel.codeCandidates.title}</strong>
          {viewModel.codeCandidates.items.map((item, index) => (
            <p key={`candidate-${index}`}>{item}</p>
          ))}
        </div>
      ) : null}
      {viewModel.diagnostics.items.length > 0 ? (
        <div className="browser-evidence-panel-section">
          <strong>{viewModel.diagnostics.title}</strong>
          {viewModel.diagnostics.items.map((item, index) => (
            <p key={`diagnostic-${index}`}>{item}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
