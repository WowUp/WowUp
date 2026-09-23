import * as path from "path";

import { WowClientType } from "wowup-lib-core";
import * as constants from "../constants";

// Windows/macOS filesystems are case-insensitive and paths can differ by
// separator style or trailing separators depending on their source
// (a manually-picked file vs. one reconstructed from Battle.net's product
// db), so installation paths must be normalized before being compared.
export function normalizeInstallationPath(installationPath: string): string {
  return path.normalize(installationPath).toLowerCase();
}

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
    case WowClientType.Anniversary:
      return constants.WOW_ANNIVERSARY_FOLDER;
    default:
      return "";
  }
}
