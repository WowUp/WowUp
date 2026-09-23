import { BrowserWindow } from "electron";

import { WindowSample } from "../../../src/common/models/process-metrics";

/**
 * Describes where a window is for a metrics sample. Kept out of the metrics service so that service
 * stays free of electron and testable without it, and out of the controller so the service can be
 * built without one.
 */
export function sampleWindow(window: BrowserWindow): WindowSample | undefined {
  if (window.isDestroyed()) {
    return undefined;
  }

  return {
    visible: window.isVisible(),
    minimized: window.isMinimized(),
    focused: window.isFocused(),
  };
}
