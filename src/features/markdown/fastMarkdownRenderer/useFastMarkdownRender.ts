import { useEffect, useRef, useState } from "react";
import { compileFastMarkdownWithWorkerFallback } from "./workerAdapter";
import { resolveFastMarkdownProfileInputs, resolveFastMarkdownRendererProfile } from "./resolveProfile";
import type {
  FastMarkdownFeatureFlags,
  FastMarkdownRendererProfileId,
  FastMarkdownRenderResult,
} from "./types";

export type UseFastMarkdownRenderArgs = {
  documentKey: string;
  rawMarkdown: string;
  featureFlags: FastMarkdownFeatureFlags;
  /**
   * Caller-supplied profile override. When `undefined`, the hook
   * resolves a profile from `featureFlags` + document size. The
   * value `"rich-react"` is a sentinel: the hook returns
   * `shouldFallback: true` and the consumer keeps the legacy
   * ReactMarkdown path.
   */
  rendererProfile?: FastMarkdownRendererProfileId;
  boundedLineLimit?: number;
};

export type UseFastMarkdownRenderResult = {
  result: FastMarkdownRenderResult | null;
  status: "idle" | "pending" | "ready" | "fallback";
  resolvedProfile: FastMarkdownRendererProfileId;
  error: Error | null;
  shouldFallback: boolean;
};

const IDLE_RESULT: UseFastMarkdownRenderResult = {
  result: null,
  status: "idle",
  resolvedProfile: "rich-react",
  error: null,
  // IDLE means "compile has not been attempted yet" — it is NOT a
  // fallback signal. Callers should keep the fast path mounted so the
  // hook can transition into "pending" (or "fallback" if the resolved
  // profile is a rich one) on its first effect tick. Setting this to
  // `true` here would cause wrappers that consume the hook to flip
  // straight to the rich path on mount, before the compile even
  // starts, defeating the purpose of the opt-in.
  shouldFallback: false,
};

export function useFastMarkdownRender(
  args: UseFastMarkdownRenderArgs,
): UseFastMarkdownRenderResult {
  const [state, setState] = useState<UseFastMarkdownRenderResult>(IDLE_RESULT);
  const requestOrdinalRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    requestOrdinalRef.current += 1;
    const requestOrdinal = requestOrdinalRef.current;
    const inputs = resolveFastMarkdownProfileInputs({
      rawMarkdown: args.rawMarkdown,
      featureFlags: args.featureFlags,
      boundedLineLimit: args.boundedLineLimit,
    });
    const resolved = args.rendererProfile ?? resolveFastMarkdownRendererProfile(inputs);

    if (resolved === "rich-react" || resolved === "low-cost-readable") {
      setState({
        result: null,
        status: "fallback",
        resolvedProfile: resolved,
        error: null,
        shouldFallback: true,
      });
      return () => {
        cancelled = true;
      };
    }

    setState((previous) => ({
      result: previous.resolvedProfile === resolved ? previous.result : null,
      status: "pending",
      resolvedProfile: resolved,
      error: null,
      shouldFallback: false,
    }));

    compileFastMarkdownWithWorkerFallback({
      documentKey: args.documentKey,
      rawMarkdown: args.rawMarkdown,
      rendererProfile: resolved,
      featureFlags: args.featureFlags,
      options: { lineLimit: args.boundedLineLimit },
    })
      .then((result) => {
        if (cancelled || requestOrdinal !== requestOrdinalRef.current) {
          return;
        }
        if (result.diagnostics.fallbackReason !== "none") {
          setState({
            result: null,
            status: "fallback",
            resolvedProfile: resolved,
            error: new Error(
              `Fast renderer fallback: ${result.diagnostics.fallbackReason}`,
            ),
            shouldFallback: true,
          });
          return;
        }
        setState({
          result,
          status: "ready",
          resolvedProfile: resolved,
          error: null,
          shouldFallback: false,
        });
      })
      .catch((error: unknown) => {
        if (cancelled || requestOrdinal !== requestOrdinalRef.current) {
          return;
        }
        setState({
          result: null,
          status: "fallback",
          resolvedProfile: resolved,
          error: error instanceof Error ? error : new Error(String(error)),
          shouldFallback: true,
        });
      });

    return () => {
      cancelled = true;
    };
    // The two flag booleans below are the only fields that affect the
    // render profile; the rest of `args.featureFlags` is intentionally
    // ignored so transient snapshot objects don't retrigger the compile
    // pipeline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    args.documentKey,
    args.rawMarkdown,
    args.rendererProfile,
    args.boundedLineLimit,
    args.featureFlags.fastHtmlRendererEnabled,
    args.featureFlags.boundedFastHtmlRendererEnabled,
  ]);

  return state;
}
