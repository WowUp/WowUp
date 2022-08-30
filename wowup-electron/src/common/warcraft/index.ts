import * as constants from "../constants";
import { WowClientGroup, WowClientType } from "./wow-client-type";

export function getWowClientFolderName(clientType: WowClientType): string {
  switch (clientType) {
    case WowClientType.Retail:
      return constants.WOW_RETAIL_FOLDER;
    case WowClientType.ClassicEra:
      return constants.WOW_CLASSIC_ERA_FOLDER;
    case WowClientType.Classic:
      return constants.WOW_CLASSIC_FOLDER;
    case WowClientType.RetailPtr:
      return constants.WOW_RETAIL_PTR_FOLDER;
    case WowClientType.ClassicPtr:
      return constants.WOW_CLASSIC_PTR_FOLDER;
    case WowClientType.Beta:
      return constants.WOW_BETA_FOLDER;
    case WowClientType.ClassicBeta:
      return constants.WOW_CLASSIC_BETA_FOLDER;
    case WowClientType.ClassicEraPtr:
      return constants.WOW_CLASSIC_ERA_PTR_FOLDER;
    default:
      return "";
  }
}

export function getWowClientGroup(clientType: string | WowClientType): WowClientGroup {
  const enumVal: WowClientType = typeof clientType === "string" ? WowClientType[clientType] : clientType;
  switch (enumVal) {
    case WowClientType.Beta:
    case WowClientType.Retail:
    case WowClientType.RetailPtr:
      return WowClientGroup.Retail;
    case WowClientType.ClassicEra:
    case WowClientType.ClassicEraPtr:
      return WowClientGroup.Classic;
    case WowClientType.Classic:
    case WowClientType.ClassicPtr:
    case WowClientType.ClassicBeta:
      return WowClientGroup.WOTLK;
    default:
      throw new Error(`unsupported client type: ${clientType}`);
  }
}
