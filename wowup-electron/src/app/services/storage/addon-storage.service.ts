import { Injectable } from "@angular/core";

import {
  IPC_ADDONS_SAVE_ALL,
  ADDON_STORE_NAME,
  IPC_STORE_SET_OBJECT,
  IPC_STORE_GET_OBJECT,
  IPC_STORE_REMOVE_OBJECT,
  IPC_STORE_GET_ALL,
} from "../../../common/constants";
import { Addon } from "../../../common/entities/addon";
import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class AddonStorageService {
  public constructor(private _electronService: ElectronService) {}
  private async getStore(): Promise<Addon[]> {
    return await this._electronService.invoke(IPC_STORE_GET_ALL, ADDON_STORE_NAME);
  }

  public async queryAsync<T>(action: (store: Addon[]) => T): Promise<T> {
    const store = await this.getStore();
    return action(store);
  }

  public async queryAllAsync(action: (item: Addon) => boolean): Promise<Addon[]> {
    const addons: Addon[] = [];
    const store = await this.getStore();
    for (const addon of store) {
      if (action(addon)) {
        addons.push(addon);
      }
    }

    return addons;
  }

  public async saveAll(addons: Addon[]): Promise<void> {
    console.debug(`[addon-storage] save all: ${addons?.length ?? 0}`);
    await this._electronService.invoke(IPC_ADDONS_SAVE_ALL, addons);
  }

  public setAsync(key: string | undefined, value: Addon): Promise<void> {
    if (!key) {
      return Promise.resolve(undefined);
    }

    return this._electronService.invoke(IPC_STORE_SET_OBJECT, ADDON_STORE_NAME, key, value);
  }

  public get(key: string): Promise<Addon> {
    return this._electronService.invoke(IPC_STORE_GET_OBJECT, ADDON_STORE_NAME, key);
  }

  public async removeAllAsync(...addons: Addon[]): Promise<void> {
    for (const addon of addons) {
      await this.removeAsync(addon);
    }
  }

  public async removeAsync(addon: Addon): Promise<void> {
    if (addon.id) {
      await this._electronService.invoke(IPC_STORE_REMOVE_OBJECT, ADDON_STORE_NAME, addon.id);
    }
  }

  public async removeAllForInstallationAsync(installationId: string): Promise<void> {
    const addons = await this.getAllForInstallationIdAsync(installationId);
    await this.removeAllAsync(...addons);
  }

  public async getByExternalIdAsync(
    externalId: string,
    providerName: string,
    installationId: string
  ): Promise<Addon | undefined> {
    const addons: Addon[] = [];
    const store = await this.getStore();

    for (const addon of store) {
      if (
        addon.installationId === installationId &&
        addon.externalId === externalId &&
        addon.providerName === providerName
      ) {
        addons.push(addon);
        break;
      }
    }

    return addons[0];
  }

  public async getAll(): Promise<Addon[]> {
    return await this.getStore();
  }

  public async getAllForInstallationIdAsync(
    installationId: string,
    validator?: (addon: Addon) => boolean
  ): Promise<Addon[]> {
    const addons: Addon[] = [];
    const store = await this.getStore();

    for (const addon of store) {
      if (addon.installationId === installationId && (!validator || validator(addon))) {
        addons.push(addon);
      }
    }

    return addons;
  }

  public async getAllForProviderAsync(providerName: string, validator?: (addon: Addon) => boolean): Promise<Addon[]> {
    const addons: Addon[] = [];
    const store = await this.getStore();

    for (const addon of store) {
      if (addon.providerName === providerName && (!validator || validator(addon))) {
        addons.push(addon);
      }
    }

    return addons;
  }
}
