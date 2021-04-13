import { WowClientType } from "../../../common/warcraft/wow-client-type";
import { WarcraftServiceImpl } from "./warcraft.service.impl";

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

export class WarcraftServiceLinux implements WarcraftServiceImpl {
  public getExecutableExtension(): string {
    return "";
  }

  /**
   * On Linux we dont know where to look for the wow agent, if there is any.
   */
  public getBlizzardAgentPath(): Promise<string> {
    return Promise.resolve("");
  }

  public isWowApplication(appName: string): boolean {
    return WOW_APP_NAMES.includes(appName);
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
