import { AddonProviderType } from "../../addon-providers/addon-provider";

export interface AddonProviderState {
  providerName: AddonProviderType;
  enabled: boolean;
  canEdit: boolean;
}
