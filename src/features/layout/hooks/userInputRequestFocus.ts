import type { RequestUserInputRequest } from "../../../types";

export function focusUserInputRequestCard(request: RequestUserInputRequest) {
  if (typeof document === "undefined") {
    return false;
  }
  const candidates = document.querySelectorAll<HTMLElement>("[data-request-user-input-id]");
  const card = Array.from(candidates).find(
    (candidate) =>
      candidate.dataset.requestUserInputId === String(request.request_id) &&
      candidate.dataset.workspaceId === request.workspace_id &&
      candidate.dataset.threadId === request.params.thread_id,
  );
  if (!card) {
    return false;
  }
  card.scrollIntoView({ block: "center", behavior: "smooth" });
  card.focus({ preventScroll: true });
  return true;
}
