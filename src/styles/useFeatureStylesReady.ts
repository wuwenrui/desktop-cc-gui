import { useEffect, useState } from "react";

type FeatureStylesLoader = () => Promise<void>;

function isTestMode() {
  try {
    return import.meta.env.MODE === "test";
  } catch {
    return false;
  }
}

export function useFeatureStylesReady(loadStyles: FeatureStylesLoader, enabled = true) {
  const [stylesReady, setStylesReady] = useState(() => isTestMode() && enabled);

  useEffect(() => {
    if (isTestMode()) {
      setStylesReady(enabled);
      return;
    }
    if (!enabled) {
      setStylesReady(false);
      return;
    }

    let cancelled = false;
    setStylesReady(false);

    loadStyles()
      .then(() => {
        if (!cancelled) {
          setStylesReady(true);
        }
      })
      .catch((error) => {
        console.error("[feature-styles] failed to load feature styles:", error);
        if (!cancelled) {
          setStylesReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, loadStyles]);

  return stylesReady;
}
