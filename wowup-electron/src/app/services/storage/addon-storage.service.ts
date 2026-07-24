import { Injectable } from "@angular/core";
import { Addon } from "wowup-lib-core";

import {
  IPC_ADDONS_GET_ALL,
  IPC_ADDONS_GET_ALL_FOR_INSTALLATION,
  IPC_ADDONS_GET_ALL_FOR_PROVIDER,
  IPC_ADDONS_GET_AUTO_UPDATE_ENABLED,
  IPC_ADDONS_GET_AVAILABLE_FOR_UPDATE,
  IPC_ADDONS_GET_BY_EXTERNAL_ID,
  IPC_ADDONS_GET_BY_EXTERNAL_IDS,
  IPC_ADDONS_SAVE_ALL,
  ADDON_STORE_NAME,
  IPC_STORE_SET_OBJECT,
  IPC_STORE_GET_OBJECT,
  IPC_STORE_REMOVE_OBJECT,
} from "../../../common/constants";
import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class AddonStorageService {
  public constructor(private _electronService: ElectronService) {}

  public saveAll(addons: Addon[]): Promise<void> {
    console.debug(`[addon-storage] save all: ${addons?.length ?? 0}`);
    return this._electronService.invoke(IPC_ADDONS_SAVE_ALL, addons);
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

  public getAll(): Promise<Addon[]> {
    return this._electronService.invoke(IPC_ADDONS_GET_ALL);
  }

  public getAllForInstallationIdAsync(installationId: string): Promise<Addon[]> {
    return this._electronService.invoke(IPC_ADDONS_GET_ALL_FOR_INSTALLATION, installationId);
  }

  public getAllForProviderAsync(providerName: string): Promise<Addon[]> {
    return this._electronService.invoke(IPC_ADDONS_GET_ALL_FOR_PROVIDER, providerName);
  }

  public getByExternalIdAsync(externalId: string, providerName: string, installationId: string): Promise<Addon | undefined> {
    return this._electronService.invoke(IPC_ADDONS_GET_BY_EXTERNAL_ID, externalId, providerName, installationId);
  }

  public getByExternalIds(externalIds: string[]): Promise<Addon[]> {
    return this._electronService.invoke(IPC_ADDONS_GET_BY_EXTERNAL_IDS, externalIds);
  }

  public getAvailableForUpdate(installationId?: string): Promise<Addon[]> {
    return this._electronService.invoke(IPC_ADDONS_GET_AVAILABLE_FOR_UPDATE, installationId);
  }

  public getAutoUpdateEnabled(): Promise<Addon[]> {
    return this._electronService.invoke(IPC_ADDONS_GET_AUTO_UPDATE_ENABLED);
  }
}
