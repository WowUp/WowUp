import { ipcMain } from "electron";
import * as Store from "electron-store";
import * as fsp from "fs/promises";
import * as path from "path";

import {
  BLIZZARD_AGENT_PATH_KEY,
  IPC_WARCRAFT_GET_BLIZZARD_AGENT_PATH,
  IPC_WARCRAFT_GET_CLIENT_TYPE_FOR_BINARY,
  IPC_WARCRAFT_GET_EXECUTABLE_EXTENSION,
  IPC_WARCRAFT_GET_EXECUTABLE_NAME,
  IPC_WARCRAFT_GET_INSTALLED_PRODUCTS,
  IPC_WARCRAFT_IS_WOW_APPLICATION,
} from "../../../src/common/constants";
import { InstalledProduct, WowClientType } from "wowup-lib-core";

import { IpcController } from "../ipc-controller";
import { decodeProducts, WarcraftPlatform } from "../../services/warcraft/warcraft-platform.service";

export class WarcraftController implements IpcController {
  public constructor(
    private readonly platform: WarcraftPlatform,
    private readonly prefStore: Store,
  ) {}

  public register(): void {
    ipcMain.handle(IPC_WARCRAFT_GET_BLIZZARD_AGENT_PATH, () => this.getBlizzardAgentPath());
    ipcMain.handle(IPC_WARCRAFT_GET_INSTALLED_PRODUCTS, (_evt, agentPath: string) => this.getInstalledProducts(agentPath));
    ipcMain.handle(IPC_WARCRAFT_GET_EXECUTABLE_NAME, (_evt, clientType: WowClientType) => this.platform.getExecutableName(clientType));
    ipcMain.handle(IPC_WARCRAFT_GET_CLIENT_TYPE_FOR_BINARY, (_evt, binaryPath: string) => this.platform.getClientType(binaryPath));
    ipcMain.handle(IPC_WARCRAFT_IS_WOW_APPLICATION, (_evt, appName: string) => this.platform.isWowApplication(appName));
    ipcMain.handle(IPC_WARCRAFT_GET_EXECUTABLE_EXTENSION, () => this.platform.getExecutableExtension());
  }

  public async getBlizzardAgentPath(): Promise<string> {
    const stored = this.prefStore.get(BLIZZARD_AGENT_PATH_KEY) as string | undefined;
    if (stored) {
      return stored;
    }

    const agentPath = await this.platform.getBlizzardAgentPath();
    if (agentPath) {
      this.prefStore.set(BLIZZARD_AGENT_PATH_KEY, agentPath);
    }

    return agentPath;
  }

  public async getInstalledProducts(agentPath: string): Promise<Map<WowClientType, InstalledProduct>> {
    const decoded = await decodeProducts(agentPath);
    const resolved = this.platform.resolveProducts(decoded, agentPath);

    const result = new Map<WowClientType, InstalledProduct>();
    for (const product of resolved) {
      const clientType = await this.refineClassicBetaClientType(product);
      result.set(clientType, { ...product, clientType });
    }
    return result;
  }

  /**
   * The `_classic_beta_` folder is shared by two distinct products: the legacy
   * MoP Classic beta (WowClassicB.exe) and the newer Forever Classic beta,
   * which reuses the retail beta executable name (WowB.exe) instead. Folder name
   * alone can't tell them apart, so disambiguate by checking which executable
   * actually exists on disk.
   */
  private async refineClassicBetaClientType(product: InstalledProduct): Promise<WowClientType> {
    if (product.clientType !== WowClientType.ClassicBeta) {
      return product.clientType;
    }

    const foreverExeName = this.platform.getExecutableName(WowClientType.Forever);
    const foreverExePath = path.join(product.location, product.name, foreverExeName);
    const exists = await fsp
      .access(foreverExePath)
      .then(() => true)
      .catch(() => false);

    return exists ? WowClientType.Forever : product.clientType;
  }
}
