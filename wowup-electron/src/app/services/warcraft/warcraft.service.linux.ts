import { WowClientType } from "../../models/warcraft/wow-client-type";
import { WarcraftServiceImpl } from "./warcraft.service.impl";

export class WarcraftServiceLinux implements WarcraftServiceImpl {
  public async getBlizzardAgentPath(): Promise<string> {
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
