import * as path from "path";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { ElectronService } from "../electron/electron.service";
import { FileService } from "../files/file.service";
import { WarcraftServiceImpl } from "./warcraft.service.impl";
import { IPC_LIST_DISKS_WIN32 } from "../../../common/constants";

// BLIZZARD STRINGS
const WINDOWS_BLIZZARD_AGENT_PATH = "ProgramData/Battle.net/Agent";
const BLIZZARD_PRODUCT_DB_NAME = "product.db";

export class WarcraftServiceWin implements WarcraftServiceImpl {
  constructor(private _electronService: ElectronService, private _fileService: FileService) {}

  async getBlizzardAgentPath(): Promise<string> {
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
        return "Wow.exe";
      case WowClientType.Classic:
        return "WowClassic.exe";
      case WowClientType.RetailPtr:
        return "WowT.exe";
      case WowClientType.ClassicPtr:
        return "WowClassicT.exe";
      case WowClientType.Beta:
        return "WowB.exe";
      default:
        return "";
    }
  }
}
