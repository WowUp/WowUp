import { app, BrowserWindow, Menu, nativeImage, Tray } from "electron";
import * as path from "path";
import * as platform from "./platform";
import { SystemTrayConfig } from "./src/common/wowup/system-tray-config";

let _trayRef: Tray;

export function createTray(config: SystemTrayConfig): boolean {
  _trayRef?.destroy();

  console.log("Creating tray");
  const win = BrowserWindow.getFocusedWindow();
  const trayIconPath = path.join(__dirname, "assets", "wowup_logo_512np.png");
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 16 });

  _trayRef = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: app.name,
      type: "normal",
      icon: icon,
      enabled: false,
    },
    {
      label: config.showLabel || "Show",
      click: () => {
        win.show();

        if (platform.isMac) {
          app.dock.show();
        }
      },
    },
    {
      label: config.quitLabel || "Quit",
      role: "quit",
    },
  ]);

  if (platform.isWin) {
    _trayRef.on("click", () => {
      win.show();
    });
  }

  _trayRef.setToolTip("WowUp");
  _trayRef.setContextMenu(contextMenu);

  return true;
}
