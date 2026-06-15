import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

function readCurrentWindowLabel(defaultLabel: string) {
  try {
    const window = getCurrentWindow();
    return window.label ?? defaultLabel;
  } catch {
    return defaultLabel;
  }
}

export function useWindowLabel(defaultLabel = "main") {
  const [label, setLabel] = useState(() => readCurrentWindowLabel(defaultLabel));

  useEffect(() => {
    setLabel(readCurrentWindowLabel(defaultLabel));
  }, [defaultLabel]);

  return label;
}
