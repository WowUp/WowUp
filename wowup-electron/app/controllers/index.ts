import { app, BrowserWindow } from "electron";
import * as Store from "electron-store";
import * as log from "electron-log/main";

import { AddonController } from "./addon.controller";
import { WagoAdsController } from "./wago-ads.controller";
import { IpcController } from "./ipc-controller";
import { MetricsController } from "./metrics/metrics.controller";
import { AddonScanController } from "./scan/addon-scan.controller";
import { TocController } from "./toc/toc.controller";
import { WarcraftController } from "./warcraft/warcraft.controller";
import { WarcraftInstallationController } from "./warcraft/warcraft-installation.controller";
import { TocService } from "../services/toc/toc.service";
import { WagoAdViewService } from "../services/ads/wago-ad-view.service";
import { WagoCmpWindowService } from "../services/ads/wago-cmp-window.service";
import { ProcessMetricsService } from "../services/metrics/process-metrics";
import { getWebContentsLabels } from "../services/metrics/web-contents-labels";
import { sampleWindow } from "../services/metrics/window-sample";
import { AddonScanService } from "../services/scan/addon-scan.service";
import { nodeHashAlgorithms } from "../services/scan/hash-algorithms";
import { WarcraftPlatformWin } from "../services/warcraft/warcraft-platform.win";
import { WarcraftPlatformMac } from "../services/warcraft/warcraft-platform.mac";
import { WarcraftPlatformLinux } from "../services/warcraft/warcraft-platform.linux";
import { WarcraftPlatform } from "../services/warcraft/warcraft-platform.service";
import { AppEnv } from "../env/environment";
import * as platform from "../platform";

export interface ControllerDeps {
  window: BrowserWindow;
  addonStore: Store;
  preferenceStore: Store;
}

function getPlatformImpl(): WarcraftPlatform {
  if (platform.isWin) return new WarcraftPlatformWin();
  if (platform.isMac) return new WarcraftPlatformMac();
  if (platform.isLinux) return new WarcraftPlatformLinux();
  throw new Error("Unsupported platform");
}

/**
 * Composition root for the main process.
 *
 * Controllers are ipc adapters and nothing else: everything they need is built here and handed to
 * them, so what talks to what is answerable by reading this function. Note that this runs per
 * window, not once per app — `createWindow` can run again — so anything built here lives and dies
 * with that window.
 */
export function registerControllers(deps: ControllerDeps): void {
  const tocService = new TocService();

  const metricsService = new ProcessMetricsService({
    getAppMetrics: () => app.getAppMetrics(),
    getWindowSample: () => sampleWindow(deps.window),
    getProcessLabels: () => getWebContentsLabels(),
    flavor: AppEnv.buildFlavor,
    log,
  });

  const controllers: IpcController[] = [
    new AddonController(deps.addonStore),
    new WarcraftController(getPlatformImpl(), deps.preferenceStore, tocService),
    new WarcraftInstallationController(deps.preferenceStore),
    new TocController(tocService),
    new AddonScanController(new AddonScanService({ hashes: nodeHashAlgorithms, log }), () =>
      metricsService.logRendererMemory("renderers after scan"),
    ),
    // Registered on every flavor on purpose: a resource report is only actionable if the ow numbers
    // can be held against the wago ones.
    new MetricsController(metricsService),
  ];

  // The overwolf flavor renders its ad through the overwolf sdk.
  if (AppEnv.buildFlavor === "wago") {
    const adView = new WagoAdViewService(deps.window);
    const cmpWindow = new WagoCmpWindowService(deps.window, (visible) => adView.setCmpOpen(visible));
    controllers.push(new WagoAdsController(deps.window, adView, cmpWindow));
  }

  for (const controller of controllers) {
    controller.register();
  }

  // One teardown path for the whole set, rather than each controller hand-rolling its own listener.
  deps.window.once("closed", () => {
    for (const controller of controllers) {
      try {
        controller.dispose?.();
      } catch (e) {
        log.error("[controllers] failed to dispose a controller", e);
      }
    }
  });
}
