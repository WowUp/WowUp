import * as fsp from "fs/promises";
import * as log from "electron-log/main";

import { InstalledProduct, WowClientType } from "wowup-lib-core";

import {
  WOW_ANNIVERSARY_FOLDER,
  WOW_BETA_FOLDER,
  WOW_CLASSIC_BETA_FOLDER,
  WOW_CLASSIC_ERA_FOLDER,
  WOW_CLASSIC_ERA_PTR_FOLDER,
  WOW_CLASSIC_FOLDER,
  WOW_CLASSIC_PTR_FOLDER,
  WOW_RETAIL_FOLDER,
  WOW_RETAIL_PTR_FOLDER,
  WOW_RETAIL_XPTR_FOLDER,
} from "../../../src/common/constants";
import { ProductDb } from "../../../src/common/wowup/product-db";

export interface WarcraftPlatform {
  getExecutableExtension(): string;
  isWowApplication(appName: string): boolean;
  getBlizzardAgentPath(): Promise<string>;
  getExecutableName(clientType: WowClientType): string;
  getClientType(binaryPath: string): WowClientType;
  resolveProducts(decodedProducts: InstalledProduct[], agentPath: string): InstalledProduct[];
}

function getClientTypeForFolderName(folderName: string): WowClientType {
  switch (folderName) {
    case WOW_RETAIL_FOLDER:
      return WowClientType.Retail;
    case WOW_RETAIL_PTR_FOLDER:
      return WowClientType.RetailPtr;
    case WOW_RETAIL_XPTR_FOLDER:
      return WowClientType.RetailXPtr;
    case WOW_CLASSIC_ERA_FOLDER:
      return WowClientType.ClassicEra;
    case WOW_CLASSIC_FOLDER:
      return WowClientType.Classic;
    case WOW_CLASSIC_PTR_FOLDER:
      return WowClientType.ClassicPtr;
    case WOW_BETA_FOLDER:
      return WowClientType.Beta;
    case WOW_CLASSIC_BETA_FOLDER:
      return WowClientType.ClassicBeta;
    case WOW_CLASSIC_ERA_PTR_FOLDER:
      return WowClientType.ClassicEraPtr;
    case WOW_ANNIVERSARY_FOLDER:
      return WowClientType.Anniversary;
    default:
      return WowClientType.None;
  }
}

export async function decodeProducts(productDbPath: string): Promise<InstalledProduct[]> {
  if (!productDbPath) {
    return [];
  }

  try {
    const data = await fsp.readFile(productDbPath);
    const productDb = ProductDb.decode(data);
    log.debug("productDb", JSON.stringify(productDb));

    const wowProducts: InstalledProduct[] = productDb.products
      .filter((p) => p.family === "wow")
      .map((p) => ({
        location: p.client.location,
        name: p.client.name,
        clientType: getClientTypeForFolderName(p.client.name),
      }));

    return wowProducts.filter((wp) => {
      if (wp.clientType === WowClientType.None) {
        log.warn("Invalid client type detected", wp);
        return false;
      }
      return true;
    });
  } catch (e) {
    log.error(`Failed to decode product db at ${productDbPath}`, e);
    return [];
  }
}
