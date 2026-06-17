import type { RequestUserInputRequest } from "../../../types";

function scrollCardIntoMessagesView(card: HTMLElement, scroller: HTMLElement) {
  const scrollerRect = scroller.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const targetTop =
    scroller.scrollTop +
    (cardRect.top - scrollerRect.top) -
    scroller.clientHeight / 2 +
    cardRect.height / 2;
  const nextTop = Math.max(0, targetTop);
  if (typeof scroller.scrollTo === "function") {
    scroller.scrollTo({
      left: 0,
      top: nextTop,
      behavior: "smooth",
    });
  } else {
    scroller.scrollTop = nextTop;
    scroller.scrollLeft = 0;
  }
  scroller.scrollLeft = 0;
}

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
  const messagesScroller =
    card.closest<HTMLElement>(".messages") ??
    document.querySelector<HTMLElement>(".messages");
  if (messagesScroller) {
    scrollCardIntoMessagesView(card, messagesScroller);
  } else {
    card.scrollIntoView({ block: "center", behavior: "smooth", inline: "start" });
  }
  card.focus({ preventScroll: true });
  return true;
}
