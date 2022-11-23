import { WowClientType } from "wowup-lib-core";
import { InstalledProduct } from "../../models/warcraft/installed-product";

export interface WarcraftServiceImpl {
  getExecutableExtension(): string;
  isWowApplication(appName: string): boolean;
  getBlizzardAgentPath(): Promise<string>;
  getExecutableName(clientType: WowClientType): string;
  getClientType(binaryPath: string): WowClientType;
  resolveProducts(decodedProducts: InstalledProduct[], agentPath: string): InstalledProduct[];
}
