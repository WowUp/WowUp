import * as Store from "electron-store";

import {
  BLIZZARD_AGENT_PATH_KEY,
  IPC_WARCRAFT_GET_ADDON_FOLDER,
  IPC_WARCRAFT_GET_BLIZZARD_AGENT_PATHS,
  IPC_WARCRAFT_GET_CLIENT_TYPE_FOR_BINARY,
  IPC_WARCRAFT_GET_EXECUTABLE_EXTENSION,
  IPC_WARCRAFT_GET_EXECUTABLE_NAME,
  IPC_WARCRAFT_GET_INSTALLED_PRODUCTS,
  IPC_WARCRAFT_IS_WOW_APPLICATION,
  IPC_WARCRAFT_LIST_ADDONS,
} from "../../../src/common/constants";
import { InstalledProduct, WowClientType } from "wowup-lib-core";

import { ipcHandle, IpcController } from "../ipc-controller";
import { AddonFolderService } from "../../services/warcraft/addon-folder.service";
import { decodeProducts, WarcraftPlatform } from "../../services/warcraft/warcraft-platform.service";

export class WarcraftController implements IpcController {
  public constructor(
    private readonly platform: WarcraftPlatform,
    private readonly prefStore: Store,
    private readonly addonFolderService: AddonFolderService,
  ) {}

  public register(): void {
    ipcHandle(IPC_WARCRAFT_GET_BLIZZARD_AGENT_PATHS, (_evt, rescan?: boolean) =>
      this.getBlizzardAgentPaths(rescan === true),
    );
    ipcHandle(IPC_WARCRAFT_GET_INSTALLED_PRODUCTS, (_evt, agentPaths: string[]) =>
      this.getInstalledProducts(agentPaths),
    );
    ipcHandle(IPC_WARCRAFT_GET_EXECUTABLE_NAME, (_evt, clientType: WowClientType) =>
      this.platform.getExecutableName(clientType),
    );
    ipcHandle(IPC_WARCRAFT_GET_CLIENT_TYPE_FOR_BINARY, (_evt, binaryPath: string) =>
      this.platform.getClientType(binaryPath),
    );
    ipcHandle(IPC_WARCRAFT_IS_WOW_APPLICATION, (_evt, appName: string) => this.platform.isWowApplication(appName));
    ipcHandle(IPC_WARCRAFT_GET_EXECUTABLE_EXTENSION, () => this.platform.getExecutableExtension());
    ipcHandle(IPC_WARCRAFT_LIST_ADDONS, (_evt, addonFolderPath: string, scanSymlinks: boolean) =>
      this.addonFolderService.listAddons(addonFolderPath, scanSymlinks),
    );
    ipcHandle(IPC_WARCRAFT_GET_ADDON_FOLDER, (_evt, addonFolderPath: string, dir: string) =>
      this.addonFolderService.getAddonFolder(addonFolderPath, dir),
    );
  }

  /**
   * The product.db files found earlier, as long as they still exist. Searches again when none is left or
   * on rescan, keeping the ones still found, so a newly added wine prefix is picked up by a rescan.
   */
  public async getBlizzardAgentPaths(rescan = false): Promise<string[]> {
    const stored: string[] = [];
    for (const agentPath of this.getStoredAgentPaths()) {
      if (await exists(agentPath)) {
        stored.push(agentPath);
      }
    }

    if (stored.length > 0 && !rescan) {
      return stored;
    }

    const agentPaths = [...new Set([...stored, ...(await this.platform.getBlizzardAgentPaths())])];
    if (agentPaths.length > 0) {
      this.prefStore.set(BLIZZARD_AGENT_PATH_KEY, agentPaths);
    } else {
      this.prefStore.delete(BLIZZARD_AGENT_PATH_KEY);
    }

    return agentPaths;
  }

  /** The WoW products of every product.db, with their locations resolved for this platform */
  public async getInstalledProducts(agentPaths: string[]): Promise<InstalledProduct[]> {
    const products: InstalledProduct[] = [];
    for (const agentPath of agentPaths) {
      const decoded = await decodeProducts(agentPath);
      products.push(...this.platform.resolveProducts(decoded, agentPath));
    }

    return products;
  }

  /** Older versions stored a single path */
  private getStoredAgentPaths(): string[] {
    const stored = this.prefStore.get(BLIZZARD_AGENT_PATH_KEY) as string | string[] | undefined;
    if (Array.isArray(stored)) {
      return stored.filter((agentPath) => typeof agentPath === "string" && agentPath.length > 0);
    }

    return typeof stored === "string" && stored.length > 0 ? [stored] : [];
  }
}
