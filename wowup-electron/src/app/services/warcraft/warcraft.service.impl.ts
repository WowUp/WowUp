import { WowClientType } from "../../models/warcraft/wow-client-type";

export interface WarcraftServiceImpl {
  getExecutableExtension(): string;
  isWowApplication(appName: string): boolean;
  getBlizzardAgentPath(): Promise<string>;
  getExecutableName(clientType: WowClientType): string;
}
