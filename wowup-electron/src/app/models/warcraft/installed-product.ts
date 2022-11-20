import { WowClientType } from "wowup-lib-core";

export interface InstalledProduct {
  name: string;
  location: string;
  clientType: WowClientType;
}
