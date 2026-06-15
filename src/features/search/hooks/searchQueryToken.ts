import { useRef } from "react";

// Search query token: monotonic counter bumped on every query change. Used
// to detect stale async work. Synchronous consumers can also use it to
// decide whether to discard a result that was computed under an old
// dependency snapshot.
//
// The token MUST be advanced before any deferred or async work starts, so
// that "I started computing under token N" can later be compared to "the
// current token is M > N" to mark the result stale.
export type SearchQueryTokenState = {
  token: number;
  query: string;
  // Optional secondary key. When the caller bumps this (e.g. number of
  // times the palette was opened), the token advances even if `query` did
  // not change, so "reopen palette" is treated as a fresh query.
  bumpKey: number | string;
  // When the latest token was issued. Diagnostic only.
  updatedAt: number;
};

export function createInitialQueryToken(
  query: string,
  bumpKey: number | string = 0,
): SearchQueryTokenState {
  return {
    token: 0,
    query,
    bumpKey,
    updatedAt: typeof performance !== "undefined" ? performance.now() : 0,
  };
}

export function isQueryTokenStale(
  current: SearchQueryTokenState,
  captured: SearchQueryTokenState,
): boolean {
  return captured.token !== current.token;
}

// useSearchQueryToken wires a `useRef<SearchQueryTokenState>` to the
// `query` and `bumpKey` props. When either changes, the ref is advanced
// during render, before downstream memo/effect code can capture stale work.
//
// The hook is intentionally minimal: it does not touch React state and does
// not retain anything beyond the latest token. A consumer that wants to gate
// async work should read `ref.current` at the moment the work starts and
// re-check it before the result is committed.
//
// The returned ref is a `useRef` value, so it is identity-stable across
// renders. It is safe to list it as a dep of a `useMemo` / `useEffect`
// without causing spurious re-runs. The token advance is observed via
// `ref.current` reads, not via dep changes.
export function useSearchQueryToken(
  query: string,
  bumpKey: number | string = 0,
): React.MutableRefObject<SearchQueryTokenState> {
  const ref = useRef<SearchQueryTokenState>(
    createInitialQueryToken(query, bumpKey),
  );

  const previous = ref.current;
  if (previous.query !== query || previous.bumpKey !== bumpKey) {
    ref.current = {
      token: previous.token + 1,
      query,
      bumpKey,
      updatedAt:
        typeof performance !== "undefined" ? performance.now() : Date.now(),
    };
  }

  return ref;
}

// Result of the discardIfStale gate. Callers MUST check `staleDropped` and
// decide whether to keep the result or fall back to a stable reference.
export type StaleGuardResult<T> = {
  value: T;
  staleDropped: boolean;
  captured: SearchQueryTokenState;
};

// Gate a computed value against the latest token. If the captured token is
// behind the current one, the result is marked stale and the caller is
// expected to fall back to the previous stable value.
//
// Pure function. The caller is responsible for passing both the captured
// token (taken at the start of the work) and the current token (read from
// the ref just before commit).
export function discardIfStale<T>(
  current: SearchQueryTokenState,
  captured: SearchQueryTokenState,
  value: T,
): StaleGuardResult<T> {
  return {
    value,
    staleDropped: isQueryTokenStale(current, captured),
    captured,
  };
}
