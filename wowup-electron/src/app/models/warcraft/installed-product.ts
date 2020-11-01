import { WowClientType } from "./wow-client-type";

export interface InstalledProduct {
  name: string;
  location: string;
  clientType: WowClientType;
}
