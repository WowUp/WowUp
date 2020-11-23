import * as nodeDiskInfo from "node-disk-info";
import * as path from "path";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { FileUtils } from "../../utils/file.utils";
import { WarcraftServiceImpl } from "./warcraft.service.impl";

// BLIZZARD STRINGS
const WINDOWS_BLIZZARD_AGENT_PATH = "ProgramData/Battle.net/Agent";
const BLIZZARD_PRODUCT_DB_NAME = "product.db";

export class WarcraftServiceWin implements WarcraftServiceImpl {
  async getBlizzardAgentPath(): Promise<string> {
    try {
      const diskInfo = await nodeDiskInfo.getDiskInfo();
      const driveNames = diskInfo.map((i) => i.mounted);

      for (const name of driveNames) {
        const agentPath = path.join(name, WINDOWS_BLIZZARD_AGENT_PATH, BLIZZARD_PRODUCT_DB_NAME);
        const exists = await FileUtils.exists(agentPath);

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
