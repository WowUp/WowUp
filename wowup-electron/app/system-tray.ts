import { app, BrowserWindow, Menu, Tray } from "electron";
import * as path from "path";

import { WOWUP_LOGO_FILENAME, WOWUP_LOGO_MAC_SYSTEM_TRAY } from "../src/common/constants";
import { SystemTrayConfig } from "../src/common/wowup/models";
import * as platform from "./platform";
import { restoreWindow } from "./window-state";

let _trayRef: Tray;

export function createTray(window: BrowserWindow, config: SystemTrayConfig): boolean {
  _trayRef?.destroy();

  console.log("Creating tray");
  const trayIconFile = platform.isMac ? WOWUP_LOGO_MAC_SYSTEM_TRAY : WOWUP_LOGO_FILENAME;
  const trayIconPath = path.join(__dirname, "..", "assets", trayIconFile);

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
