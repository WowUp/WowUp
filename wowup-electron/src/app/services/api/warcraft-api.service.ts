import { Injectable } from "@angular/core";

import {
  IPC_WARCRAFT_GET_ADDON_FOLDER,
  IPC_WARCRAFT_GET_BLIZZARD_AGENT_PATH,
  IPC_WARCRAFT_GET_CLIENT_TYPE_FOR_BINARY,
  IPC_WARCRAFT_GET_EXECUTABLE_EXTENSION,
  IPC_WARCRAFT_GET_EXECUTABLE_NAME,
  IPC_WARCRAFT_GET_INSTALLED_PRODUCTS,
  IPC_WARCRAFT_IS_WOW_APPLICATION,
  IPC_WARCRAFT_LIST_ADDONS,
} from "../../../common/constants";
import { AddonFolder, InstalledProduct, WowClientType } from "wowup-lib-core";

import { ElectronService } from "../electron/electron.service";

@Injectable({
  providedIn: "root",
})
export class WarcraftApiService {
  public constructor(private readonly _electronService: ElectronService) {}

  public getBlizzardAgentPath(): Promise<string> {
    return this._electronService.invoke(IPC_WARCRAFT_GET_BLIZZARD_AGENT_PATH);
  }

  public getInstalledProducts(agentPath: string): Promise<Map<WowClientType, InstalledProduct>> {
    return this._electronService.invoke(IPC_WARCRAFT_GET_INSTALLED_PRODUCTS, agentPath);
  }

  public getExecutableName(clientType: WowClientType): Promise<string> {
    return this._electronService.invoke(IPC_WARCRAFT_GET_EXECUTABLE_NAME, clientType);
  }

  public getClientTypeForBinary(binaryPath: string): Promise<WowClientType> {
    return this._electronService.invoke(IPC_WARCRAFT_GET_CLIENT_TYPE_FOR_BINARY, binaryPath);
  }

  public isWowApplication(appName: string): Promise<boolean> {
    return this._electronService.invoke(IPC_WARCRAFT_IS_WOW_APPLICATION, appName);
  }

  public getExecutableExtension(): Promise<string> {
    return this._electronService.invoke(IPC_WARCRAFT_GET_EXECUTABLE_EXTENSION);
  }

  public listAddons(addonFolderPath: string, scanSymlinks = false): Promise<AddonFolder[]> {
    return this._electronService.invoke(IPC_WARCRAFT_LIST_ADDONS, addonFolderPath, scanSymlinks);
  }

  public getAddonFolder(addonFolderPath: string, dir: string): Promise<AddonFolder | undefined> {
    return this._electronService.invoke(IPC_WARCRAFT_GET_ADDON_FOLDER, addonFolderPath, dir);
  }
}
