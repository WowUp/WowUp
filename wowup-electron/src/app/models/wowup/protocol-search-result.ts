import { WowClientGroup, WowClientType } from "../../../common/warcraft/wow-client-type";
import { AddonSearchResult } from "./addon-search-result";

export interface ProtocolSearchResult extends AddonSearchResult {
  protocol: string;
  protocolAddonId?: string;
  protocolReleaseId?: string;
  validClientTypes?: WowClientType[];
  validClientGroups?: WowClientGroup[];
}
