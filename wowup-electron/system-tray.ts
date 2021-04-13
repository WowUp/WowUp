import { app, BrowserWindow, Menu, nativeImage, Tray } from "electron";
import * as log from "electron-log";
import * as path from "path";

import * as platform from "./platform";
import { WOWUP_LOGO_FILENAME, WOWUP_LOGO_MAC_SYSTEM_TRAY } from "./src/common/constants";
import { SystemTrayConfig } from "./src/common/wowup/models";

let _trayRef: Tray;

export function createTray(window: BrowserWindow, config: SystemTrayConfig): boolean {
  _trayRef?.destroy();

  console.log("Creating tray");
  const trayIconFile = platform.isMac ? WOWUP_LOGO_MAC_SYSTEM_TRAY : WOWUP_LOGO_FILENAME;
  const trayIconPath = path.join(__dirname, "assets", trayIconFile);
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 16 });

  _trayRef = new Tray(trayIconPath);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: app.name,
      type: "normal",
      enabled: false,
    },
    {
      label: config.showLabel || "Show",
      click: () => {
        restoreWindow(window);
      },
    },
    // Removing this for now per discussion with zak
    // {
    //   label: config.showLabel || "Check for Updates...",
    //   click: () => {
    //     checkForUpdates(window);
    //   },
    // },
    {
      label: config.quitLabel || "Quit",
      role: "quit",
    },
  ]);

  if (platform.isWin) {
    _trayRef.on("click", () => {
      restoreWindow(window);
    });
  }

  _trayRef.setToolTip("WowUp");
  _trayRef.setContextMenu(contextMenu);

  return true;
}

export function restoreWindow(window: BrowserWindow): void {
  window?.show();
  window?.setSkipTaskbar(false);

  if (platform.isMac) {
    app.dock.show().catch((e) => log.error(`Failed to show on Mac dock`, e));
  }
}
