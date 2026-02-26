import { ipcMain } from "electron";
import * as Store from "electron-store";
import * as log from "electron-log/main";
import { Addon } from "wowup-lib-core";

import { IPC_ADDONS_SAVE_ALL } from "../../src/common/constants";
import { IpcController } from "./ipc-controller";

export class AddonController implements IpcController {
  public constructor(private readonly addonStore: Store) {}

  public register(): void {
    ipcMain.handle(IPC_ADDONS_SAVE_ALL, (_evt, addons: Addon[]) => this.saveAll(addons));
  }

  private saveAll(addons: Addon[]): void {
    if (!Array.isArray(addons)) {
      return;
    }

    for (const addon of addons) {
      if (typeof addon.id !== "string") {
        log.warn("malformed addon not saved", addon);
        continue;
      }

      this.addonStore.set(addon.id, addon);
    }
  }
}
