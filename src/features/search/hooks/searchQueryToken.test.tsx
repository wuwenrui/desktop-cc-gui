// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createInitialQueryToken,
  discardIfStale,
  isQueryTokenStale,
  useSearchQueryToken,
} from "./searchQueryToken";

describe("createInitialQueryToken", () => {
  it("starts at token 0 with the given query", () => {
    const token = createInitialQueryToken("hello");
    expect(token.token).toBe(0);
    expect(token.query).toBe("hello");
    expect(token.bumpKey).toBe(0);
  });

  it("preserves the supplied bumpKey", () => {
    const token = createInitialQueryToken("hi", "palette-2");
    expect(token.bumpKey).toBe("palette-2");
  });
});

describe("isQueryTokenStale", () => {
  it("returns false when tokens match", () => {
    const current = createInitialQueryToken("a");
    expect(isQueryTokenStale(current, { ...current })).toBe(false);
  });

  it("returns true when the captured token is behind", () => {
    const current = createInitialQueryToken("a");
    const captured = { ...current, token: 0 };
    current.token = 5;
    expect(isQueryTokenStale(current, captured)).toBe(true);
  });
});

describe("useSearchQueryToken", () => {
  it("returns a ref whose current value is the initial token", () => {
    const { result } = renderHook(() => useSearchQueryToken("hello"));
    expect(result.current.current.token).toBe(0);
    expect(result.current.current.query).toBe("hello");
  });

  it("advances the token when query changes", () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useSearchQueryToken(query),
      { initialProps: { query: "a" } },
    );
    const firstToken = result.current.current.token;
    act(() => {
      rerender({ query: "b" });
    });
    expect(result.current.current.token).toBe(firstToken + 1);
    expect(result.current.current.query).toBe("b");
  });

  it("does not advance the token when neither query nor bumpKey change", () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useSearchQueryToken(query),
      { initialProps: { query: "a" } },
    );
    const firstToken = result.current.current.token;
    act(() => {
      rerender({ query: "a" });
    });
    expect(result.current.current.token).toBe(firstToken);
  });

  it("advances the token when bumpKey changes even if query is identical", () => {
    const { result, rerender } = renderHook(
      ({ bumpKey }: { bumpKey: number }) =>
        useSearchQueryToken("a", bumpKey),
      { initialProps: { bumpKey: 1 } },
    );
    const firstToken = result.current.current.token;
    act(() => {
      rerender({ bumpKey: 2 });
    });
    expect(result.current.current.token).toBe(firstToken + 1);
    expect(result.current.current.query).toBe("a");
    expect(result.current.current.bumpKey).toBe(2);
  });

  it("preserves the latest token across multiple rerenders", () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useSearchQueryToken(query),
      { initialProps: { query: "a" } },
    );
    act(() => {
      rerender({ query: "b" });
    });
    act(() => {
      rerender({ query: "c" });
    });
    act(() => {
      rerender({ query: "d" });
    });
    expect(result.current.current.token).toBe(3);
    expect(result.current.current.query).toBe("d");
  });
});

describe("discardIfStale", () => {
  it("returns the value untouched when the captured token is current", () => {
    const token = createInitialQueryToken("a");
    const out = discardIfStale(token, { ...token }, ["r1"]);
    expect(out.value).toEqual(["r1"]);
    expect(out.staleDropped).toBe(false);
  });

  it("flags the result stale when the current token has moved on", () => {
    const captured = createInitialQueryToken("a");
    const current: typeof captured = { ...captured, token: 5 };
    const out = discardIfStale(current, captured, ["r1"]);
    expect(out.staleDropped).toBe(true);
    expect(out.value).toEqual(["r1"]);
  });
});
