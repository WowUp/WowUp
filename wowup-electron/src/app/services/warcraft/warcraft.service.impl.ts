import { WowClientType } from "../../models/warcraft/wow-client-type";

export interface WarcraftServiceImpl {
  getBlizzardAgentPath(): Promise<string>;
  getExecutableName(clientType: WowClientType): string;
}
