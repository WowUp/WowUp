import { join } from "path";
import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { FileService } from "../files/file.service";
import { WarcraftServiceImpl } from "./warcraft.service.impl";

const WOW_RETAIL_NAME = "World of Warcraft.app";
const WOW_RETAIL_PTR_NAME = "World of Warcraft Test.app";
const WOW_CLASSIC_NAME = "World of Warcraft Classic.app";
const WOW_CLASSIC_PTR_NAME = "World of Warcraft Classic Test.app";
const WOW_RETAIL_BETA_NAME = "World of Warcraft Beta.app";

const WOW_APP_NAMES = [
  WOW_RETAIL_NAME,
  WOW_RETAIL_PTR_NAME,
  WOW_CLASSIC_NAME,
  WOW_CLASSIC_PTR_NAME,
  WOW_RETAIL_BETA_NAME,
];

const BLIZZARD_AGENT_PATH = "/Users/Shared/Battle.net/Agent";
const BLIZZARD_PRODUCT_DB_NAME = "product.db";

export class WarcraftServiceMac implements WarcraftServiceImpl {
  public constructor(private _fileService: FileService) {}

  public getExecutableExtension(): string {
    return "app";
  }

  public isWowApplication(appName: string): boolean {
    return WOW_APP_NAMES.includes(appName);
  }

  public async getBlizzardAgentPath(): Promise<string> {
    const agentPath = join(BLIZZARD_AGENT_PATH, BLIZZARD_PRODUCT_DB_NAME);
    const exists = await this._fileService.pathExists(agentPath);
    return exists ? agentPath : "";
  }

  public getExecutableName(clientType: WowClientType): string {
    switch (clientType) {
      case WowClientType.Retail:
        return WOW_RETAIL_NAME;
      case WowClientType.Classic:
        return WOW_CLASSIC_NAME;
      case WowClientType.RetailPtr:
        return WOW_RETAIL_NAME;
      case WowClientType.ClassicPtr:
        return WOW_CLASSIC_PTR_NAME;
      case WowClientType.Beta:
        return WOW_RETAIL_BETA_NAME;
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
      default:
        return WowClientType.None;
    }
  }
}
