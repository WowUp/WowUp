import { BrowserWindow } from "electron";
import * as Store from "electron-store";

import { AddonController } from "./addon.controller";
import { IpcController } from "./ipc-controller";

export interface ControllerDeps {
  window: BrowserWindow;
  addonStore: Store;
}

export function registerControllers(deps: ControllerDeps): void {
  const controllers: IpcController[] = [
    new AddonController(deps.addonStore),
    // Add new controllers here as domains grow
  ];

  for (const controller of controllers) {
    controller.register();
  }
}
