import * as path from "path";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { ElectronService } from "../electron/electron.service";
import { FileService } from "../files/file.service";
import { WarcraftServiceImpl } from "./warcraft.service.impl";
import { IPC_LIST_DISKS_WIN32 } from "../../../common/constants";

const WOW_RETAIL_NAME = "Wow.exe";
const WOW_RETAIL_PTR_NAME = "WowT.exe";
const WOW_RETAIL_BETA_NAME = "WowB.exe";
const WOW_CLASSIC_NAME = "WowClassic.exe";
const WOW_CLASSIC_PTR_NAME = "WowClassicT.exe";
const WOW_CLASSIC_BETA_NAME = "WowClassicB.exe";

const WOW_APP_NAMES = [
  WOW_RETAIL_NAME,
  WOW_RETAIL_PTR_NAME,
  WOW_RETAIL_BETA_NAME,
  WOW_CLASSIC_NAME,
  WOW_CLASSIC_PTR_NAME,
  WOW_CLASSIC_BETA_NAME,
];

// BLIZZARD STRINGS
const WINDOWS_BLIZZARD_AGENT_PATH = "ProgramData/Battle.net/Agent";
const BLIZZARD_PRODUCT_DB_NAME = "product.db";

export class WarcraftServiceWin implements WarcraftServiceImpl {
  public constructor(private _electronService: ElectronService, private _fileService: FileService) {}

  public getExecutableExtension(): string {
    return "exe";
  }

  public isWowApplication(appName: string): boolean {
    return WOW_APP_NAMES.includes(appName);
  }

  /**
   * Attempt to figure out where the blizzard agent was installed at
   */
  public async getBlizzardAgentPath(): Promise<string> {
    try {
      const diskInfo = await this._electronService.invoke(IPC_LIST_DISKS_WIN32);
      console.debug("diskInfo", diskInfo);
      const driveNames = diskInfo.map((i) => i.mounted);

      for (const name of driveNames) {
        const agentPath = path.join(name, WINDOWS_BLIZZARD_AGENT_PATH, BLIZZARD_PRODUCT_DB_NAME);
        const exists = await this._fileService.pathExists(agentPath);

        if (exists) {
          console.log(`Found products at ${agentPath}`);
          return agentPath;
        }
      }
    } catch (e) {
      console.error("Failed to search for blizzard products", e);
    }

    return "";
  }

  public getExecutableName(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
        return WOW_RETAIL_NAME;
      case WowClientType.Classic:
        return WOW_CLASSIC_NAME;
      case WowClientType.RetailPtr:
        return WOW_RETAIL_PTR_NAME;
      case WowClientType.ClassicPtr:
        return WOW_CLASSIC_PTR_NAME;
      case WowClientType.Beta:
        return WOW_RETAIL_BETA_NAME;
      case WowClientType.ClassicBeta:
        return WOW_CLASSIC_BETA_NAME;
      default:
        return "";
    }
  }

  public getClientType(executableName: string): WowClientType {
    switch (executableName) {
      case WOW_RETAIL_NAME:
        return WowClientType.Retail;
      case WOW_CLASSIC_NAME:
        return WowClientType.Classic;
      case WOW_RETAIL_PTR_NAME:
        return WowClientType.RetailPtr;
      case WOW_CLASSIC_PTR_NAME:
        return WowClientType.ClassicPtr;
      case WOW_RETAIL_BETA_NAME:
        return WowClientType.Beta;
      case WOW_CLASSIC_BETA_NAME:
        return WowClientType.ClassicBeta;
      default:
        return WowClientType.None;
    }
  }
}
