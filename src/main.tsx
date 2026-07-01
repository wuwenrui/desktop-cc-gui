import { startApp } from "./bootstrapApp";
import { installRendererLifecycleDiagnostics } from "./services/rendererDiagnostics";
import {
  isReactScanStartupEnabled,
  startReactScanOverlay,
} from "./services/reactScanController";

installRendererLifecycleDiagnostics();

// react-scan render-profiling overlay. It can be toggled from the settings page and is
// persisted; the dev env var VITE_ENABLE_REACT_SCAN also auto-enables it. When enabled,
// load + start the overlay before the first render so it instruments cleanly, then start
// the app regardless of whether react-scan finished loading. When disabled, the normal
// startup path stays synchronous and unchanged.
if (isReactScanStartupEnabled()) {
  void startReactScanOverlay().finally(() => {
    void startApp();
  });
} else {
  void startApp();
}
