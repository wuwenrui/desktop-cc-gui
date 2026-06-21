import { queryTurnReconciliationStatus } from "../../../services/tauri";
import type {
  TurnReconciliationStatusRequest,
  TurnReconciliationStatusResponse,
} from "../../../types";

const THREE_EVIDENCE_RECONCILIATION_QUERY_TIMEOUT_MS = 15_000;

export function queryTurnReconciliationStatusWithTimeout(
  request: TurnReconciliationStatusRequest,
): Promise<TurnReconciliationStatusResponse> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `three-evidence reconciliation status query timed out after ${THREE_EVIDENCE_RECONCILIATION_QUERY_TIMEOUT_MS}ms`,
        ),
      );
    }, THREE_EVIDENCE_RECONCILIATION_QUERY_TIMEOUT_MS);
  });
  return Promise.race([
    queryTurnReconciliationStatus(request),
    timeoutPromise,
  ]).finally(() => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  });
}
