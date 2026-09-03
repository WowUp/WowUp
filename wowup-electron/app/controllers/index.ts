import { BrowserWindow } from "electron";
import * as Store from "electron-store";

import { AddonController } from "./addon.controller";
import { IpcController } from "./ipc-controller";
import { WarcraftController } from "./warcraft/warcraft.controller";
import { WarcraftInstallationController } from "./warcraft/warcraft-installation.controller";
import { WarcraftPlatformWin } from "../services/warcraft/warcraft-platform.win";
import { WarcraftPlatformMac } from "../services/warcraft/warcraft-platform.mac";
import { WarcraftPlatformLinux } from "../services/warcraft/warcraft-platform.linux";
import { WarcraftPlatform } from "../services/warcraft/warcraft-platform.service";
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

export function registerControllers(deps: ControllerDeps): void {
  const controllers: IpcController[] = [
    new AddonController(deps.addonStore),
    new WarcraftController(getPlatformImpl(), deps.preferenceStore),
    new WarcraftInstallationController(deps.preferenceStore),
  ];

  for (const controller of controllers) {
    controller.register();
  }
}
