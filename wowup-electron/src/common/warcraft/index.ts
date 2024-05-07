import { WowClientType } from "wowup-lib-core";
import * as constants from "../constants";

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
    case WowClientType.RetailXPtr:
      return constants.WOW_RETAIL_XPTR_FOLDER;
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
