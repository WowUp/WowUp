import { WowClientType } from "../../../common/warcraft/wow-client-type";

export interface InstalledProduct {
  name: string;
  location: string;
  clientType: WowClientType;
}
